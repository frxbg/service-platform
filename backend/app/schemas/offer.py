from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, field_validator, Field
from decimal import Decimal
from app.models.offer import OfferStatus, OfferLineType
from app.schemas.client import Client, ClientContact, ClientSite
from app.schemas.user import User

class OfferLineBase(BaseModel):
    line_no: int
    type: OfferLineType = OfferLineType.MATERIAL
    section: Optional[str] = None
    material_id: Optional[UUID] = None
    description: Optional[str] = None
    quantity: Decimal
    unit: Optional[str] = None
    cost: Decimal
    price: Decimal
    discount_percent: Optional[Decimal] = Decimal(0)
    margin_value: Optional[Decimal] = None
    margin_percent: Optional[Decimal] = None
    order_index: int = 0

class OfferLineCreate(OfferLineBase):
    pass

class OfferLineUpdate(BaseModel):
    id: Optional[UUID] = None
    line_no: Optional[int] = None
    type: Optional[OfferLineType] = None
    section: Optional[str] = None
    material_id: Optional[UUID] = None
    description: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    cost: Optional[Decimal] = None
    price: Optional[Decimal] = None
    discount_percent: Optional[Decimal] = None
    margin_percent: Optional[Decimal] = None # Optional override

class OfferLine(OfferLineBase):
    id: UUID
    offer_id: UUID

    class Config:
        from_attributes = True

class OfferBase(BaseModel):
    client_id: UUID
    site_id: Optional[UUID] = None
    contact_person_ids: List[UUID] = Field(default_factory=list)
    contact_person_id: Optional[UUID] = None
    contact_person_name: Optional[str] = None
    project_name: Optional[str] = None
    site_address: Optional[str] = None
    currency: str = "EUR"
    validity_days: int = 30
    payment_terms: Optional[str] = None
    delivery_time: Optional[str] = None
    notes_internal: Optional[str] = None
    notes_client: Optional[str] = None
    status: OfferStatus = OfferStatus.DRAFT
    show_discount_column: bool = False

class OfferCreate(OfferBase):
    tags: Optional[List[str]] = None

    @field_validator('status', mode='before')
    @classmethod
    def normalize_status(cls, v):
        """Normalize status to UPPERCASE to match PostgreSQL enum"""
        if v is None:
            return OfferStatus.DRAFT
        if isinstance(v, OfferStatus):
            return v
        if isinstance(v, str):
            return v.upper()
        return v

class OfferUpdate(BaseModel):
    client_id: Optional[UUID] = None
    site_id: Optional[UUID] = None
    contact_person_ids: Optional[List[UUID]] = None
    contact_person_id: Optional[UUID] = None
    contact_person_name: Optional[str] = None
    project_name: Optional[str] = None
    site_address: Optional[str] = None
    currency: Optional[str] = None
    validity_days: Optional[int] = None
    payment_terms: Optional[str] = None
    delivery_time: Optional[str] = None
    notes_internal: Optional[str] = None
    notes_client: Optional[str] = None
    status: Optional[OfferStatus] = None
    show_discount_column: Optional[bool] = None
    tags: Optional[List[str]] = None

    @field_validator('status', mode='before')
    @classmethod
    def normalize_status(cls, v):
        """Normalize status to UPPERCASE to match PostgreSQL enum"""
        if v is None:
            return None
        if isinstance(v, OfferStatus):
            return v
        if isinstance(v, str):
            return v.upper()
        return v

class OfferInDBBase(OfferBase):
    id: UUID
    offer_number: str
    user_id: UUID
    total_cost: Decimal
    total_price: Decimal
    total_margin_value: Decimal
    total_margin_percent: Decimal
    version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Offer(OfferInDBBase):
    client: Optional[Client] = None
    site: Optional[ClientSite] = None
    contacts: List[ClientContact] = Field(default_factory=list)
    tag_names: List[str] = Field(default_factory=list)
    user: Optional[User] = None
    lines: List[OfferLine] = Field(default_factory=list)
    # tags: List[Tag] ... implement tag schema if needed
