import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_cls]


class ServiceProtocolSignatureRole(str, enum.Enum):
    TECHNICIAN = "technician"
    CLIENT = "client"


class ServiceProtocolSignature(Base):
    __tablename__ = "service_protocol_signatures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(UUID(as_uuid=True), ForeignKey("service_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    signer_role = Column(
        Enum(ServiceProtocolSignatureRole, values_callable=enum_values, validate_strings=True),
        nullable=False,
    )
    signer_name = Column(String, nullable=False)
    signed_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    signature_image_data = Column(Text, nullable=False)
    signature_strokes_json = Column(JSONB, nullable=True)
    signed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ip_address = Column(String, nullable=True)
    device_info = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    invalidated_at = Column(DateTime(timezone=True), nullable=True)
    invalidation_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    request = relationship("ServiceRequest", back_populates="signatures")
    signed_by_user = relationship("User")
