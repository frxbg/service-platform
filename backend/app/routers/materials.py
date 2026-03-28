from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from decimal import Decimal, InvalidOperation
import json

from app import models, schemas
from app.core.data_visibility import can_read_materials_commercial, can_read_materials_operational
from app.core.offer_permissions import apply_offer_visibility_filter, resolve_offer_permissions
from app.core.permissions import PermissionCode, require_permissions
from app.database import get_db
from app.utils.import_utils import parse_selected_row_indexes, read_tabular_upload

router = APIRouter()
ALLOWED_IMPORT_MODES = {"upsert", "skip", "rename", "error"}


def _prefix_import_value(value: str, fallback: str = "record") -> str:
    clean_value = (value or "").strip() or fallback
    if clean_value.lower().startswith("import_"):
        return clean_value
    return f"import_{clean_value}"


def _build_unique_import_erp_code(db: Session, base_value: str) -> str:
    normalized = _prefix_import_value(base_value, fallback="material")
    candidate = normalized
    counter = 1

    while db.query(models.Material).filter(models.Material.erp_code == candidate).first():
        counter += 1
        candidate = f"import_{counter}_{base_value}"

    return candidate


def _serialize_material(material: models.Material, *, include_commercial: bool) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": material.id,
        "erp_code": material.erp_code,
        "barcode": material.barcode,
        "name": material.name,
        "description": material.description,
        "unit": material.unit,
        "category": material.category,
        "subcategory": material.subcategory,
        "is_active": material.is_active,
        "last_synced_at": material.last_synced_at,
    }
    if include_commercial:
        payload.update(
            {
                "cost_currency": material.cost_currency,
                "cost": material.cost,
                "default_margin_percent": material.default_margin_percent,
                "default_sell_price": material.default_sell_price,
            }
        )
    return payload


def _serialize_material_offer_usage(
    *,
    line: models.OfferLine,
    offer: models.Offer,
    client: models.Client | None,
    include_commercial: bool,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "offer_id": offer.id,
        "offer_number": offer.offer_number,
        "offer_status": offer.status.value if getattr(offer.status, "value", None) else str(offer.status),
        "client_name": client.name if client else None,
        "project_name": offer.project_name,
        "quantity": line.quantity,
        "unit": line.unit,
        "line_no": line.line_no,
        "created_at": offer.created_at,
    }
    if include_commercial:
        payload.update({"line_price": line.price, "line_cost": line.cost})
    return payload

@router.post("/", response_model=schemas.material.MaterialCommercial, status_code=201)
def create_material(
    *,
    db: Session = Depends(get_db),
    material_in: schemas.material.MaterialCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.MATERIALS_MANAGE.value)),
) -> Any:
    existing = (
        db.query(models.Material)
        .filter(models.Material.erp_code == material_in.erp_code)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Material with this ERP code already exists"
        )

    default_sell_price = material_in.default_sell_price
    if default_sell_price is None and material_in.default_margin_percent is not None:
        default_sell_price = material_in.cost * (
            Decimal(1) + (material_in.default_margin_percent / Decimal(100))
        )

    db_material = models.Material(
        erp_code=material_in.erp_code,
        barcode=material_in.barcode,
        name=material_in.name,
        description=material_in.description,
        unit=material_in.unit,
        category=material_in.category,
        subcategory=material_in.subcategory,
        cost_currency=material_in.cost_currency,
        cost=material_in.cost,
        default_margin_percent=material_in.default_margin_percent,
        default_sell_price=default_sell_price,
        is_active=material_in.is_active,
        last_synced_at=func.now(),
    )
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return _serialize_material(db_material, include_commercial=True)


@router.post("/bulk-margin-update")
def bulk_update_material_margin(
    *,
    db: Session = Depends(get_db),
    material_ids: List[str] = Body(..., embed=True),
    margin_percent: float = Body(..., embed=True),
    mode: str = Body("adjust", embed=True),
    current_user: models.User = Depends(require_permissions(PermissionCode.MATERIALS_MANAGE.value)),
) -> Any:
    if not material_ids:
        raise HTTPException(status_code=400, detail="No materials selected")
    if mode not in {"adjust", "replace"}:
        raise HTTPException(status_code=400, detail="Invalid bulk margin mode")

    try:
        margin_delta = Decimal(str(margin_percent))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid margin percent")

    materials = db.query(models.Material).filter(models.Material.id.in_(material_ids)).all()
    if not materials:
        raise HTTPException(status_code=404, detail="Materials not found")

    updated_count = 0
    for material in materials:
        current_margin = Decimal(str(material.default_margin_percent or 0))
        next_margin = margin_delta if mode == "replace" else current_margin + margin_delta
        if next_margin < 0:
            next_margin = Decimal("0")

        material.default_margin_percent = next_margin
        material.default_sell_price = material.cost * (Decimal(1) + (next_margin / Decimal(100)))
        material.last_synced_at = func.now()
        updated_count += 1

    db.commit()

    return {
        "updated": updated_count,
        "margin_percent": str(margin_delta),
        "mode": mode,
    }

@router.get("/", response_model=List[schemas.material.MaterialOperational | schemas.material.MaterialCommercial])
def read_materials(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    category: Optional[str] = None,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.MATERIALS_READ.value,
            PermissionCode.MATERIALS_READ_OPERATIONAL.value,
            PermissionCode.MATERIALS_READ_COMMERCIAL.value,
            PermissionCode.MATERIALS_MANAGE.value,
            PermissionCode.MATERIAL_USAGES_MANAGE.value,
            require_all=False,
        )
    ),
) -> Any:
    if not can_read_materials_operational(db, current_user):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    include_commercial = can_read_materials_commercial(db, current_user)
    query = db.query(models.Material)
    if search:
        query = query.filter(
            (models.Material.name.ilike(f"%{search}%")) |
            (models.Material.erp_code.ilike(f"%{search}%")) |
            (models.Material.barcode.ilike(f"%{search}%"))
        )
    if category:
        query = query.filter(models.Material.category == category)
        
    materials = query.offset(skip).limit(limit).all()
    return [_serialize_material(material, include_commercial=include_commercial) for material in materials]

@router.get(
    "/{material_id}/details",
    response_model=schemas.material.MaterialDetailsOperational | schemas.material.MaterialDetailsCommercial,
)
def read_material_details(
    *,
    db: Session = Depends(get_db),
    material_id: str,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.MATERIALS_READ.value,
            PermissionCode.MATERIALS_READ_OPERATIONAL.value,
            PermissionCode.MATERIALS_READ_COMMERCIAL.value,
            PermissionCode.MATERIALS_MANAGE.value,
            PermissionCode.MATERIAL_USAGES_MANAGE.value,
            require_all=False,
        )
    ),
) -> Any:
    if not can_read_materials_operational(db, current_user):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    include_commercial = can_read_materials_commercial(db, current_user)
    material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    usage_query = (
        apply_offer_visibility_filter(
            db.query(models.OfferLine, models.Offer, models.Client)
            .join(models.Offer, models.OfferLine.offer_id == models.Offer.id)
            .join(models.Client, models.Offer.client_id == models.Client.id),
            permission_codes=resolve_offer_permissions(db, current_user),
            user=current_user,
        )
        .filter(models.OfferLine.material_id == material.id)
        .order_by(models.Offer.created_at.desc(), models.OfferLine.line_no.asc())
    )

    usages = []
    for line, offer, client in usage_query.all():
        usages.append(
            _serialize_material_offer_usage(
                line=line,
                offer=offer,
                client=client,
                include_commercial=include_commercial,
            )
        )

    return {
        **_serialize_material(material, include_commercial=include_commercial),
        "offers": usages,
        "usage_count": len(usages),
    }


@router.get("/{material_id}", response_model=schemas.material.MaterialOperational | schemas.material.MaterialCommercial)
def read_material(
    *,
    db: Session = Depends(get_db),
    material_id: str,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.MATERIALS_READ.value,
            PermissionCode.MATERIALS_READ_OPERATIONAL.value,
            PermissionCode.MATERIALS_READ_COMMERCIAL.value,
            PermissionCode.MATERIALS_MANAGE.value,
            PermissionCode.MATERIAL_USAGES_MANAGE.value,
            require_all=False,
        )
    ),
) -> Any:
    if not can_read_materials_operational(db, current_user):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    include_commercial = can_read_materials_commercial(db, current_user)
    material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return _serialize_material(material, include_commercial=include_commercial)

@router.patch("/{material_id}", response_model=schemas.material.MaterialCommercial)
def update_material(
    *,
    db: Session = Depends(get_db),
    material_id: str,
    material_in: schemas.material.MaterialUpdate,
    current_user: models.User = Depends(require_permissions(PermissionCode.MATERIALS_MANAGE.value)),
) -> Any:
    material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    update_data = material_in.model_dump(exclude_unset=True)
    next_erp_code = update_data.get("erp_code")
    if next_erp_code and next_erp_code != material.erp_code:
        existing = (
            db.query(models.Material)
            .filter(models.Material.erp_code == next_erp_code, models.Material.id != material.id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Material with this ERP code already exists")

    for field, value in update_data.items():
        setattr(material, field, value)
    if material.cost is not None and material.default_margin_percent is not None:
        margin = Decimal(str(material.default_margin_percent))
        material.default_sell_price = material.cost * (Decimal(1) + (margin / Decimal(100)))
    material.last_synced_at = func.now()
    db.add(material)
    db.commit()
    db.refresh(material)
    return _serialize_material(material, include_commercial=True)

@router.post("/import/preview")
def preview_material_import(
    *,
    file: UploadFile = File(...),
    first_row_is_header: bool = Form(True),
    current_user: models.User = Depends(require_permissions(PermissionCode.MATERIALS_MANAGE.value)),
) -> Any:
    columns, rows = read_tabular_upload(file, max_rows=5000, has_header=first_row_is_header)
    return {"columns": columns, "preview": rows, "total_rows": len(rows)}

@router.post("/import/confirm")
def import_materials(
    *,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    mapping: str = Form(...),
    selected_rows: str = Form(...),
    default_margin_percent: Optional[float] = Form(None),
    mode: str = Form("upsert"),
    first_row_is_header: bool = Form(True),
    current_user: models.User = Depends(require_permissions(PermissionCode.MATERIALS_MANAGE.value)),
) -> Any:
    try:
        mapping_dict = json.loads(mapping)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid mapping payload")

    if mode not in ALLOWED_IMPORT_MODES:
        raise HTTPException(status_code=400, detail="Invalid import mode")

    _, rows = read_tabular_upload(file, max_rows=5000, has_header=first_row_is_header)
    selected_row_indexes = parse_selected_row_indexes(selected_rows, len(rows))
    success_count = 0
    skipped_count = 0
    error_count = 0
    errors = []

    def _get(row: dict, field: str) -> Any:
        col = mapping_dict.get(field)
        return row.get(col, "") if col else ""

    for idx, row in enumerate(rows, start=1):
        row_index = idx - 1
        if row_index not in selected_row_indexes:
            continue

        try:
            erp_code = str(_get(row, "erp_code")).strip()
            name = str(_get(row, "name")).strip()
            if not erp_code or not name:
                raise ValueError("Missing required ERP code or name")

            unit = str(_get(row, "unit")).strip() or "pcs"
            cost_raw = _get(row, "cost")
            if cost_raw in (None, ""):
                raise ValueError("Missing cost")
            try:
                cost = Decimal(str(cost_raw))
            except (InvalidOperation, ValueError):
                raise ValueError(f"Invalid cost value: {cost_raw}")

            mapped_margin = default_margin_percent
            if mapped_margin is None:
                margin_raw = _get(row, "default_margin_percent")
                if margin_raw not in (None, ""):
                    mapped_margin = float(margin_raw)

            margin_decimal = Decimal(str(mapped_margin)) if mapped_margin is not None else None
            cost_currency = str(_get(row, "cost_currency")).strip() or "EUR"

            material_data = {
                "erp_code": erp_code,
                "barcode": str(_get(row, "barcode")).strip() or None,
                "name": name,
                "description": str(_get(row, "description")).strip() or None,
                "unit": unit,
                "category": str(_get(row, "category")).strip() or "general",
                "subcategory": str(_get(row, "subcategory")).strip() or None,
                "cost": cost,
                "cost_currency": cost_currency,
                "default_margin_percent": margin_decimal,
                "last_synced_at": func.now(),
            }

            if margin_decimal is not None:
                material_data["default_sell_price"] = cost * (Decimal(1) + (margin_decimal / Decimal(100)))

            existing = (
                db.query(models.Material)
                .filter(models.Material.erp_code == erp_code)
                .first()
            )
            if existing:
                if mode == "error":
                    raise ValueError(f"Material with ERP code '{erp_code}' already exists")
                if mode == "skip":
                    skipped_count += 1
                    continue
                if mode == "rename":
                    material_data["erp_code"] = _build_unique_import_erp_code(db, erp_code)
                    material_data["name"] = _prefix_import_value(name, fallback="material")
                    db_material = models.Material(**material_data)
                    db.add(db_material)
                    db.flush()
                    success_count += 1
                    continue
                if mode == "upsert":
                    for k, v in material_data.items():
                        setattr(existing, k, v)
            else:
                db_material = models.Material(**material_data)
                db.add(db_material)
                db.flush()

            success_count += 1
        except Exception as e:
            error_count += 1
            errors.append(f"Row {idx}: {e}")

    rolled_back = mode == "error" and error_count > 0
    final_success_count = 0 if rolled_back else success_count

    if rolled_back:
        db.rollback()
    else:
        db.commit()

    log = models.MaterialImportLog(
        filename=file.filename,
        imported_by_user_id=current_user.id,
        row_count=len(rows),
        success_count=final_success_count,
        error_count=error_count,
        errors_json=errors,
    )
    db.add(log)
    db.commit()

    return {
        "success": error_count == 0 and not rolled_back,
        "imported": final_success_count,
        "skipped": skipped_count,
        "errors": error_count,
        "error_messages": errors,
        "rolled_back": rolled_back,
    }
