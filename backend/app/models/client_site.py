from sqlalchemy import Column, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class ClientSite(Base):
    __tablename__ = "client_sites"
    __table_args__ = (
        UniqueConstraint("client_id", "site_code", name="uq_client_site_code_per_client"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True)
    site_code = Column(String, nullable=False, index=True)
    site_name = Column(String, nullable=True)
    city = Column(String, nullable=True)
    address = Column(String, nullable=True)
    project_number = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    client = relationship("Client", back_populates="sites")
    billing_projects = relationship("ClientBillingProject", back_populates="site", cascade="all, delete-orphan")
