from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app import models, schemas
from app.core import deps
from app.database import get_db
from app.services.mobile_request_service import MobileRequestService

router = APIRouter()


@router.get("/requests/workboard", response_model=schemas.mobile.MobileWorkboardResponse)
def read_mobile_workboard(
    db: Session = Depends(get_db),
    search: Optional[str] = None,
    status: Optional[models.ServiceRequestStatus] = None,
    priority: Optional[models.ServiceRequestPriority] = None,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    return MobileRequestService.list_workboard(
        db,
        current_user=current_user,
        search=search,
        status_filter=status,
        priority_filter=priority,
    )


@router.get("/requests/{request_id}", response_model=schemas.mobile.MobileRequestDetail)
def read_mobile_request_detail(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    return MobileRequestService.get_request_detail(
        db,
        request_id=request_id,
        current_user=current_user,
    )


@router.post("/requests/{request_id}/accept", response_model=schemas.mobile.MobileAcceptRequestResponse)
def accept_or_self_claim_mobile_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    return {
        "request": MobileRequestService.accept_or_self_claim(
            db,
            request_id=request_id,
            current_user=current_user,
        )
    }


@router.post("/requests/{request_id}/reject", response_model=schemas.mobile.MobileRequestMutationResponse)
def reject_mobile_request(
    request_id: UUID,
    payload: schemas.mobile.MobileRequestAction,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    return {
        "request": MobileRequestService.reject_request(
            db,
            request_id=request_id,
            current_user=current_user,
            reject_reason=(payload.reject_reason or "").strip(),
        )
    }


@router.post("/requests/{request_id}/start-work", response_model=schemas.mobile.MobileRequestMutationResponse)
def start_mobile_request_work(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    return {
        "request": MobileRequestService.start_work(
            db,
            request_id=request_id,
            current_user=current_user,
        )
    }


@router.post("/requests/{request_id}/work-logs", response_model=schemas.mobile.MobileRequestMutationResponse)
def create_mobile_work_log(
    request_id: UUID,
    payload: schemas.mobile.MobileWorkLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    return {
        "request": MobileRequestService.add_work_log(
            db,
            request_id=request_id,
            payload=payload,
            current_user=current_user,
        )
    }


@router.post("/requests/{request_id}/material-usages", response_model=schemas.mobile.MobileRequestMutationResponse)
def create_mobile_material_usage(
    request_id: UUID,
    payload: schemas.mobile.MobileMaterialUsageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    return {
        "request": MobileRequestService.add_material_usage(
            db,
            request_id=request_id,
            payload=payload,
            current_user=current_user,
        )
    }


@router.get("/materials", response_model=list[schemas.mobile.MobileMaterialOption])
def read_mobile_material_options(
    db: Session = Depends(get_db),
    search: Optional[str] = None,
    limit: int = 20,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    return MobileRequestService.list_material_options(
        db,
        current_user=current_user,
        search=search,
        limit=limit,
    )


@router.get("/warehouses", response_model=list[schemas.mobile.MobileWarehouseOption])
def read_mobile_warehouse_options(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    return MobileRequestService.list_warehouse_options(
        db,
        current_user=current_user,
    )


@router.post("/requests/{request_id}/signatures", response_model=schemas.mobile.MobileRequestMutationResponse)
def save_mobile_request_signature(
    request_id: UUID,
    payload: schemas.mobile.MobileSignatureCreate,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    return {
        "request": MobileRequestService.save_signature(
            db,
            request_id=request_id,
            payload=payload,
            current_user=current_user,
            ip_address=http_request.client.host if http_request.client else None,
        )
    }


@router.post("/requests/{request_id}/complete", response_model=schemas.mobile.MobileRequestMutationResponse)
def complete_mobile_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    return {
        "request": MobileRequestService.complete_request(
            db,
            request_id=request_id,
            current_user=current_user,
        )
    }
