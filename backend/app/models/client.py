from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, index=True)
    client_number = Column(String, nullable=True, unique=True, index=True)
    project_number = Column(String, nullable=True)
    salutation_name = Column(String, nullable=True)
    vat_number = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    country = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    sites = relationship("ClientSite", back_populates="client", cascade="all, delete-orphan")
    contacts = relationship("ClientContact", back_populates="client", cascade="all, delete-orphan")
    billing_projects = relationship("ClientBillingProject", back_populates="client", cascade="all, delete-orphan")
