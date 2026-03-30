import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.client_billing_project import BillingPaymentMode, BillingServiceType


def enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_cls]


class ServiceRequestSource(str, enum.Enum):
    PHONE = "phone"
    EMAIL = "email"
    EXTERNAL_NUMBER = "external_number"
    ONSITE = "onsite"
    OTHER = "other"


class ServiceRequestPriority(str, enum.Enum):
    LOW = "low"
    STANDARD = "standard"
    HIGH = "high"
    URGENT = "urgent"


class ServiceRequestStatus(str, enum.Enum):
    NEW = "NEW"
    ASSIGNED = "ASSIGNED"
    PENDING_ACCEPTANCE = "PENDING_ACCEPTANCE"
    ACCEPTED = "ACCEPTED"
    REJECTED_BY_TECHNICIAN = "REJECTED_BY_TECHNICIAN"
    IN_PROGRESS = "IN_PROGRESS"
    WAITING_PARTS = "WAITING_PARTS"
    WAITING_CLIENT = "WAITING_CLIENT"
    COMPLETED = "COMPLETED"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"


class ServiceRequest(Base):
    __tablename__ = "service_requests"
    __table_args__ = (
        Index("ix_service_requests_status_priority_reported_at", "status", "priority", "reported_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_number = Column(String, unique=True, index=True, nullable=False)
    external_order_number = Column(String, nullable=True, index=True)
    source = Column(
        Enum(ServiceRequestSource, values_callable=enum_values, validate_strings=True),
        nullable=False,
        default=ServiceRequestSource.OTHER,
    )
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True)
    site_id = Column(UUID(as_uuid=True), ForeignKey("client_sites.id"), nullable=False, index=True)
    billing_project_id = Column(UUID(as_uuid=True), ForeignKey("client_billing_projects.id"), nullable=True, index=True)
    responsible_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    reported_problem = Column(Text, nullable=False)
    request_reason_code = Column(String, nullable=True)
    repair_type_code = Column(String, nullable=True)
    priority = Column(
        Enum(ServiceRequestPriority, values_callable=enum_values, validate_strings=True),
        nullable=False,
        default=ServiceRequestPriority.STANDARD,
    )
    status = Column(
        Enum(ServiceRequestStatus, values_callable=enum_values, validate_strings=True),
        nullable=False,
        default=ServiceRequestStatus.NEW,
    )
    reported_at = Column(DateTime(timezone=True), nullable=False)
    discovered_during_request_id = Column(UUID(as_uuid=True), ForeignKey("service_requests.id"), nullable=True)
    project_reference_snapshot = Column(String, nullable=True)
    service_type_snapshot = Column(
        Enum(BillingServiceType, values_callable=enum_values, validate_strings=True),
        nullable=True,
    )
    payment_mode_snapshot = Column(
        Enum(BillingPaymentMode, values_callable=enum_values, validate_strings=True),
        nullable=True,
    )
    notes_internal = Column(Text, nullable=True)
    notes_client = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    client = relationship("Client")
    site = relationship("ClientSite")
    billing_project = relationship("ClientBillingProject", back_populates="service_requests")
    responsible_user = relationship("User", foreign_keys=[responsible_user_id])
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    discovered_during_request = relationship("ServiceRequest", remote_side=[id])
    assignments = relationship("ServiceAssignment", back_populates="request", cascade="all, delete-orphan")
    work_logs = relationship("WorkLog", back_populates="request", cascade="all, delete-orphan")
    travel_logs = relationship("ServiceTravelLog", back_populates="request", cascade="all, delete-orphan")
    material_usages = relationship("MaterialUsage", back_populates="request", cascade="all, delete-orphan")
    equipment_assets = relationship("EquipmentAsset", back_populates="request", cascade="all, delete-orphan")
    signatures = relationship("ServiceProtocolSignature", back_populates="request", cascade="all, delete-orphan")
