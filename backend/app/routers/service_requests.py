from datetime import date
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.data_visibility import can_read_billing_projects_commercial
from app.core.permissions import PermissionCode, require_permissions
from app.database import get_db
from app.services.service_request_service import ServiceRequestService

router = APIRouter()


@router.get("/", response_model=list[schemas.service_request.ServiceRequestListItem])
def read_service_requests(
    db: Session = Depends(get_db),
    search: Optional[str] = None,
    status: Optional[models.ServiceRequestStatus] = None,
    priority: Optional[models.ServiceRequestPriority] = None,
    technician_user_id: Optional[UUID] = None,
    client_id: Optional[UUID] = None,
    site_id: Optional[UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.SERVICE_REQUESTS_READ_ALL.value,
            PermissionCode.SERVICE_REQUESTS_READ_ASSIGNED.value,
            require_all=False,
        )
    ),
) -> Any:
    return ServiceRequestService.list_requests(
        db,
        current_user=current_user,
        search=search,
        status_filter=status,
        priority=priority,
        technician_user_id=technician_user_id,
        client_id=client_id,
        site_id=site_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.post("/", response_model=schemas.service_request.ServiceRequest)
def create_service_request(
    *,
    db: Session = Depends(get_db),
    request_in: schemas.service_request.ServiceRequestCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.SERVICE_REQUESTS_CREATE.value)),
) -> Any:
    return ServiceRequestService.create_request(db, payload=request_in, current_user=current_user)


@router.get("/dashboard-summary", response_model=schemas.service_request.ServiceRequestDashboardSummary)
def read_service_request_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.SERVICE_REQUESTS_READ_ALL.value,
            PermissionCode.SERVICE_REQUESTS_READ_ASSIGNED.value,
            require_all=False,
        )
    ),
) -> Any:
    return ServiceRequestService.build_dashboard_summary(db, current_user=current_user)


@router.get("/{request_id}", response_model=schemas.service_request.ServiceRequest)
def read_service_request(
    *,
    db: Session = Depends(get_db),
    request_id: UUID,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.SERVICE_REQUESTS_READ_ALL.value,
            PermissionCode.SERVICE_REQUESTS_READ_ASSIGNED.value,
            require_all=False,
        )
    ),
) -> Any:
    request = ServiceRequestService.get_visible_request(db, request_id=request_id, current_user=current_user)
    return ServiceRequestService._serialize_request_detail(
        request,
        include_billing_project_commercial=ServiceRequestService._can_include_billing_project_commercial(
            db,
            current_user,
        ),
    )


@router.get(
    "/{request_id}/billing-project-options",
    response_model=list[schemas.client.ClientBillingProjectOperational | schemas.client.ClientBillingProjectCommercial],
)
def read_service_request_billing_project_options(
    *,
    db: Session = Depends(get_db),
    request_id: UUID,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.SERVICE_REQUESTS_READ_ALL.value,
            PermissionCode.SERVICE_REQUESTS_READ_ASSIGNED.value,
            PermissionCode.SERVICE_REQUESTS_EDIT.value,
            require_all=False,
        )
    ),
) -> Any:
    request = ServiceRequestService.get_visible_request(db, request_id=request_id, current_user=current_user)
    projects = (
        db.query(models.ClientBillingProject)
        .filter(
            models.ClientBillingProject.client_id == request.client_id,
            models.ClientBillingProject.is_active.is_(True),
            (models.ClientBillingProject.site_id.is_(None) | (models.ClientBillingProject.site_id == request.site_id)),
        )
        .order_by(models.ClientBillingProject.is_default.desc(), models.ClientBillingProject.project_reference.asc())
        .all()
    )
    include_commercial = can_read_billing_projects_commercial(db, current_user)
    return [
        {
            "id": project.id,
            "client_id": project.client_id,
            "site_id": project.site_id,
            "project_reference": project.project_reference,
            "project_year": project.project_year,
            "service_type": project.service_type.value if project.service_type else None,
            "payment_mode": project.payment_mode.value if project.payment_mode else None,
            "description": project.description,
            "valid_from": project.valid_from,
            "valid_to": project.valid_to,
            "is_default": project.is_default,
            "is_active": project.is_active,
            "notes": project.notes,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            **(
                {
                    "regular_labor_rate": project.regular_labor_rate,
                    "transport_rate": project.transport_rate,
                }
                if include_commercial
                else {}
            ),
        }
        for project in projects
    ]


@router.post("/{request_id}/assignments", response_model=schemas.service_request.ServiceRequest)
def assign_service_request(
    *,
    db: Session = Depends(get_db),
    request_id: UUID,
    assignments_in: list[schemas.service_request.ServiceAssignmentCreate],
    current_user: models.User = Depends(require_permissions(PermissionCode.SERVICE_REQUESTS_ASSIGN.value)),
) -> Any:
    request = ServiceRequestService.get_visible_request(db, request_id=request_id, current_user=current_user)
    return ServiceRequestService.assign_technicians(
        db,
        request=request,
        assignments_in=assignments_in,
        current_user=current_user,
    )


@router.post("/{request_id}/status", response_model=schemas.service_request.ServiceRequest)
def update_service_request_status(
    *,
    db: Session = Depends(get_db),
    request_id: UUID,
    payload: schemas.service_request.ServiceRequestStatusUpdate,
    current_user: models.User = Depends(require_permissions(PermissionCode.SERVICE_REQUESTS_EDIT.value)),
) -> Any:
    request = ServiceRequestService.get_visible_request(db, request_id=request_id, current_user=current_user)
    return ServiceRequestService.change_status(
        db,
        request=request,
        target_status=payload.status,
        current_user=current_user,
    )


@router.post("/{request_id}/billing-project", response_model=schemas.service_request.ServiceRequest)
def update_service_request_billing_project(
    *,
    db: Session = Depends(get_db),
    request_id: UUID,
    payload: schemas.service_request.ServiceRequestBillingProjectUpdate,
    current_user: models.User = Depends(require_permissions(PermissionCode.SERVICE_REQUESTS_EDIT.value)),
) -> Any:
    request = ServiceRequestService.get_visible_request(db, request_id=request_id, current_user=current_user)
    return ServiceRequestService.change_billing_project(
        db,
        request=request,
        billing_project_id=payload.billing_project_id,
        reason_for_change=payload.reason_for_change,
        current_user=current_user,
    )
