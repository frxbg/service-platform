from typing import Any
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.permissions import PermissionCode, require_permissions
from app.database import get_db
from app.services.audit_service import AuditService
from app.services.pdf_service import PDFService
from app.services.service_request_service import ServiceRequestService

router = APIRouter()


def _build_content_disposition(filename: str) -> str:
    cleaned = filename.replace("\r", "").replace("\n", "").replace('"', "")
    try:
        cleaned.encode("ascii")
        return f'attachment; filename="{cleaned}"'
    except UnicodeEncodeError:
        fallback = "service_protocol.pdf"
        return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(cleaned)}"


@router.get("/{request_id}/preview", response_model=schemas.service_request.ServiceProtocolPreview)
def preview_service_protocol(
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
    return ServiceRequestService.build_protocol_preview(
        db,
        request_id=request_id,
        current_user=current_user,
    )


@router.get("/{request_id}/pdf")
def export_service_protocol_pdf(
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
    pdf_service = PDFService()
    pdf_bytes = pdf_service.generate_service_protocol_pdf(db, request)
    AuditService.log_event(
        db,
        action="service_protocol.generated",
        entity_type="service_request",
        entity_id=str(request.id),
        actor_user_id=current_user.id,
        details={"request_number": request.request_number},
    )
    db.commit()
    filename = f"service_protocol_{request.request_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": _build_content_disposition(filename)},
    )
