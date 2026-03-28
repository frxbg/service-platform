from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.service_assignment import ServiceAssignmentStatus
from app.models.client_billing_project import BillingPaymentMode, BillingServiceType
from app.models.service_request import (
    ServiceRequestPriority,
    ServiceRequestSource,
    ServiceRequestStatus,
)
from app.models.service_protocol_signature import ServiceProtocolSignatureRole


class ReferenceUser(BaseModel):
    id: UUID
    full_name: Optional[str] = None
    email: str

    class Config:
        from_attributes = True


class ReferenceClient(BaseModel):
    id: UUID
    name: str
    client_number: Optional[str] = None

    class Config:
        from_attributes = True


class ReferenceSite(BaseModel):
    id: UUID
    site_code: str
    site_name: Optional[str] = None
    address: Optional[str] = None

    class Config:
        from_attributes = True


class ReferenceBillingProjectOperational(BaseModel):
    id: UUID
    client_id: UUID
    site_id: Optional[UUID] = None
    project_reference: str
    project_year: Optional[str] = None
    service_type: BillingServiceType
    payment_mode: BillingPaymentMode
    description: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    is_default: bool
    is_active: bool
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class ReferenceBillingProjectCommercial(ReferenceBillingProjectOperational):
    regular_labor_rate: Optional[Decimal] = None
    transport_rate: Optional[Decimal] = None


class ReferenceMaterial(BaseModel):
    id: UUID
    erp_code: str
    name: str
    unit: str

    class Config:
        from_attributes = True


class ReferenceWarehouse(BaseModel):
    id: UUID
    code: str
    name: str
    is_active: bool

    class Config:
        from_attributes = True


class WarehouseBase(BaseModel):
    code: str
    name: str
    responsible_user_id: Optional[UUID] = None
    is_active: bool = True


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    responsible_user_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class Warehouse(WarehouseBase):
    id: UUID

    class Config:
        from_attributes = True


class ServiceAssignmentCreate(BaseModel):
    technician_user_id: UUID
    is_primary: bool = False


class ServiceAssignmentAction(BaseModel):
    reject_reason: Optional[str] = None


class ServiceAssignment(BaseModel):
    id: UUID
    request_id: UUID
    assignment_status: ServiceAssignmentStatus
    reject_reason: Optional[str] = None
    assigned_at: datetime
    accepted_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    is_primary: bool
    technician_user: ReferenceUser
    assigned_by_user: ReferenceUser

    class Config:
        from_attributes = True


class WorkLogCreate(BaseModel):
    request_id: UUID
    technician_user_id: Optional[UUID] = None
    work_date: date
    time_from: time
    time_to: time
    activity_description: str
    repair_type_code: Optional[str] = None
    is_holiday_override: bool = False


class WorkLog(BaseModel):
    id: UUID
    request_id: UUID
    work_date: date
    time_from: time
    time_to: time
    minutes_total: int
    minutes_regular: int
    minutes_overtime: int
    minutes_weekend: int
    minutes_holiday: int
    activity_description: str
    repair_type_code: Optional[str] = None
    technician_user: ReferenceUser
    created_by_user: ReferenceUser
    created_at: datetime

    class Config:
        from_attributes = True


class MaterialUsageCreate(BaseModel):
    request_id: UUID
    material_id: UUID
    warehouse_id: UUID
    technician_user_id: Optional[UUID] = None
    quantity: Decimal
    unit: Optional[str] = None
    notes: Optional[str] = None
    used_at: Optional[datetime] = None


class MaterialUsage(BaseModel):
    id: UUID
    request_id: UUID
    quantity: Decimal
    unit: str
    notes: Optional[str] = None
    used_at: datetime
    material: ReferenceMaterial
    warehouse: ReferenceWarehouse
    technician_user: ReferenceUser

    class Config:
        from_attributes = True


class EquipmentAssetCreate(BaseModel):
    request_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    site_id: Optional[UUID] = None
    equipment_type: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    asset_tag: Optional[str] = None
    location_note: Optional[str] = None
    refrigerant: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class EquipmentAsset(BaseModel):
    id: UUID
    request_id: Optional[UUID] = None
    client: ReferenceClient
    site: ReferenceSite
    equipment_type: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    asset_tag: Optional[str] = None
    location_note: Optional[str] = None
    refrigerant: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class ServiceRequestCreate(BaseModel):
    external_order_number: Optional[str] = None
    source: ServiceRequestSource = ServiceRequestSource.OTHER
    client_id: UUID
    site_id: UUID
    billing_project_id: UUID
    responsible_user_id: Optional[UUID] = None
    reported_problem: str
    request_reason_code: Optional[str] = None
    repair_type_code: Optional[str] = None
    priority: ServiceRequestPriority = ServiceRequestPriority.STANDARD
    reported_at: datetime
    discovered_during_request_id: Optional[UUID] = None
    notes_internal: Optional[str] = None
    notes_client: Optional[str] = None


class ServiceRequestStatusUpdate(BaseModel):
    status: ServiceRequestStatus


class ServiceRequestBillingProjectUpdate(BaseModel):
    billing_project_id: UUID
    reason_for_change: str


class ServiceRequestListItem(BaseModel):
    id: UUID
    request_number: str
    client: ReferenceClient
    site: ReferenceSite
    billing_project: Optional[ReferenceBillingProjectOperational | ReferenceBillingProjectCommercial] = None
    project_reference_snapshot: Optional[str] = None
    service_type_snapshot: Optional[BillingServiceType | str] = None
    payment_mode_snapshot: Optional[BillingPaymentMode | str] = None
    priority: ServiceRequestPriority
    status: ServiceRequestStatus
    responsible_user: ReferenceUser
    assigned_technicians: list[str] = Field(default_factory=list)
    reported_at: datetime
    created_at: datetime


class ServiceRequestDashboardSummary(BaseModel):
    total_requests: int
    active_requests: int
    new_requests: int
    urgent_requests: int
    in_progress_requests: int
    unassigned_requests: int
    status_breakdown: dict[str, int] = Field(default_factory=dict)
    recent_requests: list[ServiceRequestListItem] = Field(default_factory=list)


class ServiceRequest(BaseModel):
    id: UUID
    request_number: str
    external_order_number: Optional[str] = None
    source: ServiceRequestSource
    client: ReferenceClient
    site: ReferenceSite
    billing_project_id: Optional[UUID] = None
    billing_project: Optional[ReferenceBillingProjectOperational | ReferenceBillingProjectCommercial] = None
    responsible_user: ReferenceUser
    created_by_user: ReferenceUser
    reported_problem: str
    request_reason_code: Optional[str] = None
    repair_type_code: Optional[str] = None
    priority: ServiceRequestPriority
    status: ServiceRequestStatus
    reported_at: datetime
    created_at: datetime
    updated_at: datetime
    discovered_during_request_id: Optional[UUID] = None
    project_reference_snapshot: Optional[str] = None
    service_type_snapshot: Optional[BillingServiceType | str] = None
    payment_mode_snapshot: Optional[BillingPaymentMode | str] = None
    notes_internal: Optional[str] = None
    notes_client: Optional[str] = None
    assignments: list[ServiceAssignment] = Field(default_factory=list)
    work_logs: list[WorkLog] = Field(default_factory=list)
    material_usages: list[MaterialUsage] = Field(default_factory=list)
    equipment_assets: list[EquipmentAsset] = Field(default_factory=list)


class ProtocolTechnicianSummary(BaseModel):
    technician_name: str
    regular_minutes: int
    overtime_minutes: int
    weekend_minutes: int
    holiday_minutes: int
    total_minutes: int


class ProtocolMaterialLine(BaseModel):
    material_code: str
    material_name: str
    quantity: Decimal
    unit: str
    warehouse_code: str
    warehouse_name: str


class ServiceProtocolSignatureSummary(BaseModel):
    id: UUID
    signer_role: ServiceProtocolSignatureRole
    signer_name: str
    signed_at: datetime
    signature_image_data: Optional[str] = None


class ServiceProtocolPreview(BaseModel):
    request_id: UUID
    request_number: str
    client_name: str
    site_name: str
    site_address: Optional[str] = None
    reason_for_visit: str
    repair_type_code: Optional[str] = None
    execution_date: Optional[date] = None
    worked_time_from: Optional[time] = None
    worked_time_to: Optional[time] = None
    technicians: list[str] = Field(default_factory=list)
    technician_time_breakdown: list[ProtocolTechnicianSummary] = Field(default_factory=list)
    total_regular_minutes: int
    total_overtime_minutes: int
    total_weekend_minutes: int
    total_holiday_minutes: int
    total_minutes: int
    work_description: str
    materials: list[ProtocolMaterialLine] = Field(default_factory=list)
    signatures: list[ServiceProtocolSignatureSummary] = Field(default_factory=list)
