from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
from decimal import Decimal

class MaterialOperationalBase(BaseModel):
    erp_code: str
    barcode: Optional[str] = None
    name: str
    description: Optional[str] = None
    unit: str
    category: str
    subcategory: Optional[str] = None
    is_active: bool = True


class MaterialCommercialFields(BaseModel):
    cost_currency: str = "EUR"
    cost: Decimal
    default_margin_percent: Optional[Decimal] = None
    default_sell_price: Optional[Decimal] = None


class MaterialBase(MaterialOperationalBase, MaterialCommercialFields):
    pass

class MaterialCreate(MaterialBase):
    pass

class MaterialUpdate(BaseModel):
    erp_code: Optional[str] = None
    barcode: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    cost: Optional[Decimal] = None
    cost_currency: Optional[str] = None
    default_margin_percent: Optional[Decimal] = None
    default_sell_price: Optional[Decimal] = None
    is_active: Optional[bool] = None

class MaterialOperationalInDBBase(MaterialOperationalBase):
    id: UUID
    last_synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MaterialCommercialInDBBase(MaterialOperationalInDBBase, MaterialCommercialFields):
    pass


class MaterialOperational(MaterialOperationalInDBBase):
    pass


class MaterialCommercial(MaterialCommercialInDBBase):
    pass


class MaterialInDBBase(MaterialCommercialInDBBase):
    pass

class Material(MaterialInDBBase):
    pass


class MaterialOfferUsageOperational(BaseModel):
    offer_id: UUID
    offer_number: str
    offer_status: str
    client_name: Optional[str] = None
    project_name: Optional[str] = None
    quantity: Decimal
    unit: Optional[str] = None
    line_no: int
    created_at: Optional[datetime] = None


class MaterialOfferUsageCommercial(MaterialOfferUsageOperational):
    line_price: Decimal
    line_cost: Decimal


class MaterialDetailsOperational(MaterialOperational):
    offers: List[MaterialOfferUsageOperational] = Field(default_factory=list)
    usage_count: int = 0


class MaterialDetailsCommercial(MaterialCommercial):
    offers: List[MaterialOfferUsageCommercial] = Field(default_factory=list)
    usage_count: int = 0


class MaterialDetails(MaterialDetailsCommercial):
    pass
