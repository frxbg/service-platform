from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.permissions import PermissionCode, require_permissions
from app.database import get_db
from app.services.service_request_service import ServiceRequestService

router = APIRouter()


@router.post("/", response_model=schemas.service_request.ServiceRequest)
def create_material_usage(
    *,
    db: Session = Depends(get_db),
    usage_in: schemas.service_request.MaterialUsageCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.MATERIAL_USAGES_MANAGE.value)),
) -> Any:
    return ServiceRequestService.add_material_usage(db, payload=usage_in, current_user=current_user)
