from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.permissions import PermissionCode, require_permissions
from app.database import get_db
from app.services.service_request_service import ServiceRequestService

router = APIRouter()


@router.post("/", response_model=schemas.service_request.ServiceRequest)
def create_equipment_asset(
    *,
    db: Session = Depends(get_db),
    asset_in: schemas.service_request.EquipmentAssetCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.EQUIPMENT_MANAGE.value)),
) -> Any:
    return ServiceRequestService.add_equipment_asset(db, payload=asset_in, current_user=current_user)
