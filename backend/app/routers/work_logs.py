from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.permissions import PermissionCode, require_permissions
from app.database import get_db
from app.services.service_request_service import ServiceRequestService

router = APIRouter()


@router.post("/", response_model=schemas.service_request.ServiceRequest)
def create_work_log(
    *,
    db: Session = Depends(get_db),
    work_log_in: schemas.service_request.WorkLogCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.WORK_LOGS_MANAGE.value)),
) -> Any:
    return ServiceRequestService.add_work_log(db, payload=work_log_in, current_user=current_user)
