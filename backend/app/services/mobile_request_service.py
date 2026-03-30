from datetime import datetime
from decimal import Decimal
import math
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.core.permissions import PermissionCode, has_permissions
from app.services.audit_service import AuditService
from app.services.service_request_service import ServiceRequestService


ACTIVE_ASSIGNMENT_STATUSES = {
    models.ServiceAssignmentStatus.PENDING,
    models.ServiceAssignmentStatus.ACCEPTED,
}

TERMINAL_REQUEST_STATUSES = {
    models.ServiceRequestStatus.CLOSED,
    models.ServiceRequestStatus.CANCELLED,
}

PRIORITY_SORT = {
    models.ServiceRequestPriority.URGENT: 0,
    models.ServiceRequestPriority.HIGH: 1,
    models.ServiceRequestPriority.STANDARD: 2,
    models.ServiceRequestPriority.LOW: 3,
}

GROUP_SORT = {
    "assigned_to_me": 0,
    "available": 1,
    "other": 2,
}

COMPLETABLE_REQUEST_STATUSES = {
    models.ServiceRequestStatus.ACCEPTED,
    models.ServiceRequestStatus.IN_PROGRESS,
    models.ServiceRequestStatus.WAITING_PARTS,
    models.ServiceRequestStatus.WAITING_CLIENT,
}


class MobileRequestService:
    @staticmethod
    def _to_decimal_coordinate(value: Optional[float]) -> Optional[Decimal]:
        if value is None:
            return None
        return Decimal(f"{value:.6f}")

    @staticmethod
    def _to_decimal_distance(value: Optional[float]) -> Optional[Decimal]:
        if value is None:
            return None
        return Decimal(f"{value:.2f}")

    @staticmethod
    def _estimate_distance_km(
        start_latitude: Optional[Decimal],
        start_longitude: Optional[Decimal],
        end_latitude: Optional[Decimal],
        end_longitude: Optional[Decimal],
    ) -> Optional[Decimal]:
        if None in {start_latitude, start_longitude, end_latitude, end_longitude}:
            return None

        lat1 = math.radians(float(start_latitude))
        lon1 = math.radians(float(start_longitude))
        lat2 = math.radians(float(end_latitude))
        lon2 = math.radians(float(end_longitude))
        d_lat = lat2 - lat1
        d_lon = lon2 - lon1
        a = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return MobileRequestService._to_decimal_distance(6371.0 * c)

    @staticmethod
    def _get_my_active_travel_log(
        request: models.ServiceRequest,
        current_user: models.User,
    ) -> Optional[models.ServiceTravelLog]:
        active_logs = [
            log
            for log in (request.travel_logs or [])
            if log.technician_user_id == current_user.id and log.ended_at is None
        ]
        if not active_logs:
            return None
        active_logs.sort(key=lambda item: (item.started_at or datetime.min, item.created_at or datetime.min), reverse=True)
        return active_logs[0]

    @staticmethod
    def _normalize_equipment_value(value: Optional[str]) -> str:
        return (value or "").strip().lower()

    @staticmethod
    def _equipment_key(asset: models.EquipmentAsset) -> str:
        serial = MobileRequestService._normalize_equipment_value(asset.serial_number)
        if serial:
            return f"serial:{serial}"

        asset_tag = MobileRequestService._normalize_equipment_value(asset.asset_tag)
        if asset_tag:
            return f"asset:{asset_tag}"

        composite = "|".join(
            filter(
                None,
                [
                    MobileRequestService._normalize_equipment_value(asset.equipment_type),
                    MobileRequestService._normalize_equipment_value(asset.manufacturer),
                    MobileRequestService._normalize_equipment_value(asset.model),
                    MobileRequestService._normalize_equipment_value(asset.location_note),
                ],
            )
        )
        if composite:
            return f"composite:{composite}"

        return f"id:{asset.id}"

    @staticmethod
    def _equipment_display_name(asset: models.EquipmentAsset) -> str:
        parts = [
            asset.equipment_type,
            asset.manufacturer,
            asset.model,
            asset.serial_number,
            asset.asset_tag,
        ]
        cleaned = [part.strip() for part in parts if part and part.strip()]
        return " / ".join(cleaned) if cleaned else str(asset.id)

    @staticmethod
    def _serialize_signatures(request: models.ServiceRequest) -> list[dict]:
        active_signatures = [signature for signature in (request.signatures or []) if signature.is_active]
        active_signatures.sort(key=lambda item: item.signed_at or item.created_at)
        return [
            {
                "id": signature.id,
                "signer_role": signature.signer_role,
                "signer_name": signature.signer_name,
                "signed_at": signature.signed_at,
                "signature_image_data": signature.signature_image_data,
            }
            for signature in active_signatures
        ]

    @staticmethod
    def _has_required_signatures(request: models.ServiceRequest) -> bool:
        roles = {
            signature.signer_role.value if hasattr(signature.signer_role, "value") else str(signature.signer_role)
            for signature in (request.signatures or [])
            if signature.is_active
        }
        return {"technician", "client"}.issubset(roles)

    @staticmethod
    def _require_permissions(
        db: Session,
        current_user: models.User,
        *permission_codes: str,
        require_all: bool = True,
    ) -> None:
        if not has_permissions(db, current_user, permission_codes, require_all=require_all):
            raise HTTPException(status_code=403, detail="Not enough permissions")

    @staticmethod
    def _assert_mobile_visibility(db: Session, current_user: models.User) -> None:
        can_read_all = has_permissions(db, current_user, [PermissionCode.SERVICE_REQUESTS_READ_ALL.value])
        can_read_assigned = has_permissions(db, current_user, [PermissionCode.SERVICE_REQUESTS_READ_ASSIGNED.value])
        if not can_read_all and not can_read_assigned:
            raise HTTPException(status_code=403, detail="Not enough permissions")

    @staticmethod
    def _get_request_or_404(db: Session, *, request_id: UUID) -> models.ServiceRequest:
        request = MobileRequestService._base_query(db).filter(models.ServiceRequest.id == request_id).first()
        if not request:
            raise HTTPException(status_code=404, detail="Service request not found")
        return request

    @staticmethod
    def _get_my_assignment(
        request: models.ServiceRequest,
        current_user: models.User,
        *,
        include_pending: bool = True,
        include_accepted: bool = True,
    ) -> Optional[models.ServiceAssignment]:
        allowed_statuses: set[models.ServiceAssignmentStatus] = set()
        if include_pending:
            allowed_statuses.add(models.ServiceAssignmentStatus.PENDING)
        if include_accepted:
            allowed_statuses.add(models.ServiceAssignmentStatus.ACCEPTED)

        for assignment in request.assignments or []:
            if assignment.technician_user_id != current_user.id:
                continue
            if assignment.assignment_status in allowed_statuses:
                return assignment
        return None

    @staticmethod
    def _base_query(db: Session):
        return (
            db.query(models.ServiceRequest)
            .options(
                selectinload(models.ServiceRequest.client).selectinload(models.Client.contacts),
                selectinload(models.ServiceRequest.site),
                selectinload(models.ServiceRequest.billing_project),
                selectinload(models.ServiceRequest.responsible_user),
                selectinload(models.ServiceRequest.created_by_user),
                selectinload(models.ServiceRequest.assignments).selectinload(models.ServiceAssignment.technician_user),
                selectinload(models.ServiceRequest.assignments).selectinload(models.ServiceAssignment.assigned_by_user),
                selectinload(models.ServiceRequest.work_logs).selectinload(models.WorkLog.technician_user),
                selectinload(models.ServiceRequest.work_logs).selectinload(models.WorkLog.created_by_user),
                selectinload(models.ServiceRequest.travel_logs).selectinload(models.ServiceTravelLog.technician_user),
                selectinload(models.ServiceRequest.travel_logs).selectinload(models.ServiceTravelLog.created_by_user),
                selectinload(models.ServiceRequest.material_usages).selectinload(models.MaterialUsage.material),
                selectinload(models.ServiceRequest.material_usages).selectinload(models.MaterialUsage.warehouse),
                selectinload(models.ServiceRequest.material_usages).selectinload(models.MaterialUsage.technician_user),
                selectinload(models.ServiceRequest.equipment_assets).selectinload(models.EquipmentAsset.client),
                selectinload(models.ServiceRequest.equipment_assets).selectinload(models.EquipmentAsset.site),
                selectinload(models.ServiceRequest.signatures).selectinload(models.ServiceProtocolSignature.signed_by_user),
            )
        )

    @staticmethod
    def _pick_contact(request: models.ServiceRequest) -> tuple[Optional[str], Optional[str]]:
        contacts = request.client.contacts or []
        for contact in contacts:
            if contact.phone:
                return contact.name, contact.phone
        if contacts:
            return contacts[0].name, contacts[0].phone
        return None, request.client.phone

    @staticmethod
    def _assigned_to_me(request: models.ServiceRequest, current_user: models.User) -> Optional[models.ServiceAssignment]:
        for assignment in request.assignments or []:
            if assignment.technician_user_id == current_user.id and assignment.assignment_status in ACTIVE_ASSIGNMENT_STATUSES:
                return assignment
        return None

    @staticmethod
    def _available_to_accept(request: models.ServiceRequest) -> bool:
        if request.status in TERMINAL_REQUEST_STATUSES:
            return False
        active_assignments = [
            assignment
            for assignment in (request.assignments or [])
            if assignment.assignment_status in ACTIVE_ASSIGNMENT_STATUSES
        ]
        return len(active_assignments) == 0

    @staticmethod
    def _rejection_history(request: models.ServiceRequest) -> list[dict]:
        history: list[dict] = []
        for assignment in request.assignments or []:
            if not assignment.rejected_at:
                continue
            technician_name = assignment.technician_user.full_name or assignment.technician_user.email
            history.append(
                {
                    "assignment_id": assignment.id,
                    "technician_name": technician_name,
                    "rejected_at": assignment.rejected_at,
                    "reject_reason": assignment.reject_reason,
                }
            )
        history.sort(key=lambda item: item["rejected_at"] or datetime.min, reverse=True)
        return history

    @staticmethod
    def _serialize_workboard_item(request: models.ServiceRequest, *, current_user: models.User) -> dict:
        contact_name, contact_phone = MobileRequestService._pick_contact(request)
        current_assignment = MobileRequestService._assigned_to_me(request, current_user)
        available_to_accept = MobileRequestService._available_to_accept(request)
        rejection_history = MobileRequestService._rejection_history(request)
        assigned_technicians = []
        for assignment in request.assignments or []:
            technician_name = assignment.technician_user.full_name or assignment.technician_user.email
            if technician_name not in assigned_technicians:
                assigned_technicians.append(technician_name)

        workboard_group = "other"
        if current_assignment:
            workboard_group = "assigned_to_me"
        elif available_to_accept:
            workboard_group = "available"

        return {
            "id": request.id,
            "client_id": request.client_id,
            "site_id": request.site_id,
            "request_number": request.request_number,
            "client_name": request.client.name,
            "site_name": request.site.site_name,
            "site_code": request.site.site_code,
            "city": request.site.city,
            "address": request.site.address,
            "contact_name": contact_name,
            "contact_phone": contact_phone,
            "priority": request.priority,
            "status": request.status,
            "reported_at": request.reported_at,
            "problem_summary": request.reported_problem,
            "assigned_technicians": assigned_technicians,
            "assigned_to_me": current_assignment is not None,
            "available_to_accept": available_to_accept,
            "workboard_group": workboard_group,
            "has_rejection_history": len(rejection_history) > 0,
            "rejection_history": rejection_history,
            "current_assignment_id": current_assignment.id if current_assignment else None,
            "current_assignment_status": (
                current_assignment.assignment_status.value if current_assignment else None
            ),
        }

    @staticmethod
    def _serialize_site_request_item(request: models.ServiceRequest, *, current_user: models.User) -> dict:
        base = MobileRequestService._serialize_workboard_item(request, current_user=current_user)
        equipment_keys = sorted(
            {
                MobileRequestService._equipment_key(asset)
                for asset in (request.equipment_assets or [])
                if asset.is_active
            }
        )
        return {
            **base,
            "equipment_keys": equipment_keys,
        }

    @staticmethod
    def _sort_key(item: dict) -> tuple[int, int, float]:
        reported_at = item["reported_at"]
        timestamp = reported_at.timestamp() if reported_at else 0
        return (
            GROUP_SORT.get(item["workboard_group"], 9),
            PRIORITY_SORT.get(item["priority"], 9),
            -timestamp,
        )

    @staticmethod
    def list_workboard(
        db: Session,
        *,
        current_user: models.User,
        search: Optional[str] = None,
        status_filter: Optional[models.ServiceRequestStatus] = None,
        priority_filter: Optional[models.ServiceRequestPriority] = None,
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)
        query = MobileRequestService._base_query(db)

        if search:
            search_term = f"%{search.strip()}%"
            query = query.filter(
                (models.ServiceRequest.request_number.ilike(search_term))
                | (models.ServiceRequest.reported_problem.ilike(search_term))
                | (models.ServiceRequest.client.has(models.Client.name.ilike(search_term)))
                | (models.ServiceRequest.site.has(models.ClientSite.site_name.ilike(search_term)))
                | (models.ServiceRequest.site.has(models.ClientSite.site_code.ilike(search_term)))
            )
        if status_filter:
            query = query.filter(models.ServiceRequest.status == status_filter)
        if priority_filter:
            query = query.filter(models.ServiceRequest.priority == priority_filter)

        items = [MobileRequestService._serialize_workboard_item(request, current_user=current_user) for request in query.all()]
        items.sort(key=MobileRequestService._sort_key)

        assigned_to_me = [item for item in items if item["workboard_group"] == "assigned_to_me"]
        available = [item for item in items if item["workboard_group"] == "available"]
        other_visible = [item for item in items if item["workboard_group"] == "other"]

        return {
            "assigned_to_me": assigned_to_me,
            "available": available,
            "other_visible": other_visible,
            "generated_at": datetime.utcnow(),
        }

    @staticmethod
    def get_request_detail(
        db: Session,
        *,
        request_id: UUID,
        current_user: models.User,
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)
        request = MobileRequestService._base_query(db).filter(models.ServiceRequest.id == request_id).first()
        if not request:
            raise HTTPException(status_code=404, detail="Service request not found")

        base = ServiceRequestService._serialize_request_detail(
            request,
            include_billing_project_commercial=False,
            current_user=current_user,
        )
        workboard = MobileRequestService._serialize_workboard_item(request, current_user=current_user)
        return {
            **workboard,
            "external_order_number": base["external_order_number"],
            "source": request.source.value if hasattr(request.source, "value") else str(request.source),
            "repair_type_code": base["repair_type_code"],
            "request_reason_code": base["request_reason_code"],
            "notes_client": base["notes_client"],
            "project_reference_snapshot": base["project_reference_snapshot"],
            "service_type_snapshot": base["service_type_snapshot"],
            "payment_mode_snapshot": base["payment_mode_snapshot"],
            "billing_project": base["billing_project"],
            "assignments": base["assignments"],
            "work_logs": base["work_logs"],
            "travel_logs": base["travel_logs"],
            "material_usages": base["material_usages"],
            "equipment_assets": base["equipment_assets"],
            "signatures": MobileRequestService._serialize_signatures(request),
            "can_complete": MobileRequestService._has_required_signatures(request)
            and request.status in COMPLETABLE_REQUEST_STATUSES,
        }

    @staticmethod
    def get_site_detail(
        db: Session,
        *,
        site_id: UUID,
        current_user: models.User,
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)

        site = (
            db.query(models.ClientSite)
            .options(selectinload(models.ClientSite.client))
            .filter(models.ClientSite.id == site_id)
            .first()
        )
        if not site:
            raise HTTPException(status_code=404, detail="Client site not found")

        requests = (
            MobileRequestService._base_query(db)
            .filter(models.ServiceRequest.site_id == site_id)
            .all()
        )
        serialized_requests = [
            MobileRequestService._serialize_site_request_item(request, current_user=current_user)
            for request in requests
        ]
        serialized_requests.sort(key=MobileRequestService._sort_key)

        equipment_assets = (
            db.query(models.EquipmentAsset)
            .filter(models.EquipmentAsset.site_id == site_id)
            .order_by(
                models.EquipmentAsset.is_active.desc(),
                models.EquipmentAsset.equipment_type.asc(),
                models.EquipmentAsset.manufacturer.asc(),
                models.EquipmentAsset.model.asc(),
            )
            .all()
        )

        equipment_map: dict[str, dict] = {}
        for asset in equipment_assets:
            equipment_key = MobileRequestService._equipment_key(asset)
            current = equipment_map.get(equipment_key)
            if current is None:
                current = {
                    "equipment_key": equipment_key,
                    "display_name": MobileRequestService._equipment_display_name(asset),
                    "equipment_type": asset.equipment_type,
                    "manufacturer": asset.manufacturer,
                    "model": asset.model,
                    "serial_number": asset.serial_number,
                    "asset_tag": asset.asset_tag,
                    "location_note": asset.location_note,
                    "refrigerant": asset.refrigerant,
                    "notes": asset.notes,
                    "is_active": asset.is_active,
                    "_request_ids": set(),
                }
                equipment_map[equipment_key] = current

            if asset.request_id:
                current["_request_ids"].add(str(asset.request_id))
            current["is_active"] = current["is_active"] or asset.is_active

        equipment = []
        for item in equipment_map.values():
            equipment.append(
                {
                    "equipment_key": item["equipment_key"],
                    "display_name": item["display_name"],
                    "equipment_type": item["equipment_type"],
                    "manufacturer": item["manufacturer"],
                    "model": item["model"],
                    "serial_number": item["serial_number"],
                    "asset_tag": item["asset_tag"],
                    "location_note": item["location_note"],
                    "refrigerant": item["refrigerant"],
                    "notes": item["notes"],
                    "is_active": item["is_active"],
                    "request_count": len(item["_request_ids"]),
                }
            )

        equipment.sort(
            key=lambda item: (
                0 if item["is_active"] else 1,
                item["equipment_type"].lower(),
                item["display_name"].lower(),
            )
        )

        return {
            "id": site.id,
            "client_id": site.client_id,
            "client_name": site.client.name,
            "site_code": site.site_code,
            "site_name": site.site_name,
            "city": site.city,
            "address": site.address,
            "notes": site.notes,
            "equipment": equipment,
            "current_requests": [
                item
                for item in serialized_requests
                if item["status"] not in {"COMPLETED", "CLOSED", "CANCELLED"}
            ],
            "completed_requests": [
                item for item in serialized_requests if item["status"] in {"COMPLETED", "CLOSED"}
            ],
        }

    @staticmethod
    def accept_or_self_claim(
        db: Session,
        *,
        request_id: UUID,
        current_user: models.User,
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)
        request = MobileRequestService._base_query(db).filter(models.ServiceRequest.id == request_id).first()
        if not request:
            raise HTTPException(status_code=404, detail="Service request not found")
        ServiceRequestService.ensure_request_editable(request, current_user=current_user, action_label="modified")

        my_assignment = next(
            (assignment for assignment in request.assignments if assignment.technician_user_id == current_user.id),
            None,
        )
        if my_assignment:
            if my_assignment.assignment_status == models.ServiceAssignmentStatus.ACCEPTED:
                return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)
            if my_assignment.assignment_status == models.ServiceAssignmentStatus.PENDING:
                my_assignment.assignment_status = models.ServiceAssignmentStatus.ACCEPTED
                my_assignment.accepted_at = datetime.utcnow()
                my_assignment.reject_reason = None
                request.status = models.ServiceRequestStatus.ACCEPTED
                db.add(my_assignment)
                db.add(request)
                AuditService.log_event(
                    db,
                    action="service_assignment.accepted",
                    entity_type="service_assignment",
                    entity_id=str(my_assignment.id),
                    actor_user_id=current_user.id,
                    details={"request_id": str(request.id), "source": "mobile"},
                )
                db.commit()
                return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)

        blocking_assignments = [
            assignment
            for assignment in request.assignments
            if assignment.technician_user_id != current_user.id
            and assignment.assignment_status in ACTIVE_ASSIGNMENT_STATUSES
        ]
        if blocking_assignments:
            raise HTTPException(status_code=400, detail="This request is currently assigned to another technician")

        if my_assignment and my_assignment.assignment_status in {
            models.ServiceAssignmentStatus.REJECTED,
            models.ServiceAssignmentStatus.CANCELLED,
        }:
            my_assignment.assignment_status = models.ServiceAssignmentStatus.ACCEPTED
            my_assignment.accepted_at = datetime.utcnow()
            request.status = models.ServiceRequestStatus.ACCEPTED
            db.add(my_assignment)
            db.add(request)
            AuditService.log_event(
                db,
                action="service_assignment.reaccepted_mobile",
                entity_type="service_assignment",
                entity_id=str(my_assignment.id),
                actor_user_id=current_user.id,
                details={"request_id": str(request.id), "source": "mobile"},
            )
            db.commit()
            return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)

        assignment = models.ServiceAssignment(
            request_id=request.id,
            technician_user_id=current_user.id,
            assigned_by_user_id=current_user.id,
            is_primary=not bool(request.assignments),
            assignment_status=models.ServiceAssignmentStatus.ACCEPTED,
            accepted_at=datetime.utcnow(),
        )
        request.status = models.ServiceRequestStatus.ACCEPTED
        db.add(assignment)
        db.add(request)
        db.flush()
        AuditService.log_event(
            db,
            action="service_request.self_claimed",
            entity_type="service_request",
            entity_id=str(request.id),
            actor_user_id=current_user.id,
            details={"assignment_id": str(assignment.id)},
        )
        db.commit()
        return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)

    @staticmethod
    def reject_request(
        db: Session,
        *,
        request_id: UUID,
        current_user: models.User,
        reject_reason: str,
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)
        MobileRequestService._require_permissions(
            db,
            current_user,
            PermissionCode.SERVICE_REQUESTS_REJECT.value,
        )
        request = MobileRequestService._get_request_or_404(db, request_id=request_id)
        if request.status in {
            models.ServiceRequestStatus.IN_PROGRESS,
            models.ServiceRequestStatus.WAITING_PARTS,
            models.ServiceRequestStatus.WAITING_CLIENT,
            models.ServiceRequestStatus.COMPLETED,
            models.ServiceRequestStatus.CLOSED,
            models.ServiceRequestStatus.CANCELLED,
        }:
            raise HTTPException(
                status_code=400,
                detail="Started or completed requests cannot be rejected from mobile",
            )
        assignment = MobileRequestService._get_my_assignment(request, current_user)
        if not assignment:
            raise HTTPException(status_code=400, detail="You do not have an active assignment for this request")

        ServiceRequestService.reject_assignment(
            db,
            assignment_id=assignment.id,
            current_user=current_user,
            reject_reason=reject_reason,
        )
        return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)

    @staticmethod
    def start_work(
        db: Session,
        *,
        request_id: UUID,
        current_user: models.User,
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)
        MobileRequestService._require_permissions(
            db,
            current_user,
            PermissionCode.SERVICE_REQUESTS_EDIT.value,
            PermissionCode.SERVICE_REQUESTS_ACCEPT.value,
            PermissionCode.WORK_LOGS_MANAGE.value,
            require_all=False,
        )
        request = MobileRequestService._get_request_or_404(db, request_id=request_id)
        ServiceRequestService.ensure_request_editable(request, current_user=current_user, action_label="modified")

        assignment = MobileRequestService._get_my_assignment(request, current_user)
        if not assignment:
            if MobileRequestService._available_to_accept(request):
                MobileRequestService.accept_or_self_claim(
                    db,
                    request_id=request_id,
                    current_user=current_user,
                )
                request = MobileRequestService._get_request_or_404(db, request_id=request_id)
                assignment = MobileRequestService._get_my_assignment(request, current_user)
            else:
                raise HTTPException(status_code=400, detail="You do not have an active assignment for this request")

        if assignment and assignment.assignment_status == models.ServiceAssignmentStatus.PENDING:
            assignment.assignment_status = models.ServiceAssignmentStatus.ACCEPTED
            assignment.accepted_at = datetime.utcnow()
            assignment.reject_reason = None
            db.add(assignment)

        request.status = models.ServiceRequestStatus.IN_PROGRESS
        db.add(request)
        AuditService.log_event(
            db,
            action="service_request.started_work_mobile",
            entity_type="service_request",
            entity_id=str(request.id),
            actor_user_id=current_user.id,
            details={"assignment_id": str(assignment.id) if assignment else None},
        )
        db.commit()
        return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)

    @staticmethod
    def add_work_log(
        db: Session,
        *,
        request_id: UUID,
        payload: schemas.mobile.MobileWorkLogCreate,
        current_user: models.User,
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)
        MobileRequestService._require_permissions(
            db,
            current_user,
            PermissionCode.WORK_LOGS_MANAGE.value,
        )
        request = MobileRequestService._get_request_or_404(db, request_id=request_id)
        if request.status in TERMINAL_REQUEST_STATUSES | {models.ServiceRequestStatus.COMPLETED}:
            raise HTTPException(status_code=400, detail="Completed or closed requests cannot be signed from mobile")
        assignment = MobileRequestService._get_my_assignment(request, current_user)
        if not assignment:
            raise HTTPException(status_code=400, detail="You do not have an active assignment for this request")

        ServiceRequestService.add_work_log(
            db,
            payload=schemas.service_request.WorkLogCreate(
                request_id=request_id,
                technician_user_id=current_user.id,
                work_date=payload.work_date,
                time_from=payload.time_from,
                time_to=payload.time_to,
                activity_description=payload.activity_description,
                repair_type_code=payload.repair_type_code,
                is_holiday_override=payload.is_holiday_override,
            ),
            current_user=current_user,
        )
        return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)

    @staticmethod
    def start_travel(
        db: Session,
        *,
        request_id: UUID,
        payload: schemas.mobile.MobileTravelStartCreate,
        current_user: models.User,
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)
        MobileRequestService._require_permissions(
            db,
            current_user,
            PermissionCode.SERVICE_REQUESTS_EDIT.value,
            PermissionCode.SERVICE_REQUESTS_ACCEPT.value,
            PermissionCode.WORK_LOGS_MANAGE.value,
            require_all=False,
        )
        request = MobileRequestService._get_request_or_404(db, request_id=request_id)
        ServiceRequestService.ensure_request_editable(request, current_user=current_user, action_label="modified")

        assignment = MobileRequestService._get_my_assignment(request, current_user)
        if not assignment:
            if MobileRequestService._available_to_accept(request):
                MobileRequestService.accept_or_self_claim(db, request_id=request_id, current_user=current_user)
                request = MobileRequestService._get_request_or_404(db, request_id=request_id)
                assignment = MobileRequestService._get_my_assignment(request, current_user)
            else:
                raise HTTPException(status_code=400, detail="You do not have an active assignment for this request")

        if assignment and assignment.assignment_status == models.ServiceAssignmentStatus.PENDING:
            assignment.assignment_status = models.ServiceAssignmentStatus.ACCEPTED
            assignment.accepted_at = datetime.utcnow()
            assignment.reject_reason = None
            request.status = models.ServiceRequestStatus.ACCEPTED
            db.add(assignment)
            db.add(request)

        if MobileRequestService._get_my_active_travel_log(request, current_user):
            raise HTTPException(status_code=400, detail="Travel is already active for this request")

        travel_log = models.ServiceTravelLog(
            request_id=request.id,
            technician_user_id=current_user.id,
            created_by_user_id=current_user.id,
            started_at=payload.started_at or datetime.utcnow(),
            start_latitude=MobileRequestService._to_decimal_coordinate(payload.latitude),
            start_longitude=MobileRequestService._to_decimal_coordinate(payload.longitude),
        )
        db.add(travel_log)
        db.flush()
        AuditService.log_event(
            db,
            action="service_request.travel_started_mobile",
            entity_type="service_travel_log",
            entity_id=str(travel_log.id),
            actor_user_id=current_user.id,
            details={"request_id": str(request.id)},
        )
        db.commit()
        return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)

    @staticmethod
    def stop_travel(
        db: Session,
        *,
        request_id: UUID,
        payload: schemas.mobile.MobileTravelStopUpdate,
        current_user: models.User,
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)
        MobileRequestService._require_permissions(
            db,
            current_user,
            PermissionCode.SERVICE_REQUESTS_EDIT.value,
            PermissionCode.WORK_LOGS_MANAGE.value,
            require_all=False,
        )
        request = MobileRequestService._get_request_or_404(db, request_id=request_id)
        ServiceRequestService.ensure_request_editable(request, current_user=current_user, action_label="modified")
        assignment = MobileRequestService._get_my_assignment(request, current_user)
        if not assignment:
            raise HTTPException(status_code=400, detail="You do not have an active assignment for this request")

        travel_log = MobileRequestService._get_my_active_travel_log(request, current_user)
        if not travel_log:
            raise HTTPException(status_code=400, detail="There is no active travel log for this request")

        ended_at = payload.ended_at or datetime.utcnow()
        if ended_at < travel_log.started_at:
            raise HTTPException(status_code=400, detail="Travel end time cannot be earlier than the start time")

        travel_log.ended_at = ended_at
        travel_log.end_latitude = MobileRequestService._to_decimal_coordinate(payload.latitude)
        travel_log.end_longitude = MobileRequestService._to_decimal_coordinate(payload.longitude)
        estimated_duration_minutes = max(int((ended_at - travel_log.started_at).total_seconds() // 60), 0)
        estimated_distance_km = MobileRequestService._estimate_distance_km(
            travel_log.start_latitude,
            travel_log.start_longitude,
            travel_log.end_latitude,
            travel_log.end_longitude,
        )
        travel_log.estimated_duration_minutes = estimated_duration_minutes
        travel_log.final_duration_minutes = estimated_duration_minutes
        travel_log.estimated_distance_km = estimated_distance_km
        travel_log.final_distance_km = estimated_distance_km
        travel_log.is_gps_estimated = estimated_distance_km is not None
        db.add(travel_log)
        AuditService.log_event(
            db,
            action="service_request.travel_stopped_mobile",
            entity_type="service_travel_log",
            entity_id=str(travel_log.id),
            actor_user_id=current_user.id,
            details={"request_id": str(request.id)},
        )
        db.commit()
        return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)

    @staticmethod
    def update_travel_log(
        db: Session,
        *,
        request_id: UUID,
        travel_log_id: UUID,
        payload: schemas.mobile.MobileTravelManualUpdate,
        current_user: models.User,
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)
        MobileRequestService._require_permissions(
            db,
            current_user,
            PermissionCode.SERVICE_REQUESTS_EDIT.value,
            PermissionCode.WORK_LOGS_MANAGE.value,
            require_all=False,
        )
        request = MobileRequestService._get_request_or_404(db, request_id=request_id)
        ServiceRequestService.ensure_request_editable(request, current_user=current_user, action_label="modified")
        assignment = MobileRequestService._get_my_assignment(request, current_user)
        if not assignment:
            raise HTTPException(status_code=400, detail="You do not have an active assignment for this request")

        travel_log = next(
            (
                log
                for log in (request.travel_logs or [])
                if log.id == travel_log_id and log.technician_user_id == current_user.id
            ),
            None,
        )
        if not travel_log:
            raise HTTPException(status_code=404, detail="Travel log not found")
        if travel_log.ended_at is None:
            raise HTTPException(status_code=400, detail="Travel log must be stopped before it can be adjusted")

        if payload.final_duration_minutes is not None:
            travel_log.final_duration_minutes = payload.final_duration_minutes
        if payload.final_distance_km is not None:
            travel_log.final_distance_km = payload.final_distance_km
        if payload.manual_adjustment_note is not None:
            travel_log.manual_adjustment_note = payload.manual_adjustment_note.strip() or None

        db.add(travel_log)
        AuditService.log_event(
            db,
            action="service_request.travel_adjusted_mobile",
            entity_type="service_travel_log",
            entity_id=str(travel_log.id),
            actor_user_id=current_user.id,
            details={"request_id": str(request.id)},
        )
        db.commit()
        return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)

    @staticmethod
    def add_material_usage(
        db: Session,
        *,
        request_id: UUID,
        payload: schemas.mobile.MobileMaterialUsageCreate,
        current_user: models.User,
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)
        MobileRequestService._require_permissions(
            db,
            current_user,
            PermissionCode.MATERIAL_USAGES_MANAGE.value,
        )
        request = MobileRequestService._get_request_or_404(db, request_id=request_id)
        ServiceRequestService.ensure_request_editable(request, current_user=current_user, action_label="modified")
        assignment = MobileRequestService._get_my_assignment(request, current_user)
        if not assignment:
            raise HTTPException(status_code=400, detail="You do not have an active assignment for this request")

        ServiceRequestService.add_material_usage(
            db,
            payload=schemas.service_request.MaterialUsageCreate(
                request_id=request_id,
                material_id=payload.material_id,
                warehouse_id=payload.warehouse_id,
                technician_user_id=current_user.id,
                quantity=payload.quantity,
                unit=payload.unit,
                notes=payload.notes,
                used_at=payload.used_at,
            ),
            current_user=current_user,
        )
        return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)

    @staticmethod
    def add_equipment_asset(
        db: Session,
        *,
        request_id: UUID,
        payload: schemas.mobile.MobileEquipmentCreate,
        current_user: models.User,
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)
        MobileRequestService._require_permissions(
            db,
            current_user,
            PermissionCode.EQUIPMENT_MANAGE.value,
            PermissionCode.WORK_LOGS_MANAGE.value,
            PermissionCode.SERVICE_REQUESTS_EDIT.value,
            require_all=False,
        )
        request = MobileRequestService._get_request_or_404(db, request_id=request_id)
        ServiceRequestService.ensure_request_editable(request, current_user=current_user, action_label="modified")
        assignment = MobileRequestService._get_my_assignment(request, current_user)
        if not assignment:
            raise HTTPException(status_code=400, detail="You do not have an active assignment for this request")

        ServiceRequestService.add_equipment_asset(
            db,
            payload=schemas.service_request.EquipmentAssetCreate(
                request_id=request_id,
                equipment_type=payload.equipment_type,
                manufacturer=payload.manufacturer,
                model=payload.model,
                serial_number=payload.serial_number,
                asset_tag=payload.asset_tag,
                location_note=payload.location_note,
                refrigerant=payload.refrigerant,
                notes=payload.notes,
                is_active=payload.is_active,
            ),
            current_user=current_user,
        )
        return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)

    @staticmethod
    def list_material_options(
        db: Session,
        *,
        current_user: models.User,
        search: Optional[str] = None,
        limit: int = 20,
    ) -> list[dict]:
        MobileRequestService._require_permissions(
            db,
            current_user,
            PermissionCode.MATERIALS_READ_OPERATIONAL.value,
            PermissionCode.MATERIAL_USAGES_MANAGE.value,
            require_all=False,
        )
        query = db.query(models.Material).filter(models.Material.is_active.is_(True))
        if search:
            term = f"%{search.strip()}%"
            query = query.filter(
                (models.Material.erp_code.ilike(term))
                | (models.Material.barcode.ilike(term))
                | (models.Material.name.ilike(term))
            )

        materials = (
            query.order_by(models.Material.name.asc(), models.Material.erp_code.asc()).limit(limit).all()
        )
        return [
            {
                "id": material.id,
                "erp_code": material.erp_code,
                "barcode": material.barcode,
                "name": material.name,
                "description": material.description,
                "unit": material.unit,
                "category": material.category,
            }
            for material in materials
        ]

    @staticmethod
    def list_warehouse_options(
        db: Session,
        *,
        current_user: models.User,
    ) -> list[dict]:
        MobileRequestService._require_permissions(
            db,
            current_user,
            PermissionCode.MATERIAL_USAGES_MANAGE.value,
            PermissionCode.WAREHOUSES_MANAGE.value,
            require_all=False,
        )
        warehouses = (
            db.query(models.Warehouse)
            .filter(models.Warehouse.is_active.is_(True))
            .order_by(models.Warehouse.code.asc())
            .all()
        )
        return [
            {
                "id": warehouse.id,
                "code": warehouse.code,
                "name": warehouse.name,
                "is_active": warehouse.is_active,
            }
            for warehouse in warehouses
        ]

    @staticmethod
    def save_signature(
        db: Session,
        *,
        request_id: UUID,
        payload: schemas.mobile.MobileSignatureCreate,
        current_user: models.User,
        ip_address: Optional[str],
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)
        MobileRequestService._require_permissions(
            db,
            current_user,
            PermissionCode.WORK_LOGS_MANAGE.value,
            PermissionCode.SERVICE_REQUESTS_ACCEPT.value,
            PermissionCode.SERVICE_REQUESTS_EDIT.value,
            require_all=False,
        )
        request = MobileRequestService._get_request_or_404(db, request_id=request_id)
        ServiceRequestService.ensure_request_editable(request, current_user=current_user, action_label="modified")
        assignment = MobileRequestService._get_my_assignment(request, current_user)
        if not assignment:
            raise HTTPException(status_code=400, detail="You do not have an active assignment for this request")
        if not payload.signature_image_data.startswith("data:image/"):
            raise HTTPException(status_code=400, detail="Signature image must be a data URL")
        if not payload.signer_name.strip():
            raise HTTPException(status_code=400, detail="Signer name is required")

        normalized_role = (
            payload.signer_role.value if hasattr(payload.signer_role, "value") else str(payload.signer_role)
        )
        for signature in request.signatures or []:
            signature_role = signature.signer_role.value if hasattr(signature.signer_role, "value") else str(signature.signer_role)
            if signature.is_active and signature_role == normalized_role:
                signature.is_active = False
                signature.invalidated_at = datetime.utcnow()
                signature.invalidation_reason = "Replaced with a new signature"
                db.add(signature)

        signature = models.ServiceProtocolSignature(
            request_id=request.id,
            signer_role=payload.signer_role,
            signer_name=payload.signer_name.strip(),
            signed_by_user_id=current_user.id if normalized_role == "technician" else None,
            signature_image_data=payload.signature_image_data,
            signature_strokes_json=payload.signature_strokes,
            ip_address=ip_address,
            device_info=payload.device_info,
        )
        db.add(signature)
        db.flush()
        AuditService.log_event(
            db,
            action="service_protocol.signature_saved",
            entity_type="service_request",
            entity_id=str(request.id),
            actor_user_id=current_user.id,
            details={"signature_id": str(signature.id), "signer_role": normalized_role},
        )
        db.commit()
        return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)

    @staticmethod
    def complete_request(
        db: Session,
        *,
        request_id: UUID,
        current_user: models.User,
    ) -> dict:
        MobileRequestService._assert_mobile_visibility(db, current_user)
        MobileRequestService._require_permissions(
            db,
            current_user,
            PermissionCode.SERVICE_REQUESTS_EDIT.value,
            PermissionCode.SERVICE_REQUESTS_CLOSE.value,
            PermissionCode.WORK_LOGS_MANAGE.value,
            require_all=False,
        )
        request = MobileRequestService._get_request_or_404(db, request_id=request_id)
        ServiceRequestService.ensure_request_editable(request, current_user=current_user, action_label="modified")
        assignment = MobileRequestService._get_my_assignment(request, current_user)
        if not assignment:
            raise HTTPException(status_code=400, detail="You do not have an active assignment for this request")
        if request.status not in COMPLETABLE_REQUEST_STATUSES:
            raise HTTPException(status_code=400, detail="This request cannot be completed in its current status")
        if not MobileRequestService._has_required_signatures(request):
            raise HTTPException(status_code=400, detail="Both technician and client signatures are required")

        request.status = models.ServiceRequestStatus.COMPLETED
        db.add(request)
        AuditService.log_event(
            db,
            action="service_request.completed_mobile",
            entity_type="service_request",
            entity_id=str(request.id),
            actor_user_id=current_user.id,
            details={"signature_roles": ["technician", "client"]},
        )
        db.commit()
        return MobileRequestService.get_request_detail(db, request_id=request_id, current_user=current_user)
