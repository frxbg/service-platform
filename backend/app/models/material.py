from sqlalchemy import Column, String, Text, DateTime, Boolean, Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from app.database import Base

class Material(Base):
    __tablename__ = "materials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    erp_code = Column(String, unique=True, index=True, nullable=False)
    barcode = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    unit = Column(String, nullable=False)
    category = Column(String, nullable=False, index=True)
    subcategory = Column(String, nullable=True)
    cost_currency = Column(String, nullable=False, default="EUR")
    cost = Column(Numeric(10, 2), nullable=False)
    default_margin_percent = Column(Numeric(5, 2), nullable=True)
    default_sell_price = Column(Numeric(10, 2), nullable=True)
    is_active = Column(Boolean, default=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)

class MaterialImportLog(Base):
    __tablename__ = "material_import_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    imported_at = Column(DateTime(timezone=True), server_default=func.now())
    imported_by_user_id = Column(UUID(as_uuid=True), nullable=True) # Nullable if system import
    row_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    errors_json = Column(JSONB, nullable=True)
