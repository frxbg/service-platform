from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.service_request import ServiceRequestPriority, ServiceRequestStatus
from app.models.service_protocol_signature import ServiceProtocolSignatureRole
from app.schemas.service_request import (
    EquipmentAsset,
    MaterialUsage,
    ReferenceBillingProjectOperational,
    ServiceAssignment,
    WorkLog,
)


class MobileRequestRejectionHistory(BaseModel):
    assignment_id: UUID
    technician_name: str
    rejected_at: Optional[datetime] = None
    reject_reason: Optional[str] = None


class MobileRequestListItem(BaseModel):
    id: UUID
    client_id: UUID
    site_id: UUID
    request_number: str
    client_name: str
    site_name: Optional[str] = None
    site_code: str
    city: Optional[str] = None
    address: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    priority: ServiceRequestPriority
    status: ServiceRequestStatus
    reported_at: datetime
    problem_summary: str
    assigned_technicians: list[str] = Field(default_factory=list)
    assigned_to_me: bool = False
    available_to_accept: bool = False
    workboard_group: str
    has_rejection_history: bool = False
    rejection_history: list[MobileRequestRejectionHistory] = Field(default_factory=list)
    current_assignment_id: Optional[UUID] = None
    current_assignment_status: Optional[str] = None


class MobileWorkboardResponse(BaseModel):
    assigned_to_me: list[MobileRequestListItem] = Field(default_factory=list)
    available: list[MobileRequestListItem] = Field(default_factory=list)
    other_visible: list[MobileRequestListItem] = Field(default_factory=list)
    generated_at: datetime


class MobileRequestSignature(BaseModel):
    id: UUID
    signer_role: ServiceProtocolSignatureRole
    signer_name: str
    signed_at: datetime
    signature_image_data: str


class MobileRequestDetail(MobileRequestListItem):
    external_order_number: Optional[str] = None
    source: str
    repair_type_code: Optional[str] = None
    request_reason_code: Optional[str] = None
    notes_client: Optional[str] = None
    project_reference_snapshot: Optional[str] = None
    service_type_snapshot: Optional[str] = None
    payment_mode_snapshot: Optional[str] = None
    billing_project: Optional[ReferenceBillingProjectOperational] = None
    assignments: list[ServiceAssignment] = Field(default_factory=list)
    work_logs: list[WorkLog] = Field(default_factory=list)
    material_usages: list[MaterialUsage] = Field(default_factory=list)
    equipment_assets: list[EquipmentAsset] = Field(default_factory=list)
    signatures: list["MobileRequestSignature"] = Field(default_factory=list)
    can_complete: bool = False


class MobileAcceptRequestResponse(BaseModel):
    request: MobileRequestDetail


class MobileRequestAction(BaseModel):
    reject_reason: Optional[str] = None


class MobileWorkLogCreate(BaseModel):
    work_date: date
    time_from: time
    time_to: time
    activity_description: str
    repair_type_code: Optional[str] = None
    is_holiday_override: bool = False


class MobileMaterialUsageCreate(BaseModel):
    material_id: UUID
    warehouse_id: UUID
    quantity: Decimal
    unit: Optional[str] = None
    notes: Optional[str] = None
    used_at: Optional[datetime] = None


class MobileMaterialOption(BaseModel):
    id: UUID
    erp_code: str
    barcode: Optional[str] = None
    name: str
    description: Optional[str] = None
    unit: str
    category: Optional[str] = None


class MobileWarehouseOption(BaseModel):
    id: UUID
    code: str
    name: str
    is_active: bool


class MobileRequestMutationResponse(BaseModel):
    request: MobileRequestDetail


class MobileSignatureCreate(BaseModel):
    signer_role: ServiceProtocolSignatureRole
    signer_name: str
    signature_image_data: str
    signature_strokes: Optional[dict] = None
    device_info: Optional[str] = None
