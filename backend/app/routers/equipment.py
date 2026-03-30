import json
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.core.permissions import PermissionCode, require_permissions
from app.database import get_db
from app.services.service_request_service import ServiceRequestService
from app.utils.import_utils import parse_selected_row_indexes, read_tabular_upload

router = APIRouter()

ALLOWED_IMPORT_MODES = {"upsert", "skip", "error"}


def _clean_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def _normalize(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _parse_optional_bool(value: Any, default: bool = True) -> bool:
    if value in (None, ""):
        return default
    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y", "да", "active", "активен"}:
        return True
    if normalized in {"0", "false", "no", "n", "не", "inactive", "неактивен"}:
        return False
    raise ValueError(f"Invalid active value: {value}")


def _list_query(db: Session):
    return (
        db.query(models.EquipmentAsset)
        .options(
            selectinload(models.EquipmentAsset.client),
            selectinload(models.EquipmentAsset.site),
        )
    )


def _get_site_or_404(db: Session, *, site_id: UUID) -> models.ClientSite:
    site = (
        db.query(models.ClientSite)
        .options(selectinload(models.ClientSite.client))
        .filter(models.ClientSite.id == site_id)
        .first()
    )
    if not site:
        raise HTTPException(status_code=404, detail="Client site not found")
    return site


def _find_existing_asset(
    db: Session,
    *,
    site_id: UUID,
    equipment_type: str,
    manufacturer: Optional[str],
    model: Optional[str],
    serial_number: Optional[str],
    asset_tag: Optional[str],
    location_note: Optional[str],
    exclude_id: Optional[UUID] = None,
) -> Optional[models.EquipmentAsset]:
    query = db.query(models.EquipmentAsset).filter(models.EquipmentAsset.site_id == site_id)
    if exclude_id:
        query = query.filter(models.EquipmentAsset.id != exclude_id)

    normalized_serial = _normalize(serial_number)
    if normalized_serial:
        return (
            query.filter(func.lower(func.coalesce(models.EquipmentAsset.serial_number, "")) == normalized_serial)
            .order_by(models.EquipmentAsset.is_active.desc())
            .first()
        )

    normalized_asset_tag = _normalize(asset_tag)
    if normalized_asset_tag:
        return (
            query.filter(func.lower(func.coalesce(models.EquipmentAsset.asset_tag, "")) == normalized_asset_tag)
            .order_by(models.EquipmentAsset.is_active.desc())
            .first()
        )

    return (
        query.filter(
            func.lower(func.coalesce(models.EquipmentAsset.equipment_type, "")) == _normalize(equipment_type),
            func.lower(func.coalesce(models.EquipmentAsset.manufacturer, "")) == _normalize(manufacturer),
            func.lower(func.coalesce(models.EquipmentAsset.model, "")) == _normalize(model),
            func.lower(func.coalesce(models.EquipmentAsset.location_note, "")) == _normalize(location_note),
        )
        .order_by(models.EquipmentAsset.is_active.desc())
        .first()
    )


@router.get(
    "/sites/{site_id}",
    response_model=list[schemas.service_request.EquipmentAsset],
)
def list_site_equipment_assets(
    *,
    db: Session = Depends(get_db),
    site_id: UUID,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.CLIENTS_READ.value,
            PermissionCode.CLIENTS_MANAGE.value,
            PermissionCode.SERVICE_REQUESTS_READ_ALL.value,
            PermissionCode.SERVICE_REQUESTS_READ_ASSIGNED.value,
            PermissionCode.EQUIPMENT_MANAGE.value,
            require_all=False,
        )
    ),
) -> list[models.EquipmentAsset]:
    _ = current_user
    _get_site_or_404(db, site_id=site_id)
    return (
        _list_query(db)
        .filter(models.EquipmentAsset.site_id == site_id)
        .order_by(
            models.EquipmentAsset.is_active.desc(),
            models.EquipmentAsset.equipment_type.asc(),
            models.EquipmentAsset.manufacturer.asc(),
            models.EquipmentAsset.model.asc(),
            models.EquipmentAsset.serial_number.asc(),
        )
        .all()
    )


@router.post(
    "/sites/{site_id}",
    response_model=schemas.service_request.EquipmentAsset,
)
def create_site_equipment_asset(
    *,
    db: Session = Depends(get_db),
    site_id: UUID,
    payload: schemas.service_request.EquipmentAssetCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.EQUIPMENT_MANAGE.value)),
) -> models.EquipmentAsset:
    _ = current_user
    site = _get_site_or_404(db, site_id=site_id)
    equipment_type = payload.equipment_type.strip()
    if not equipment_type:
        raise HTTPException(status_code=400, detail="equipment_type is required")

    asset = models.EquipmentAsset(
        request_id=None,
        client_id=site.client_id,
        site_id=site.id,
        equipment_type=equipment_type,
        manufacturer=_clean_text(payload.manufacturer),
        model=_clean_text(payload.model),
        serial_number=_clean_text(payload.serial_number),
        asset_tag=_clean_text(payload.asset_tag),
        location_note=_clean_text(payload.location_note),
        refrigerant=_clean_text(payload.refrigerant),
        notes=_clean_text(payload.notes),
        is_active=payload.is_active,
    )
    db.add(asset)
    db.commit()
    return (
        _list_query(db)
        .filter(models.EquipmentAsset.id == asset.id)
        .first()
    )


@router.patch(
    "/{asset_id}",
    response_model=schemas.service_request.EquipmentAsset,
)
def update_equipment_asset(
    *,
    db: Session = Depends(get_db),
    asset_id: UUID,
    payload: schemas.service_request.EquipmentAssetUpdate,
    current_user: models.User = Depends(require_permissions(PermissionCode.EQUIPMENT_MANAGE.value)),
) -> models.EquipmentAsset:
    _ = current_user
    asset = _list_query(db).filter(models.EquipmentAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Equipment asset not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "equipment_type" in update_data and update_data["equipment_type"] is not None:
        update_data["equipment_type"] = update_data["equipment_type"].strip()
        if not update_data["equipment_type"]:
            raise HTTPException(status_code=400, detail="equipment_type is required")

    for field in (
        "manufacturer",
        "model",
        "serial_number",
        "asset_tag",
        "location_note",
        "refrigerant",
        "notes",
    ):
        if field in update_data:
            update_data[field] = _clean_text(update_data[field])

    for field, value in update_data.items():
        setattr(asset, field, value)

    db.add(asset)
    db.commit()
    return (
        _list_query(db)
        .filter(models.EquipmentAsset.id == asset.id)
        .first()
    )


@router.post("/sites/{site_id}/import/preview")
def preview_site_equipment_import(
    *,
    site_id: UUID,
    file: UploadFile = File(...),
    first_row_is_header: bool = Form(True),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permissions(PermissionCode.EQUIPMENT_MANAGE.value)),
) -> Any:
    _ = current_user
    _get_site_or_404(db, site_id=site_id)
    columns, rows = read_tabular_upload(file, max_rows=5000, has_header=first_row_is_header)
    return {"columns": columns, "preview": rows, "total_rows": len(rows)}


@router.post("/sites/{site_id}/import/confirm")
def import_site_equipment_assets(
    *,
    db: Session = Depends(get_db),
    site_id: UUID,
    file: UploadFile = File(...),
    mapping: str = Form(...),
    selected_rows: str = Form(...),
    mode: str = Form("upsert"),
    first_row_is_header: bool = Form(True),
    current_user: models.User = Depends(require_permissions(PermissionCode.EQUIPMENT_MANAGE.value)),
) -> Any:
    _ = current_user
    site = _get_site_or_404(db, site_id=site_id)

    try:
        mapping_dict = json.loads(mapping)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid mapping payload") from exc

    if mode not in ALLOWED_IMPORT_MODES:
        raise HTTPException(status_code=400, detail="Invalid import mode")

    _, rows = read_tabular_upload(file, max_rows=5000, has_header=first_row_is_header)
    selected_row_indexes = parse_selected_row_indexes(selected_rows, len(rows))
    success_count = 0
    skipped_count = 0
    error_count = 0
    errors: list[str] = []

    def _get(row: dict, field: str) -> Any:
        column = mapping_dict.get(field)
        return row.get(column, "") if column else ""

    for idx, row in enumerate(rows, start=1):
        row_index = idx - 1
        if row_index not in selected_row_indexes:
            continue

        try:
            equipment_type = _clean_text(_get(row, "equipment_type"))
            if not equipment_type:
                raise ValueError("Missing required equipment type")

            manufacturer = _clean_text(_get(row, "manufacturer"))
            model = _clean_text(_get(row, "model"))
            serial_number = _clean_text(_get(row, "serial_number"))
            asset_tag = _clean_text(_get(row, "asset_tag"))
            location_note = _clean_text(_get(row, "location_note"))
            refrigerant = _clean_text(_get(row, "refrigerant"))
            notes = _clean_text(_get(row, "notes"))
            is_active = _parse_optional_bool(_get(row, "is_active"), default=True)

            existing = _find_existing_asset(
                db,
                site_id=site.id,
                equipment_type=equipment_type,
                manufacturer=manufacturer,
                model=model,
                serial_number=serial_number,
                asset_tag=asset_tag,
                location_note=location_note,
            )

            if existing:
                if mode == "error":
                    raise ValueError("Matching equipment already exists for this site")
                if mode == "skip":
                    skipped_count += 1
                    continue

                existing.equipment_type = equipment_type
                existing.manufacturer = manufacturer
                existing.model = model
                existing.serial_number = serial_number
                existing.asset_tag = asset_tag
                existing.location_note = location_note
                existing.refrigerant = refrigerant
                existing.notes = notes
                existing.is_active = is_active
                db.add(existing)
                db.flush()
                success_count += 1
                continue

            asset = models.EquipmentAsset(
                request_id=None,
                client_id=site.client_id,
                site_id=site.id,
                equipment_type=equipment_type,
                manufacturer=manufacturer,
                model=model,
                serial_number=serial_number,
                asset_tag=asset_tag,
                location_note=location_note,
                refrigerant=refrigerant,
                notes=notes,
                is_active=is_active,
            )
            db.add(asset)
            db.flush()
            success_count += 1
        except Exception as exc:
            error_count += 1
            errors.append(f"Row {idx}: {exc}")

    rolled_back = mode == "error" and error_count > 0
    final_success_count = 0 if rolled_back else success_count

    if rolled_back:
        db.rollback()
    else:
        db.commit()

    return {
        "success": error_count == 0 and not rolled_back,
        "imported": final_success_count,
        "skipped": skipped_count,
        "errors": error_count,
        "error_messages": errors,
        "rolled_back": rolled_back,
    }


@router.post("/", response_model=schemas.service_request.ServiceRequest)
def create_equipment_asset(
    *,
    db: Session = Depends(get_db),
    asset_in: schemas.service_request.EquipmentAssetCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.EQUIPMENT_MANAGE.value)),
) -> Any:
    return ServiceRequestService.add_equipment_asset(db, payload=asset_in, current_user=current_user)
