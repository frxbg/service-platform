from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.permissions import PermissionCode, require_permissions
from app.database import get_db
from app.services.service_request_service import ServiceRequestService

router = APIRouter()


@router.post("/{assignment_id}/accept", response_model=schemas.service_request.ServiceRequest)
def accept_assignment(
    *,
    db: Session = Depends(get_db),
    assignment_id: UUID,
    current_user: models.User = Depends(require_permissions(PermissionCode.SERVICE_REQUESTS_ACCEPT.value)),
) -> Any:
    return ServiceRequestService.accept_assignment(db, assignment_id=assignment_id, current_user=current_user)


@router.post("/{assignment_id}/reject", response_model=schemas.service_request.ServiceRequest)
def reject_assignment(
    *,
    db: Session = Depends(get_db),
    assignment_id: UUID,
    payload: schemas.service_request.ServiceAssignmentAction,
    current_user: models.User = Depends(require_permissions(PermissionCode.SERVICE_REQUESTS_REJECT.value)),
) -> Any:
    return ServiceRequestService.reject_assignment(
        db,
        assignment_id=assignment_id,
        current_user=current_user,
        reject_reason=payload.reject_reason,
    )
