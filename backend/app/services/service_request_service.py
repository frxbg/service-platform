from datetime import date, datetime, time, timedelta
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.core.data_visibility import can_read_billing_projects_commercial
from app.core.permissions import PermissionCode, has_permissions
from app.services.audit_service import AuditService
from app.services.service_protocol_service import ServiceProtocolService

WORKDAY_START = time(8, 0)
WORKDAY_END = time(17, 0)

ALLOWED_STATUS_TRANSITIONS: dict[models.ServiceRequestStatus, set[models.ServiceRequestStatus]] = {
    models.ServiceRequestStatus.NEW: {
        models.ServiceRequestStatus.ASSIGNED,
        models.ServiceRequestStatus.PENDING_ACCEPTANCE,
        models.ServiceRequestStatus.CANCELLED,
    },
    models.ServiceRequestStatus.ASSIGNED: {
        models.ServiceRequestStatus.PENDING_ACCEPTANCE,
        models.ServiceRequestStatus.CANCELLED,
    },
    models.ServiceRequestStatus.PENDING_ACCEPTANCE: {
        models.ServiceRequestStatus.ACCEPTED,
        models.ServiceRequestStatus.REJECTED_BY_TECHNICIAN,
        models.ServiceRequestStatus.CANCELLED,
    },
    models.ServiceRequestStatus.ACCEPTED: {
        models.ServiceRequestStatus.IN_PROGRESS,
        models.ServiceRequestStatus.WAITING_PARTS,
        models.ServiceRequestStatus.WAITING_CLIENT,
        models.ServiceRequestStatus.CANCELLED,
    },
    models.ServiceRequestStatus.REJECTED_BY_TECHNICIAN: {
        models.ServiceRequestStatus.PENDING_ACCEPTANCE,
        models.ServiceRequestStatus.CANCELLED,
    },
    models.ServiceRequestStatus.IN_PROGRESS: {
        models.ServiceRequestStatus.WAITING_PARTS,
        models.ServiceRequestStatus.WAITING_CLIENT,
        models.ServiceRequestStatus.COMPLETED,
        models.ServiceRequestStatus.CANCELLED,
    },
    models.ServiceRequestStatus.WAITING_PARTS: {
        models.ServiceRequestStatus.IN_PROGRESS,
        models.ServiceRequestStatus.CANCELLED,
    },
    models.ServiceRequestStatus.WAITING_CLIENT: {
        models.ServiceRequestStatus.IN_PROGRESS,
        models.ServiceRequestStatus.CANCELLED,
    },
    models.ServiceRequestStatus.COMPLETED: {
        models.ServiceRequestStatus.CLOSED,
    },
    models.ServiceRequestStatus.CLOSED: set(),
    models.ServiceRequestStatus.CANCELLED: set(),
}

NON_ACTIVE_REQUEST_STATUSES = {
    models.ServiceRequestStatus.CLOSED,
    models.ServiceRequestStatus.CANCELLED,
}


class ServiceRequestService:
    @staticmethod
    def _base_query(db: Session):
        return (
            db.query(models.ServiceRequest)
            .options(
                selectinload(models.ServiceRequest.client),
                selectinload(models.ServiceRequest.site),
                selectinload(models.ServiceRequest.billing_project),
                selectinload(models.ServiceRequest.responsible_user),
                selectinload(models.ServiceRequest.created_by_user),
                selectinload(models.ServiceRequest.assignments).selectinload(models.ServiceAssignment.technician_user),
                selectinload(models.ServiceRequest.assignments).selectinload(models.ServiceAssignment.assigned_by_user),
                selectinload(models.ServiceRequest.work_logs).selectinload(models.WorkLog.technician_user),
                selectinload(models.ServiceRequest.work_logs).selectinload(models.WorkLog.created_by_user),
                selectinload(models.ServiceRequest.material_usages).selectinload(models.MaterialUsage.material),
                selectinload(models.ServiceRequest.material_usages).selectinload(models.MaterialUsage.warehouse),
                selectinload(models.ServiceRequest.material_usages).selectinload(models.MaterialUsage.technician_user),
                selectinload(models.ServiceRequest.equipment_assets).selectinload(models.EquipmentAsset.client),
                selectinload(models.ServiceRequest.equipment_assets).selectinload(models.EquipmentAsset.site),
                selectinload(models.ServiceRequest.signatures).selectinload(models.ServiceProtocolSignature.signed_by_user),
            )
        )

    @staticmethod
    def generate_request_number(db: Session, reported_at: datetime) -> str:
        year = reported_at.year
        prefix = f"SR-{year}-"
        last_request = (
            db.query(models.ServiceRequest)
            .filter(models.ServiceRequest.request_number.like(f"{prefix}%"))
            .order_by(models.ServiceRequest.request_number.desc())
            .first()
        )
        if not last_request:
            return f"{prefix}0001"

        last_sequence = int(last_request.request_number.split("-")[-1])
        return f"{prefix}{last_sequence + 1:04d}"

    @staticmethod
    def _validate_client_site(db: Session, *, client_id: UUID, site_id: UUID) -> models.ClientSite:
        site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
        if not site:
            raise HTTPException(status_code=400, detail="Selected site does not exist")
        if site.client_id != client_id:
            raise HTTPException(status_code=400, detail="Selected site does not belong to client")
        return site

    @staticmethod
    def _get_user_or_400(db: Session, user_id: UUID) -> models.User:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=400, detail="Selected user does not exist or is inactive")
        return user

    @staticmethod
    def _serialize_reference_user(user: models.User) -> dict:
        return {"id": user.id, "full_name": user.full_name, "email": user.email}

    @staticmethod
    def _serialize_reference_client(client: models.Client) -> dict:
        return {"id": client.id, "name": client.name, "client_number": client.client_number}

    @staticmethod
    def _serialize_reference_site(site: models.ClientSite) -> dict:
        return {
            "id": site.id,
            "site_code": site.site_code,
            "site_name": site.site_name,
            "address": site.address,
        }

    @staticmethod
    def _serialize_reference_billing_project(
        billing_project: models.ClientBillingProject | None,
        *,
        include_commercial: bool,
    ) -> dict | None:
        if not billing_project:
            return None
        payload = {
            "id": billing_project.id,
            "client_id": billing_project.client_id,
            "site_id": billing_project.site_id,
            "project_reference": billing_project.project_reference,
            "project_year": billing_project.project_year,
            "service_type": billing_project.service_type.value if billing_project.service_type else None,
            "payment_mode": billing_project.payment_mode.value if billing_project.payment_mode else None,
            "description": billing_project.description,
            "valid_from": billing_project.valid_from,
            "valid_to": billing_project.valid_to,
            "is_default": billing_project.is_default,
            "is_active": billing_project.is_active,
            "notes": billing_project.notes,
        }
        if include_commercial:
            payload.update(
                {
                    "regular_labor_rate": billing_project.regular_labor_rate,
                    "transport_rate": billing_project.transport_rate,
                }
            )
        return payload

    @staticmethod
    def _can_include_billing_project_commercial(db: Session, current_user: models.User) -> bool:
        return can_read_billing_projects_commercial(db, current_user)

    @staticmethod
    def _get_billing_project_or_400(
        db: Session,
        *,
        billing_project_id: UUID,
        client_id: UUID,
        site_id: UUID,
    ) -> models.ClientBillingProject:
        billing_project = (
            db.query(models.ClientBillingProject)
            .filter(models.ClientBillingProject.id == billing_project_id)
            .first()
        )
        if not billing_project:
            raise HTTPException(status_code=400, detail="Selected billing project does not exist")
        if billing_project.client_id != client_id:
            raise HTTPException(status_code=400, detail="Selected billing project does not belong to client")
        if billing_project.site_id and billing_project.site_id != site_id:
            raise HTTPException(status_code=400, detail="Selected billing project does not match the selected site")
        if not billing_project.is_active:
            raise HTTPException(status_code=400, detail="Selected billing project is inactive")
        return billing_project

    @staticmethod
    def _serialize_request_list_item(
        request: models.ServiceRequest,
        *,
        include_billing_project_commercial: bool,
    ) -> dict:
        assigned_technicians = []
        for assignment in request.assignments or []:
            name = assignment.technician_user.full_name or assignment.technician_user.email
            if name not in assigned_technicians:
                assigned_technicians.append(name)

        return {
            "id": request.id,
            "request_number": request.request_number,
            "client": ServiceRequestService._serialize_reference_client(request.client),
            "site": ServiceRequestService._serialize_reference_site(request.site),
            "billing_project": ServiceRequestService._serialize_reference_billing_project(
                request.billing_project,
                include_commercial=include_billing_project_commercial,
            ),
            "project_reference_snapshot": request.project_reference_snapshot,
            "service_type_snapshot": (
                request.service_type_snapshot.value
                if hasattr(request.service_type_snapshot, "value")
                else request.service_type_snapshot
            ),
            "payment_mode_snapshot": (
                request.payment_mode_snapshot.value
                if hasattr(request.payment_mode_snapshot, "value")
                else request.payment_mode_snapshot
            ),
            "priority": request.priority,
            "status": request.status,
            "responsible_user": ServiceRequestService._serialize_reference_user(request.responsible_user),
            "assigned_technicians": assigned_technicians,
            "reported_at": request.reported_at,
            "created_at": request.created_at,
        }

    @staticmethod
    def _serialize_request_detail(
        request: models.ServiceRequest,
        *,
        include_billing_project_commercial: bool,
    ) -> dict:
        return {
            "id": request.id,
            "request_number": request.request_number,
            "external_order_number": request.external_order_number,
            "source": request.source,
            "client": ServiceRequestService._serialize_reference_client(request.client),
            "site": ServiceRequestService._serialize_reference_site(request.site),
            "billing_project_id": request.billing_project_id,
            "billing_project": ServiceRequestService._serialize_reference_billing_project(
                request.billing_project,
                include_commercial=include_billing_project_commercial,
            ),
            "responsible_user": ServiceRequestService._serialize_reference_user(request.responsible_user),
            "created_by_user": ServiceRequestService._serialize_reference_user(request.created_by_user),
            "reported_problem": request.reported_problem,
            "request_reason_code": request.request_reason_code,
            "repair_type_code": request.repair_type_code,
            "priority": request.priority,
            "status": request.status,
            "reported_at": request.reported_at,
            "created_at": request.created_at,
            "updated_at": request.updated_at,
            "discovered_during_request_id": request.discovered_during_request_id,
            "project_reference_snapshot": request.project_reference_snapshot,
            "service_type_snapshot": (
                request.service_type_snapshot.value
                if hasattr(request.service_type_snapshot, "value")
                else request.service_type_snapshot
            ),
            "payment_mode_snapshot": (
                request.payment_mode_snapshot.value
                if hasattr(request.payment_mode_snapshot, "value")
                else request.payment_mode_snapshot
            ),
            "notes_internal": request.notes_internal,
            "notes_client": request.notes_client,
            "assignments": [
                {
                    "id": assignment.id,
                    "request_id": assignment.request_id,
                    "assignment_status": assignment.assignment_status,
                    "reject_reason": assignment.reject_reason,
                    "assigned_at": assignment.assigned_at,
                    "accepted_at": assignment.accepted_at,
                    "rejected_at": assignment.rejected_at,
                    "is_primary": assignment.is_primary,
                    "technician_user": ServiceRequestService._serialize_reference_user(assignment.technician_user),
                    "assigned_by_user": ServiceRequestService._serialize_reference_user(assignment.assigned_by_user),
                }
                for assignment in request.assignments
            ],
            "work_logs": [
                {
                    "id": log.id,
                    "request_id": log.request_id,
                    "work_date": log.work_date,
                    "time_from": log.time_from,
                    "time_to": log.time_to,
                    "minutes_total": log.minutes_total,
                    "minutes_regular": log.minutes_regular,
                    "minutes_overtime": log.minutes_overtime,
                    "minutes_weekend": log.minutes_weekend,
                    "minutes_holiday": log.minutes_holiday,
                    "activity_description": log.activity_description,
                    "repair_type_code": log.repair_type_code,
                    "technician_user": ServiceRequestService._serialize_reference_user(log.technician_user),
                    "created_by_user": ServiceRequestService._serialize_reference_user(log.created_by_user),
                    "created_at": log.created_at,
                }
                for log in request.work_logs
            ],
            "material_usages": [
                {
                    "id": usage.id,
                    "request_id": usage.request_id,
                    "quantity": usage.quantity,
                    "unit": usage.unit,
                    "notes": usage.notes,
                    "used_at": usage.used_at,
                    "material": {
                        "id": usage.material.id,
                        "erp_code": usage.material.erp_code,
                        "name": usage.material.name,
                        "unit": usage.material.unit,
                    },
                    "warehouse": {
                        "id": usage.warehouse.id,
                        "code": usage.warehouse.code,
                        "name": usage.warehouse.name,
                        "is_active": usage.warehouse.is_active,
                    },
                    "technician_user": ServiceRequestService._serialize_reference_user(usage.technician_user),
                }
                for usage in request.material_usages
            ],
            "equipment_assets": [
                {
                    "id": asset.id,
                    "request_id": asset.request_id,
                    "client": ServiceRequestService._serialize_reference_client(asset.client),
                    "site": ServiceRequestService._serialize_reference_site(asset.site),
                    "equipment_type": asset.equipment_type,
                    "manufacturer": asset.manufacturer,
                    "model": asset.model,
                    "serial_number": asset.serial_number,
                    "asset_tag": asset.asset_tag,
                    "location_note": asset.location_note,
                    "refrigerant": asset.refrigerant,
                    "notes": asset.notes,
                    "is_active": asset.is_active,
                }
                for asset in request.equipment_assets
            ],
        }

    @staticmethod
    def _get_visibility_scope_query(
        db: Session,
        *,
        current_user: models.User,
    ):
        can_read_all = has_permissions(db, current_user, [PermissionCode.SERVICE_REQUESTS_READ_ALL.value])
        can_read_assigned = has_permissions(db, current_user, [PermissionCode.SERVICE_REQUESTS_READ_ASSIGNED.value])
        if not can_read_all and not can_read_assigned:
            raise HTTPException(status_code=403, detail="Not enough permissions")

        query = ServiceRequestService._base_query(db)
        if not can_read_all:
            query = query.join(models.ServiceAssignment).filter(
                models.ServiceAssignment.technician_user_id == current_user.id
            )
        return query

    @staticmethod
    def _deduplicate_requests(requests: list[models.ServiceRequest]) -> list[models.ServiceRequest]:
        unique_requests: list[models.ServiceRequest] = []
        seen_ids: set[UUID] = set()
        for request in requests:
            if request.id in seen_ids:
                continue
            seen_ids.add(request.id)
            unique_requests.append(request)
        return unique_requests

    @staticmethod
    def list_requests(
        db: Session,
        *,
        current_user: models.User,
        search: Optional[str] = None,
        status_filter: Optional[models.ServiceRequestStatus] = None,
        priority: Optional[models.ServiceRequestPriority] = None,
        technician_user_id: Optional[UUID] = None,
        client_id: Optional[UUID] = None,
        site_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> list[dict]:
        query = ServiceRequestService._get_visibility_scope_query(db, current_user=current_user)

        if search:
            search_term = f"%{search.strip()}%"
            query = query.filter(
                (models.ServiceRequest.request_number.ilike(search_term))
                | (models.ServiceRequest.external_order_number.ilike(search_term))
                | (models.ServiceRequest.reported_problem.ilike(search_term))
                | (models.ServiceRequest.client.has(models.Client.name.ilike(search_term)))
                | (models.ServiceRequest.site.has(models.ClientSite.site_code.ilike(search_term)))
                | (models.ServiceRequest.site.has(models.ClientSite.site_name.ilike(search_term)))
            )
        if status_filter:
            query = query.filter(models.ServiceRequest.status == status_filter)
        if priority:
            query = query.filter(models.ServiceRequest.priority == priority)
        if technician_user_id:
            query = query.join(models.ServiceAssignment).filter(
                models.ServiceAssignment.technician_user_id == technician_user_id
            )
        if client_id:
            query = query.filter(models.ServiceRequest.client_id == client_id)
        if site_id:
            query = query.filter(models.ServiceRequest.site_id == site_id)
        if date_from:
            query = query.filter(models.ServiceRequest.reported_at >= datetime.combine(date_from, time.min))
        if date_to:
            query = query.filter(models.ServiceRequest.reported_at < datetime.combine(date_to + timedelta(days=1), time.min))

        include_billing_project_commercial = ServiceRequestService._can_include_billing_project_commercial(
            db,
            current_user,
        )
        requests = ServiceRequestService._deduplicate_requests(
            query.order_by(models.ServiceRequest.reported_at.desc()).all()
        )
        return [
            ServiceRequestService._serialize_request_list_item(
                item,
                include_billing_project_commercial=include_billing_project_commercial,
            )
            for item in requests
        ]

    @staticmethod
    def build_dashboard_summary(
        db: Session,
        *,
        current_user: models.User,
        recent_limit: int = 8,
    ) -> dict:
        include_billing_project_commercial = ServiceRequestService._can_include_billing_project_commercial(
            db,
            current_user,
        )
        requests = ServiceRequestService._deduplicate_requests(
            ServiceRequestService._get_visibility_scope_query(db, current_user=current_user)
            .order_by(models.ServiceRequest.reported_at.desc())
            .all()
        )

        status_breakdown: dict[str, int] = {}
        active_requests = 0
        new_requests = 0
        urgent_requests = 0
        in_progress_requests = 0
        unassigned_requests = 0

        for request in requests:
            status_key = request.status.value if hasattr(request.status, "value") else str(request.status)
            status_breakdown[status_key] = status_breakdown.get(status_key, 0) + 1

            if request.status not in NON_ACTIVE_REQUEST_STATUSES:
                active_requests += 1
            if request.status == models.ServiceRequestStatus.NEW:
                new_requests += 1
            if request.priority == models.ServiceRequestPriority.URGENT and request.status not in NON_ACTIVE_REQUEST_STATUSES:
                urgent_requests += 1
            if request.status == models.ServiceRequestStatus.IN_PROGRESS:
                in_progress_requests += 1
            if not request.assignments:
                unassigned_requests += 1

        return {
            "total_requests": len(requests),
            "active_requests": active_requests,
            "new_requests": new_requests,
            "urgent_requests": urgent_requests,
            "in_progress_requests": in_progress_requests,
            "unassigned_requests": unassigned_requests,
            "status_breakdown": status_breakdown,
            "recent_requests": [
                ServiceRequestService._serialize_request_list_item(
                    request,
                    include_billing_project_commercial=include_billing_project_commercial,
                )
                for request in requests[:recent_limit]
            ],
        }

    @staticmethod
    def get_visible_request(db: Session, *, request_id: UUID, current_user: models.User) -> models.ServiceRequest:
        request = (
            ServiceRequestService._base_query(db)
            .filter(models.ServiceRequest.id == request_id)
            .first()
        )
        if not request:
            raise HTTPException(status_code=404, detail="Service request not found")

        can_read_all = has_permissions(db, current_user, [PermissionCode.SERVICE_REQUESTS_READ_ALL.value])
        can_read_assigned = has_permissions(db, current_user, [PermissionCode.SERVICE_REQUESTS_READ_ASSIGNED.value])
        if can_read_all:
            return request
        if can_read_assigned and any(assignment.technician_user_id == current_user.id for assignment in request.assignments):
            return request
        raise HTTPException(status_code=403, detail="Not enough permissions")

    @staticmethod
    def create_request(
        db: Session,
        *,
        payload: schemas.service_request.ServiceRequestCreate,
        current_user: models.User,
    ) -> dict:
        ServiceRequestService._validate_client_site(db, client_id=payload.client_id, site_id=payload.site_id)
        responsible_user = ServiceRequestService._get_user_or_400(
            db,
            payload.responsible_user_id or current_user.id,
        )
        billing_project = ServiceRequestService._get_billing_project_or_400(
            db,
            billing_project_id=payload.billing_project_id,
            client_id=payload.client_id,
            site_id=payload.site_id,
        )

        if payload.discovered_during_request_id:
            parent_request = db.query(models.ServiceRequest).filter(
                models.ServiceRequest.id == payload.discovered_during_request_id
            ).first()
            if not parent_request:
                raise HTTPException(status_code=400, detail="Referenced parent service request was not found")

        request = models.ServiceRequest(
            request_number=ServiceRequestService.generate_request_number(db, payload.reported_at),
            external_order_number=payload.external_order_number,
            source=payload.source,
            client_id=payload.client_id,
            site_id=payload.site_id,
            billing_project_id=billing_project.id,
            responsible_user_id=responsible_user.id,
            created_by_user_id=current_user.id,
            reported_problem=payload.reported_problem,
            request_reason_code=payload.request_reason_code,
            repair_type_code=payload.repair_type_code,
            priority=payload.priority,
            status=models.ServiceRequestStatus.NEW,
            reported_at=payload.reported_at,
            discovered_during_request_id=payload.discovered_during_request_id,
            project_reference_snapshot=billing_project.project_reference,
            service_type_snapshot=billing_project.service_type,
            payment_mode_snapshot=billing_project.payment_mode,
            notes_internal=payload.notes_internal,
            notes_client=payload.notes_client,
        )
        db.add(request)
        db.flush()
        AuditService.log_event(
            db,
            action="service_request.created",
            entity_type="service_request",
            entity_id=str(request.id),
            actor_user_id=current_user.id,
            details={
                "client_id": str(payload.client_id),
                "site_id": str(payload.site_id),
                "billing_project_id": str(billing_project.id),
                "project_reference_snapshot": billing_project.project_reference,
                "service_type_snapshot": billing_project.service_type.value,
                "payment_mode_snapshot": billing_project.payment_mode.value,
            },
        )
        db.commit()
        return ServiceRequestService._serialize_request_detail(
            ServiceRequestService.get_visible_request(db, request_id=request.id, current_user=current_user),
            include_billing_project_commercial=ServiceRequestService._can_include_billing_project_commercial(
                db,
                current_user,
            ),
        )

    @staticmethod
    def assign_technicians(
        db: Session,
        *,
        request: models.ServiceRequest,
        assignments_in: list[schemas.service_request.ServiceAssignmentCreate],
        current_user: models.User,
    ) -> dict:
        if request.status in {models.ServiceRequestStatus.CLOSED, models.ServiceRequestStatus.CANCELLED}:
            raise HTTPException(status_code=400, detail="Closed or cancelled requests cannot be assigned")
        if not assignments_in:
            raise HTTPException(status_code=400, detail="At least one technician assignment is required")

        technician_ids = [item.technician_user_id for item in assignments_in]
        if len(set(technician_ids)) != len(technician_ids):
            raise HTTPException(status_code=400, detail="Duplicate technician assignment is not allowed")

        if sum(1 for item in assignments_in if item.is_primary) > 1:
            raise HTTPException(status_code=400, detail="Only one primary technician is allowed")

        existing_ids = {assignment.technician_user_id for assignment in request.assignments}
        duplicate_existing = existing_ids.intersection(set(technician_ids))
        if duplicate_existing:
            raise HTTPException(status_code=400, detail="One or more technicians are already assigned")

        for item in assignments_in:
            ServiceRequestService._get_user_or_400(db, item.technician_user_id)
            db.add(
                models.ServiceAssignment(
                    request_id=request.id,
                    technician_user_id=item.technician_user_id,
                    assigned_by_user_id=current_user.id,
                    is_primary=item.is_primary,
                )
            )

        request.status = models.ServiceRequestStatus.PENDING_ACCEPTANCE
        db.add(request)
        AuditService.log_event(
            db,
            action="service_request.assigned",
            entity_type="service_request",
            entity_id=str(request.id),
            actor_user_id=current_user.id,
            details={"technician_ids": [str(item) for item in technician_ids]},
        )
        db.commit()
        return ServiceRequestService._serialize_request_detail(
            ServiceRequestService.get_visible_request(db, request_id=request.id, current_user=current_user),
            include_billing_project_commercial=ServiceRequestService._can_include_billing_project_commercial(
                db,
                current_user,
            ),
        )

    @staticmethod
    def _get_assignment(db: Session, assignment_id: UUID) -> models.ServiceAssignment:
        assignment = (
            db.query(models.ServiceAssignment)
            .options(
                selectinload(models.ServiceAssignment.technician_user),
                selectinload(models.ServiceAssignment.assigned_by_user),
                selectinload(models.ServiceAssignment.request).selectinload(models.ServiceRequest.client),
                selectinload(models.ServiceAssignment.request).selectinload(models.ServiceRequest.site),
            )
            .filter(models.ServiceAssignment.id == assignment_id)
            .first()
        )
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        return assignment

    @staticmethod
    def accept_assignment(db: Session, *, assignment_id: UUID, current_user: models.User) -> dict:
        assignment = ServiceRequestService._get_assignment(db, assignment_id)
        if assignment.technician_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the assigned technician can accept this request")
        if assignment.assignment_status == models.ServiceAssignmentStatus.ACCEPTED:
            raise HTTPException(status_code=400, detail="Assignment has already been accepted")

        assignment.assignment_status = models.ServiceAssignmentStatus.ACCEPTED
        assignment.accepted_at = datetime.utcnow()
        assignment.reject_reason = None
        assignment.request.status = models.ServiceRequestStatus.ACCEPTED
        db.add(assignment)
        db.add(assignment.request)
        AuditService.log_event(
            db,
            action="service_assignment.accepted",
            entity_type="service_assignment",
            entity_id=str(assignment.id),
            actor_user_id=current_user.id,
            details={"request_id": str(assignment.request_id)},
        )
        db.commit()
        return ServiceRequestService._serialize_request_detail(
            ServiceRequestService.get_visible_request(db, request_id=assignment.request_id, current_user=current_user),
            include_billing_project_commercial=ServiceRequestService._can_include_billing_project_commercial(
                db,
                current_user,
            ),
        )

    @staticmethod
    def reject_assignment(
        db: Session,
        *,
        assignment_id: UUID,
        current_user: models.User,
        reject_reason: Optional[str],
    ) -> dict:
        assignment = ServiceRequestService._get_assignment(db, assignment_id)
        if assignment.technician_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the assigned technician can reject this request")
        if not reject_reason:
            raise HTTPException(status_code=400, detail="Reject reason is required")

        assignment.assignment_status = models.ServiceAssignmentStatus.REJECTED
        assignment.rejected_at = datetime.utcnow()
        assignment.reject_reason = reject_reason
        request = assignment.request
        other_statuses = {
            item.assignment_status for item in request.assignments if item.id != assignment.id
        }
        if models.ServiceAssignmentStatus.ACCEPTED in other_statuses:
            request.status = models.ServiceRequestStatus.ACCEPTED
        elif models.ServiceAssignmentStatus.PENDING in other_statuses:
            request.status = models.ServiceRequestStatus.PENDING_ACCEPTANCE
        else:
            request.status = models.ServiceRequestStatus.REJECTED_BY_TECHNICIAN

        db.add(assignment)
        db.add(request)
        AuditService.log_event(
            db,
            action="service_assignment.rejected",
            entity_type="service_assignment",
            entity_id=str(assignment.id),
            actor_user_id=current_user.id,
            details={"request_id": str(assignment.request_id), "reject_reason": reject_reason},
        )
        db.commit()
        return ServiceRequestService._serialize_request_detail(
            ServiceRequestService.get_visible_request(db, request_id=assignment.request_id, current_user=current_user),
            include_billing_project_commercial=ServiceRequestService._can_include_billing_project_commercial(
                db,
                current_user,
            ),
        )

    @staticmethod
    def change_status(
        db: Session,
        *,
        request: models.ServiceRequest,
        target_status: models.ServiceRequestStatus,
        current_user: models.User,
    ) -> dict:
        allowed_targets = ALLOWED_STATUS_TRANSITIONS.get(request.status, set())
        if target_status not in allowed_targets:
            raise HTTPException(
                status_code=400,
                detail=f"Status transition from {request.status} to {target_status} is not allowed",
            )
        request.status = target_status
        db.add(request)
        AuditService.log_event(
            db,
            action="service_request.status_changed",
            entity_type="service_request",
            entity_id=str(request.id),
            actor_user_id=current_user.id,
            details={"status": target_status.value},
        )
        db.commit()
        return ServiceRequestService._serialize_request_detail(
            ServiceRequestService.get_visible_request(db, request_id=request.id, current_user=current_user),
            include_billing_project_commercial=ServiceRequestService._can_include_billing_project_commercial(
                db,
                current_user,
            ),
        )

    @staticmethod
    def change_billing_project(
        db: Session,
        *,
        request: models.ServiceRequest,
        billing_project_id: UUID,
        reason_for_change: str,
        current_user: models.User,
    ) -> dict:
        if not reason_for_change.strip():
            raise HTTPException(status_code=400, detail="Reason for billing project change is required")

        next_billing_project = ServiceRequestService._get_billing_project_or_400(
            db,
            billing_project_id=billing_project_id,
            client_id=request.client_id,
            site_id=request.site_id,
        )
        previous_billing_project = request.billing_project
        previous_project_reference = request.project_reference_snapshot
        previous_service_type = request.service_type_snapshot
        previous_payment_mode = request.payment_mode_snapshot
        previous_service_type_value = previous_service_type.value if hasattr(previous_service_type, "value") else previous_service_type
        previous_payment_mode_value = previous_payment_mode.value if hasattr(previous_payment_mode, "value") else previous_payment_mode

        request.billing_project_id = next_billing_project.id
        request.project_reference_snapshot = next_billing_project.project_reference
        request.service_type_snapshot = next_billing_project.service_type
        request.payment_mode_snapshot = next_billing_project.payment_mode
        db.add(request)
        AuditService.log_event(
            db,
            action="service_request.billing_project_changed",
            entity_type="service_request",
            entity_id=str(request.id),
            actor_user_id=current_user.id,
            details={
                "old_value": {
                    "billing_project_id": str(previous_billing_project.id) if previous_billing_project else None,
                    "project_reference": previous_billing_project.project_reference if previous_billing_project else previous_project_reference,
                    "service_type": previous_billing_project.service_type.value if previous_billing_project else previous_service_type_value,
                    "payment_mode": previous_billing_project.payment_mode.value if previous_billing_project else previous_payment_mode_value,
                },
                "new_value": {
                    "billing_project_id": str(next_billing_project.id),
                    "project_reference": next_billing_project.project_reference,
                    "service_type": next_billing_project.service_type.value,
                    "payment_mode": next_billing_project.payment_mode.value,
                },
                "reason": reason_for_change.strip(),
            },
        )
        db.commit()
        return ServiceRequestService._serialize_request_detail(
            ServiceRequestService.get_visible_request(db, request_id=request.id, current_user=current_user),
            include_billing_project_commercial=ServiceRequestService._can_include_billing_project_commercial(
                db,
                current_user,
            ),
        )

    @staticmethod
    def _split_minutes_by_category(
        *,
        work_date: date,
        time_from: time,
        time_to: time,
        is_holiday_override: bool,
    ) -> tuple[int, int, int, int, int]:
        if time_to <= time_from:
            raise HTTPException(status_code=400, detail="time_to must be later than time_from")

        start_dt = datetime.combine(work_date, time_from)
        end_dt = datetime.combine(work_date, time_to)
        total_minutes = int((end_dt - start_dt).total_seconds() // 60)

        if is_holiday_override:
            return total_minutes, 0, 0, 0, total_minutes
        if work_date.weekday() >= 5:
            return total_minutes, 0, 0, total_minutes, 0

        regular_start = datetime.combine(work_date, WORKDAY_START)
        regular_end = datetime.combine(work_date, WORKDAY_END)
        overlap_start = max(start_dt, regular_start)
        overlap_end = min(end_dt, regular_end)
        regular_minutes = 0
        if overlap_end > overlap_start:
            regular_minutes = int((overlap_end - overlap_start).total_seconds() // 60)
        overtime_minutes = total_minutes - regular_minutes
        return total_minutes, regular_minutes, overtime_minutes, 0, 0

    @staticmethod
    def add_work_log(
        db: Session,
        *,
        payload: schemas.service_request.WorkLogCreate,
        current_user: models.User,
    ) -> dict:
        request = ServiceRequestService.get_visible_request(db, request_id=payload.request_id, current_user=current_user)
        technician_user_id = payload.technician_user_id or current_user.id

        if technician_user_id != current_user.id and not has_permissions(
            db,
            current_user,
            [PermissionCode.SERVICE_REQUESTS_EDIT.value],
        ):
            raise HTTPException(status_code=403, detail="Not enough permissions to log work for another technician")

        if not any(assignment.technician_user_id == technician_user_id for assignment in request.assignments):
            raise HTTPException(status_code=400, detail="The selected technician is not assigned to this request")

        total_minutes, regular_minutes, overtime_minutes, weekend_minutes, holiday_minutes = (
            ServiceRequestService._split_minutes_by_category(
                work_date=payload.work_date,
                time_from=payload.time_from,
                time_to=payload.time_to,
                is_holiday_override=payload.is_holiday_override,
            )
        )

        work_log = models.WorkLog(
            request_id=request.id,
            technician_user_id=technician_user_id,
            work_date=payload.work_date,
            time_from=payload.time_from,
            time_to=payload.time_to,
            minutes_total=total_minutes,
            minutes_regular=regular_minutes,
            minutes_overtime=overtime_minutes,
            minutes_weekend=weekend_minutes,
            minutes_holiday=holiday_minutes,
            activity_description=payload.activity_description,
            repair_type_code=payload.repair_type_code,
            created_by_user_id=current_user.id,
        )
        db.add(work_log)

        if request.status in {
            models.ServiceRequestStatus.NEW,
            models.ServiceRequestStatus.ASSIGNED,
            models.ServiceRequestStatus.PENDING_ACCEPTANCE,
            models.ServiceRequestStatus.ACCEPTED,
        }:
            request.status = models.ServiceRequestStatus.IN_PROGRESS
            db.add(request)

        db.flush()
        AuditService.log_event(
            db,
            action="work_log.created",
            entity_type="work_log",
            entity_id=str(work_log.id),
            actor_user_id=current_user.id,
            details={"request_id": str(request.id), "technician_user_id": str(technician_user_id)},
        )
        db.commit()
        return ServiceRequestService._serialize_request_detail(
            ServiceRequestService.get_visible_request(db, request_id=request.id, current_user=current_user),
            include_billing_project_commercial=ServiceRequestService._can_include_billing_project_commercial(
                db,
                current_user,
            ),
        )

    @staticmethod
    def add_material_usage(
        db: Session,
        *,
        payload: schemas.service_request.MaterialUsageCreate,
        current_user: models.User,
    ) -> dict:
        request = ServiceRequestService.get_visible_request(db, request_id=payload.request_id, current_user=current_user)
        material = db.query(models.Material).filter(models.Material.id == payload.material_id).first()
        if not material:
            raise HTTPException(status_code=400, detail="Selected material does not exist")
        warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == payload.warehouse_id).first()
        if not warehouse or not warehouse.is_active:
            raise HTTPException(status_code=400, detail="Selected warehouse does not exist or is inactive")

        technician_user_id = payload.technician_user_id or current_user.id
        if not any(assignment.technician_user_id == technician_user_id for assignment in request.assignments):
            raise HTTPException(status_code=400, detail="The selected technician is not assigned to this request")

        usage = models.MaterialUsage(
            request_id=request.id,
            material_id=material.id,
            warehouse_id=warehouse.id,
            technician_user_id=technician_user_id,
            quantity=payload.quantity,
            unit=payload.unit or material.unit,
            notes=payload.notes,
            used_at=payload.used_at or datetime.utcnow(),
        )
        db.add(usage)
        db.flush()
        AuditService.log_event(
            db,
            action="material_usage.created",
            entity_type="material_usage",
            entity_id=str(usage.id),
            actor_user_id=current_user.id,
            details={"request_id": str(request.id), "warehouse_id": str(warehouse.id)},
        )
        db.commit()
        return ServiceRequestService._serialize_request_detail(
            ServiceRequestService.get_visible_request(db, request_id=request.id, current_user=current_user),
            include_billing_project_commercial=ServiceRequestService._can_include_billing_project_commercial(
                db,
                current_user,
            ),
        )

    @staticmethod
    def add_equipment_asset(
        db: Session,
        *,
        payload: schemas.service_request.EquipmentAssetCreate,
        current_user: models.User,
    ) -> dict:
        if not payload.request_id:
            raise HTTPException(status_code=400, detail="request_id is required for MVP equipment logging")

        client_id = payload.client_id
        site_id = payload.site_id
        request = ServiceRequestService.get_visible_request(db, request_id=payload.request_id, current_user=current_user)
        client_id = request.client.id
        site_id = request.site.id

        if not client_id or not site_id:
            raise HTTPException(status_code=400, detail="client_id and site_id are required when request_id is not provided")

        ServiceRequestService._validate_client_site(db, client_id=client_id, site_id=site_id)
        asset = models.EquipmentAsset(
            request_id=request.id if request else payload.request_id,
            client_id=client_id,
            site_id=site_id,
            equipment_type=payload.equipment_type,
            manufacturer=payload.manufacturer,
            model=payload.model,
            serial_number=payload.serial_number,
            asset_tag=payload.asset_tag,
            location_note=payload.location_note,
            refrigerant=payload.refrigerant,
            notes=payload.notes,
            is_active=payload.is_active,
        )
        db.add(asset)
        db.flush()
        AuditService.log_event(
            db,
            action="equipment_asset.created",
            entity_type="equipment_asset",
            entity_id=str(asset.id),
            actor_user_id=current_user.id,
            details={"request_id": str(payload.request_id) if payload.request_id else None},
        )
        db.commit()
        return ServiceRequestService._serialize_request_detail(
            ServiceRequestService.get_visible_request(db, request_id=request.id, current_user=current_user),
            include_billing_project_commercial=ServiceRequestService._can_include_billing_project_commercial(
                db,
                current_user,
            ),
        )

    @staticmethod
    def build_protocol_preview(
        db: Session,
        *,
        request_id: UUID,
        current_user: models.User,
    ) -> dict:
        request = ServiceRequestService.get_visible_request(db, request_id=request_id, current_user=current_user)
        return ServiceProtocolService.build_preview(request)
