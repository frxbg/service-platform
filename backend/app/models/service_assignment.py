import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_cls]


class ServiceAssignmentStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ServiceAssignment(Base):
    __tablename__ = "service_assignments"
    __table_args__ = (
        UniqueConstraint("request_id", "technician_user_id", name="uq_service_assignment_request_technician"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(UUID(as_uuid=True), ForeignKey("service_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    technician_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    assigned_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    assignment_status = Column(
        Enum(ServiceAssignmentStatus, values_callable=enum_values, validate_strings=True),
        nullable=False,
        default=ServiceAssignmentStatus.PENDING,
    )
    reject_reason = Column(Text, nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    is_primary = Column(Boolean, nullable=False, default=False)

    request = relationship("ServiceRequest", back_populates="assignments")
    technician_user = relationship("User", foreign_keys=[technician_user_id])
    assigned_by_user = relationship("User", foreign_keys=[assigned_by_user_id])
