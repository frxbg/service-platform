import uuid

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class MaterialUsage(Base):
    __tablename__ = "material_usages"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_material_usages_quantity_nonnegative"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(UUID(as_uuid=True), ForeignKey("service_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    material_id = Column(UUID(as_uuid=True), ForeignKey("materials.id"), nullable=False, index=True)
    warehouse_id = Column(UUID(as_uuid=True), ForeignKey("warehouses.id"), nullable=False, index=True)
    technician_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    quantity = Column(Numeric(10, 3), nullable=False, default=0)
    unit = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    used_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    request = relationship("ServiceRequest", back_populates="material_usages")
    material = relationship("Material")
    warehouse = relationship("Warehouse", back_populates="material_usages")
    technician_user = relationship("User")
