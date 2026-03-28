import enum
import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_cls]


class BillingServiceType(str, enum.Enum):
    PAID_SERVICE = "paid_service"
    WARRANTY = "warranty"
    MAINTENANCE = "maintenance"
    INSTALLATION = "installation"
    SUBSCRIPTION = "subscription"
    OTHER = "other"


class BillingPaymentMode(str, enum.Enum):
    PAID = "paid"
    WARRANTY = "warranty"
    CONTRACT = "contract"
    INTERNAL = "internal"
    OTHER = "other"


class ClientBillingProject(Base):
    __tablename__ = "client_billing_projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    site_id = Column(UUID(as_uuid=True), ForeignKey("client_sites.id", ondelete="CASCADE"), nullable=True, index=True)
    project_reference = Column(String, nullable=False, index=True)
    project_year = Column(String, nullable=True, index=True)
    service_type = Column(
        Enum(BillingServiceType, values_callable=enum_values, validate_strings=True),
        nullable=False,
        default=BillingServiceType.OTHER,
    )
    payment_mode = Column(
        Enum(BillingPaymentMode, values_callable=enum_values, validate_strings=True),
        nullable=False,
        default=BillingPaymentMode.OTHER,
    )
    description = Column(String, nullable=True)
    regular_labor_rate = Column(Numeric(10, 2), nullable=True)
    transport_rate = Column(Numeric(10, 2), nullable=True)
    valid_from = Column(Date, nullable=True)
    valid_to = Column(Date, nullable=True)
    is_default = Column(Boolean, nullable=False, default=False, server_default="false")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    client = relationship("Client", back_populates="billing_projects")
    site = relationship("ClientSite", back_populates="billing_projects")
    service_requests = relationship("ServiceRequest", back_populates="billing_project")
