from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body, status
from decimal import Decimal
from datetime import date, datetime, time, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from uuid import UUID
from urllib.parse import quote

from app import models, schemas
from app.core.offer_permissions import (
    apply_offer_visibility_filter,
    can_edit_offer,
    can_read_offer,
    resolve_offer_permissions,
)
from app.core.permissions import PermissionCode, require_permissions
from app.database import get_db
from app.services.offer_service import OfferService

router = APIRouter()

def _build_content_disposition(filename: str) -> str:
    """
    Build a Content-Disposition header that supports UTF-8 filenames safely.
    """
    cleaned = filename.replace("\r", "").replace("\n", "").replace('"', "")
    try:
        cleaned.encode("ascii")
        return f'attachment; filename="{cleaned}"'
    except UnicodeEncodeError:
        fallback = "offer.pdf"
        return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(cleaned)}"

def _normalize_status(value: Optional[models.OfferStatus | str]) -> models.OfferStatus:
    """
    Accepts enum or string and returns a valid OfferStatus.
    Falls back to draft if the value is not recognized.
    """
    if value is None:
        return models.OfferStatus.DRAFT
    if isinstance(value, models.OfferStatus):
        return value
    raw = str(value).strip().upper()
    try:
        return models.OfferStatus[raw]
    except Exception:
        try:
            return models.OfferStatus(raw)
        except Exception:
            return models.OfferStatus.DRAFT

def _validate_site_for_client(
    db: Session,
    *,
    client_id: UUID,
    site_id: Optional[UUID],
) -> Optional[models.ClientSite]:
    if not site_id:
        return None
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=400, detail="Selected site does not exist")
    if site.client_id != client_id:
        raise HTTPException(status_code=400, detail="Selected site does not belong to client")
    return site


def _assign_offer_contacts(
    db: Session,
    *,
    offer: models.Offer,
    contact_ids: List[UUID],
) -> None:
    unique_ids: List[UUID] = []
    seen: set[UUID] = set()
    for raw_id in contact_ids:
        if raw_id in seen:
            continue
        seen.add(raw_id)
        unique_ids.append(raw_id)

    if not unique_ids:
        offer.contacts = []
        offer.contact_person_id = None
        offer.contact_person_name = None
        return

    contacts = (
        db.query(models.ClientContact)
        .filter(models.ClientContact.id.in_(unique_ids))
        .all()
    )
    by_id = {c.id: c for c in contacts}

    missing = [str(cid) for cid in unique_ids if cid not in by_id]
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown contact IDs: {', '.join(missing)}")

    for contact in contacts:
        if contact.client_id != offer.client_id:
            raise HTTPException(status_code=400, detail="All contacts must belong to offer client")

    offer.contacts = [by_id[cid] for cid in unique_ids]
    primary = offer.contacts[0]
    # Keep legacy fields populated for backward compatibility.
    offer.contact_person_id = primary.id
    offer.contact_person_name = primary.name


def _normalize_tag_names(raw_tags: Optional[List[str]]) -> List[str]:
    if not raw_tags:
        return []
    normalized: List[str] = []
    seen: set[str] = set()
    for raw in raw_tags:
        if raw is None:
            continue
        for token in str(raw).replace(";", ",").split(","):
            value = token.strip()
            if not value:
                continue
            key = value.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(value)
    return normalized


def _assign_offer_tags(
    db: Session,
    *,
    offer: models.Offer,
    raw_tags: Optional[List[str]],
) -> None:
    tags = _normalize_tag_names(raw_tags)
    if not tags:
        offer.tags = []
        return

    lowered = [t.lower() for t in tags]
    existing = (
        db.query(models.Tag)
        .filter(func.lower(models.Tag.name).in_(lowered))
        .all()
    )
    by_lower = {t.name.lower(): t for t in existing}

    resolved: List[models.Tag] = []
    for tag_name in tags:
        key = tag_name.lower()
        tag_obj = by_lower.get(key)
        if tag_obj is None:
            tag_obj = models.Tag(name=tag_name)
            db.add(tag_obj)
            db.flush()
            by_lower[key] = tag_obj
        resolved.append(tag_obj)

    offer.tags = [models.OfferTag(tag=tag_obj) for tag_obj in resolved]


def _start_of_day_utc(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=timezone.utc)

@router.get("/", response_model=List[schemas.offer.Offer])
def read_offers(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    status: Optional[str] = None,
    client_id: Optional[UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.OFFERS_READ_ALL.value,
            PermissionCode.OFFERS_READ_OWN.value,
            PermissionCode.OFFERS_EDIT_ALL.value,
            PermissionCode.OFFERS_EDIT_OWN.value,
            require_all=False,
        )
    ),
) -> Any:
    granted_permissions = resolve_offer_permissions(db, current_user)
    query = apply_offer_visibility_filter(
        db.query(models.Offer),
        permission_codes=granted_permissions,
        user=current_user,
    )
    normalized_status = _normalize_status(status) if status else None

    if search:
        search_term = f"%{search.strip()}%"
        query = query.join(models.Client).filter(
            (models.Offer.offer_number.ilike(search_term)) |
            (models.Offer.project_name.ilike(search_term)) |
            (models.Offer.site_address.ilike(search_term)) |
            (models.Offer.site.has(models.ClientSite.site_code.ilike(search_term))) |
            (models.Client.name.ilike(search_term)) |
            (models.Offer.lines.any(models.OfferLine.description.ilike(search_term))) |
            (
                models.Offer.lines.any(
                    models.OfferLine.material.has(
                        or_(
                            models.Material.name.ilike(search_term),
                            models.Material.erp_code.ilike(search_term),
                            models.Material.description.ilike(search_term),
                        )
                    )
                )
            ) |
            (
                models.Offer.tags.any(
                    models.OfferTag.tag.has(models.Tag.name.ilike(search_term))
                )
            )
        )
    if normalized_status:
        query = query.filter(models.Offer.status == normalized_status)
    if client_id:
        query = query.filter(models.Offer.client_id == client_id)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from must be earlier than or equal to date_to")
    if date_from:
        query = query.filter(models.Offer.created_at >= _start_of_day_utc(date_from))
    if date_to:
        query = query.filter(models.Offer.created_at < _start_of_day_utc(date_to + timedelta(days=1)))
        
    offers = query.order_by(models.Offer.created_at.desc()).offset(skip).limit(limit).all()
    return offers

@router.get("/stats")
def offers_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.OFFERS_READ_ALL.value,
            PermissionCode.OFFERS_READ_OWN.value,
            PermissionCode.OFFERS_EDIT_ALL.value,
            PermissionCode.OFFERS_EDIT_OWN.value,
            require_all=False,
        )
    ),
) -> Any:
    granted_permissions = resolve_offer_permissions(db, current_user)
    offers_query = apply_offer_visibility_filter(
        db.query(models.Offer),
        permission_codes=granted_permissions,
        user=current_user,
    )

    total_offers = offers_query.count()
    offers_by_status = dict(
        offers_query.with_entities(models.Offer.status, func.count(models.Offer.id))
        .group_by(models.Offer.status)
        .all()
    )

    total_clients = db.query(func.count(models.Client.id)).scalar()
    total_materials = db.query(func.count(models.Material.id)).scalar()

    recent_offers = (
        offers_query.order_by(models.Offer.created_at.desc())
        .limit(5)
        .all()
    )

    recent_serialized = [
        {
            "id": o.id,
            "offer_number": o.offer_number,
            "client_name": o.client.name if o.client else "",
            "project_name": o.project_name,
            "status": o.status,
            "total_price": o.total_price,
            "created_at": o.created_at,
        }
        for o in recent_offers
    ]

    return {
        "total_offers": total_offers,
        "total_clients": total_clients,
        "total_materials": total_materials,
        "offers_by_status": offers_by_status,
        "recent_offers": recent_serialized,
    }

@router.post("/", response_model=schemas.offer.Offer)
def create_offer(
    *,
    db: Session = Depends(get_db),
    offer_in: schemas.offer.OfferCreate,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.OFFERS_EDIT_ALL.value,
            PermissionCode.OFFERS_EDIT_OWN.value,
            require_all=False,
        )
    ),
) -> Any:
    offer_number = OfferService.generate_offer_number(db, current_user)
    status_value = _normalize_status(offer_in.status)
    validated_site = _validate_site_for_client(
        db,
        client_id=offer_in.client_id,
        site_id=getattr(offer_in, "site_id", None),
    )
    requested_contact_ids = list(getattr(offer_in, "contact_person_ids", []) or [])
    if not requested_contact_ids and getattr(offer_in, "contact_person_id", None):
        requested_contact_ids = [offer_in.contact_person_id]
    
    offer = models.Offer(
        offer_number=offer_number,
        user_id=current_user.id,
        client_id=offer_in.client_id,
        site_id=validated_site.id if validated_site else None,
        contact_person_id=getattr(offer_in, "contact_person_id", None),
        contact_person_name=getattr(offer_in, "contact_person_name", None),
        project_name=offer_in.project_name,
        site_address=offer_in.site_address,
        currency=offer_in.currency,
        status=status_value,
        validity_days=offer_in.validity_days,
        payment_terms=offer_in.payment_terms,
        delivery_time=offer_in.delivery_time,
        notes_internal=offer_in.notes_internal,
        notes_client=offer_in.notes_client,
        show_discount_column=offer_in.show_discount_column,
    )
    db.add(offer)
    db.flush()
    if requested_contact_ids:
        _assign_offer_contacts(db, offer=offer, contact_ids=requested_contact_ids)
    _assign_offer_tags(db, offer=offer, raw_tags=getattr(offer_in, "tags", None))
    db.commit()
    db.refresh(offer)
    return offer

@router.get("/{offer_id}", response_model=schemas.offer.Offer)
def read_offer(
    *,
    db: Session = Depends(get_db),
    offer_id: str,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.OFFERS_READ_ALL.value,
            PermissionCode.OFFERS_READ_OWN.value,
            PermissionCode.OFFERS_EDIT_ALL.value,
            PermissionCode.OFFERS_EDIT_OWN.value,
            require_all=False,
        )
    ),
) -> Any:
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    granted_permissions = resolve_offer_permissions(db, current_user)
    if not can_read_offer(permission_codes=granted_permissions, user=current_user, offer=offer):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return offer

@router.patch("/{offer_id}", response_model=schemas.offer.Offer)
def update_offer(
    *,
    db: Session = Depends(get_db),
    offer_id: str,
    offer_in: schemas.offer.OfferUpdate,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.OFFERS_EDIT_ALL.value,
            PermissionCode.OFFERS_EDIT_OWN.value,
            require_all=False,
        )
    ),
) -> Any:
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    granted_permissions = resolve_offer_permissions(db, current_user)
    if not can_edit_offer(permission_codes=granted_permissions, user=current_user, offer=offer):
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    update_data = offer_in.model_dump(exclude_unset=True)
    legacy_contact_name = update_data.get("contact_person_name")
    requested_contact_ids = update_data.pop("contact_person_ids", None)
    requested_tags = update_data.pop("tags", None)
    site_was_provided = "site_id" in update_data
    requested_site_id = update_data.pop("site_id", None) if site_was_provided else None
    if "status" in update_data:
        requested_status = _normalize_status(update_data["status"])
        current_status = _normalize_status(offer.status)
        # Publishing is only allowed while the offer is still draft.
        if (
            requested_status == models.OfferStatus.PUBLISHED
            and current_status != models.OfferStatus.DRAFT
        ):
            update_data.pop("status", None)
        else:
            update_data["status"] = requested_status
    if site_was_provided:
        if requested_site_id is None:
            update_data["site_id"] = None
        else:
            site_client_id = update_data.get("client_id", offer.client_id)
            validated_site = _validate_site_for_client(
                db,
                client_id=site_client_id,
                site_id=requested_site_id,
            )
            update_data["site_id"] = validated_site.id
    # Keep contact person name in sync if legacy ID is explicitly cleared
    if (
        "contact_person_id" in update_data
        and update_data.get("contact_person_id") is None
        and requested_contact_ids is None
        and "contact_person_name" not in update_data
    ):
        update_data["contact_person_name"] = None
        
    for field, value in update_data.items():
        setattr(offer, field, value)

    client_changed = "client_id" in update_data
    if client_changed and requested_contact_ids is None:
        # Contacts from another client are invalid once client changes.
        offer.contacts = []
        offer.contact_person_id = None
        offer.contact_person_name = None
    if client_changed and not site_was_provided:
        # Existing site may belong to old client.
        offer.site_id = None

    if requested_contact_ids is not None:
        _assign_offer_contacts(db, offer=offer, contact_ids=requested_contact_ids)
        if not requested_contact_ids and legacy_contact_name:
            offer.contact_person_name = legacy_contact_name
    if requested_tags is not None:
        _assign_offer_tags(db, offer=offer, raw_tags=requested_tags)
        
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer

@router.post("/{offer_id}/lines/bulk", response_model=schemas.offer.Offer)
def update_offer_lines(
    *,
    db: Session = Depends(get_db),
    offer_id: str,
    lines_in: List[schemas.offer.OfferLineUpdate],
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.OFFERS_EDIT_ALL.value,
            PermissionCode.OFFERS_EDIT_OWN.value,
            require_all=False,
        )
    ),
) -> Any:
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    granted_permissions = resolve_offer_permissions(db, current_user)
    if not can_edit_offer(permission_codes=granted_permissions, user=current_user, offer=offer):
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    # Delete existing lines not in the input list (if we want full sync)
    # Or just update/add. Usually bulk update replaces the list or we handle deletes explicitly.
    # Let's assume the input list IS the new state of lines.
    
    # 1. Map existing lines by ID
    existing_lines = {line.id: line for line in offer.lines}
    
    # 2. Process input
    new_lines_ids = set()
    
    for line_data in lines_in:
        data = line_data.dict(exclude_unset=True)
        
        # Calculate margin/price/cost logic
        cost = Decimal(str(data.get("cost", 0) or 0))
        price = Decimal(str(data.get("price", 0) or 0))
        discount_percent = Decimal(str(data.get("discount_percent", 0) or 0))
        margin_percent = data.get("margin_percent")
        
        # If margin_percent is provided, recalculate price from cost
        if margin_percent is not None and cost is not None:
             price = OfferService.calculate_price_from_margin(cost, margin_percent)
             data["price"] = price
        
        # Effective price after discount
        effective_price = price
        if discount_percent:
            effective_price = price * (Decimal(1) - discount_percent / Decimal(100))

        # Recalculate margin values based on final price/cost
        m_val, m_pct = OfferService.calculate_margin(cost or 0, effective_price or 0)
        data["margin_value"] = m_val
        data["margin_percent"] = m_pct
        data["discount_percent"] = discount_percent
        
        if line_data.id and line_data.id in existing_lines:
            # Update
            line_obj = existing_lines[line_data.id]
            for k, v in data.items():
                if k != "id":
                    setattr(line_obj, k, v)
            new_lines_ids.add(line_data.id)
        else:
            # Create
            if "id" in data:
                del data["id"]
            new_line = models.OfferLine(offer_id=offer.id, **data)
            db.add(new_line)
            
    # 3. Delete missing
    for line_id, line in existing_lines.items():
        if line_id not in new_lines_ids:
            db.delete(line)
            
    # 4. Recalculate totals
    db.flush() # Apply changes to DB to calculate totals correctly
    OfferService.recalculate_offer_totals(db, offer)
    
    db.commit()
    db.refresh(offer)
    return offer

@router.post("/{offer_id}/duplicate", response_model=schemas.offer.Offer)
def duplicate_offer(
    *,
    db: Session = Depends(get_db),
    offer_id: str,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.OFFERS_EDIT_ALL.value,
            PermissionCode.OFFERS_EDIT_OWN.value,
            require_all=False,
        )
    ),
) -> Any:
    source_offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not source_offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    granted_permissions = resolve_offer_permissions(db, current_user)
    if not can_edit_offer(permission_codes=granted_permissions, user=current_user, offer=source_offer):
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    new_number = OfferService.generate_offer_number(db, current_user)
    
    new_offer = models.Offer(
        offer_number=new_number,
        user_id=current_user.id,
        client_id=source_offer.client_id,
        site_id=source_offer.site_id,
        project_name=f"{source_offer.project_name} (Copy)",
        site_address=source_offer.site_address,
        currency=source_offer.currency,
        status=_normalize_status(models.OfferStatus.DRAFT),
        validity_days=source_offer.validity_days,
        payment_terms=source_offer.payment_terms,
        delivery_time=source_offer.delivery_time,
        notes_internal=source_offer.notes_internal,
        notes_client=source_offer.notes_client,
        parent_offer_id=source_offer.id,
        show_discount_column=source_offer.show_discount_column,
        version=1
    )
    db.add(new_offer)
    db.flush()
    if source_offer.contacts:
        new_offer.contacts = list(source_offer.contacts)
    elif source_offer.contact_person_id:
        fallback_contact = (
            db.query(models.ClientContact)
            .filter(models.ClientContact.id == source_offer.contact_person_id)
            .first()
        )
        if fallback_contact and fallback_contact.client_id == source_offer.client_id:
            new_offer.contacts = [fallback_contact]
    if new_offer.contacts:
        new_offer.contact_person_id = new_offer.contacts[0].id
        new_offer.contact_person_name = new_offer.contacts[0].name
    if source_offer.tag_names:
        _assign_offer_tags(db, offer=new_offer, raw_tags=source_offer.tag_names)
    
    # Copy lines
    for line in source_offer.lines:
        new_line = models.OfferLine(
            offer_id=new_offer.id,
            line_no=line.line_no,
            type=line.type,
            section=line.section,
            material_id=line.material_id,
            description=line.description,
            quantity=line.quantity,
            unit=line.unit,
            cost=line.cost,
            price=line.price,
            discount_percent=line.discount_percent,
            margin_value=line.margin_value,
            margin_percent=line.margin_percent,
            order_index=line.order_index
        )
        db.add(new_line)
        
    OfferService.recalculate_offer_totals(db, new_offer)
    db.commit()
    db.refresh(new_offer)
    return new_offer

@router.delete("/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_offer(
    *,
    db: Session = Depends(get_db),
    offer_id: str,
    current_user: models.User = Depends(require_permissions(PermissionCode.OFFERS_EDIT_ALL.value)),
) -> None:
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    db.delete(offer)
    db.commit()
    return None

@router.get("/{offer_id}/pdf")
def export_offer_pdf(
    *,
    db: Session = Depends(get_db),
    offer_id: str,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.OFFERS_READ_ALL.value,
            PermissionCode.OFFERS_READ_OWN.value,
            PermissionCode.OFFERS_EDIT_ALL.value,
            PermissionCode.OFFERS_EDIT_OWN.value,
            require_all=False,
        )
    ),
) -> Any:
    from fastapi.responses import Response
    from app.services.pdf_service import PDFService
    
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    granted_permissions = resolve_offer_permissions(db, current_user)
    if not can_read_offer(permission_codes=granted_permissions, user=current_user, offer=offer):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    pdf_service = PDFService()
    pdf_bytes = pdf_service.generate_offer_pdf(db, offer)
    filename = f"offer_{offer.offer_number}.pdf"
    content_disposition = _build_content_disposition(filename)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": content_disposition
        }
    )

@router.post("/{offer_id}/apply-target-margin", response_model=schemas.offer.Offer)
def apply_target_margin(
    *,
    db: Session = Depends(get_db),
    offer_id: str,
    target_margin_percent: float = Body(..., embed=True),
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.OFFERS_EDIT_ALL.value,
            PermissionCode.OFFERS_EDIT_OWN.value,
            require_all=False,
        )
    ),
) -> Any:
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    granted_permissions = resolve_offer_permissions(db, current_user)
    if not can_edit_offer(permission_codes=granted_permissions, user=current_user, offer=offer):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Apply target margin to all lines
    target_margin_decimal = Decimal(str(target_margin_percent))

    for line in offer.lines:
        if line.cost > 0:
            new_price = OfferService.calculate_price_from_margin(line.cost, target_margin_decimal)
            line.price = new_price
            discount = Decimal(getattr(line, "discount_percent", 0) or 0)
            if not getattr(offer, "show_discount_column", False):
                discount = Decimal(0)
            effective_price = new_price * (Decimal(1) - discount / Decimal(100))
            line.margin_value, line.margin_percent = OfferService.calculate_margin(line.cost, effective_price)

    OfferService.recalculate_offer_totals(db, offer)
    db.commit()
    db.refresh(offer)
    return offer
