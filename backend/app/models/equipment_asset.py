import uuid

from sqlalchemy import Boolean, Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class EquipmentAsset(Base):
    __tablename__ = "equipment_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(UUID(as_uuid=True), ForeignKey("service_requests.id", ondelete="SET NULL"), nullable=True, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True)
    site_id = Column(UUID(as_uuid=True), ForeignKey("client_sites.id"), nullable=False, index=True)
    equipment_type = Column(String, nullable=False)
    manufacturer = Column(String, nullable=True)
    model = Column(String, nullable=True)
    serial_number = Column(String, nullable=True, index=True)
    asset_tag = Column(String, nullable=True, index=True)
    location_note = Column(String, nullable=True)
    refrigerant = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    request = relationship("ServiceRequest", back_populates="equipment_assets")
    client = relationship("Client")
    site = relationship("ClientSite")
