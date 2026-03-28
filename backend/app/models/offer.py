from sqlalchemy import Column, String, Text, DateTime, Boolean, Numeric, Integer, ForeignKey, Enum, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from app.database import Base

class OfferStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    ARCHIVED = "ARCHIVED"

class OfferLineType(str, enum.Enum):
    MATERIAL = "material"
    LABOUR = "labour"
    SERVICE = "service"
    OTHER = "other"

class OfferSequence(Base):
    __tablename__ = "offer_sequences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    year = Column(Integer, nullable=False)
    next_sequence = Column(Integer, default=1, nullable=False)


offer_contacts = Table(
    "offer_contacts",
    Base.metadata,
    Column("offer_id", UUID(as_uuid=True), ForeignKey("offers.id", ondelete="CASCADE"), primary_key=True),
    Column("contact_id", UUID(as_uuid=True), ForeignKey("client_contacts.id", ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
)

class Offer(Base):
    __tablename__ = "offers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    offer_number = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    site_id = Column(UUID(as_uuid=True), ForeignKey("client_sites.id"), nullable=True)
    contact_person_id = Column(UUID(as_uuid=True), ForeignKey("client_contacts.id"), nullable=True)
    contact_person_name = Column(String, nullable=True)
    
    project_name = Column(String, nullable=True)
    site_address = Column(String, nullable=True)
    currency = Column(String, default="EUR", nullable=False)
    status = Column(Enum(OfferStatus), default=OfferStatus.DRAFT, nullable=False)
    
    validity_days = Column(Integer, default=30)
    payment_terms = Column(String, nullable=True)
    delivery_time = Column(String, nullable=True)
    
    notes_internal = Column(Text, nullable=True)
    notes_client = Column(Text, nullable=True)
    show_discount_column = Column(Boolean, default=False)
    
    total_cost = Column(Numeric(10, 2), default=0)
    total_price = Column(Numeric(10, 2), default=0)
    total_margin_value = Column(Numeric(10, 2), default=0)
    total_margin_percent = Column(Numeric(5, 2), default=0)
    
    version = Column(Integer, default=1)
    parent_offer_id = Column(UUID(as_uuid=True), ForeignKey("offers.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    user = relationship("User")
    client = relationship("Client")
    site = relationship("ClientSite")
    contact_person = relationship("ClientContact")
    contacts = relationship("ClientContact", secondary=offer_contacts, lazy="selectin")
    lines = relationship("OfferLine", back_populates="offer", cascade="all, delete-orphan", order_by="OfferLine.line_no")
    tags = relationship("OfferTag", back_populates="offer", cascade="all, delete-orphan")

    @property
    def tag_names(self) -> list[str]:
        names: list[str] = []
        for offer_tag in self.tags or []:
            tag_obj = getattr(offer_tag, "tag", None)
            tag_name = getattr(tag_obj, "name", None)
            if tag_name:
                names.append(tag_name)
        return names

class OfferLine(Base):
    __tablename__ = "offer_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    offer_id = Column(UUID(as_uuid=True), ForeignKey("offers.id"), nullable=False)
    line_no = Column(Integer, nullable=False)
    type = Column(Enum(OfferLineType), default=OfferLineType.MATERIAL, nullable=False)
    section = Column(String, nullable=True)
    
    material_id = Column(UUID(as_uuid=True), ForeignKey("materials.id"), nullable=True)
    description = Column(Text, nullable=True)
    quantity = Column(Numeric(10, 3), default=1)
    unit = Column(String, nullable=True)
    
    cost = Column(Numeric(10, 2), default=0)
    price = Column(Numeric(10, 2), default=0)
    discount_percent = Column(Numeric(5, 2), default=0)
    margin_value = Column(Numeric(10, 2), default=0)
    margin_percent = Column(Numeric(5, 2), default=0)
    
    order_index = Column(Integer, default=0)

    offer = relationship("Offer", back_populates="lines")
    material = relationship("Material")

class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, nullable=False)

class OfferTag(Base):
    __tablename__ = "offer_tags"
    
    offer_id = Column(UUID(as_uuid=True), ForeignKey("offers.id"), primary_key=True)
    tag_id = Column(UUID(as_uuid=True), ForeignKey("tags.id"), primary_key=True)
    
    offer = relationship("Offer", back_populates="tags")
    tag = relationship("Tag")
