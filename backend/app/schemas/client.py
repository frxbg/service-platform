from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field

from app.models.client_billing_project import BillingPaymentMode, BillingServiceType


class ClientSiteBase(BaseModel):
    site_code: str
    site_name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    project_number: Optional[str] = None
    notes: Optional[str] = None


class ClientSiteCreate(ClientSiteBase):
    client_id: UUID


class ClientSiteUpdate(BaseModel):
    site_code: Optional[str] = None
    site_name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    project_number: Optional[str] = None
    notes: Optional[str] = None


class ClientSiteInDBBase(ClientSiteBase):
    id: UUID
    client_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClientSite(ClientSiteInDBBase):
    pass


class ClientBillingProjectOperationalBase(BaseModel):
    site_id: Optional[UUID] = None
    project_reference: str
    project_year: Optional[str] = None
    service_type: BillingServiceType = BillingServiceType.OTHER
    payment_mode: BillingPaymentMode = BillingPaymentMode.OTHER
    description: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    is_default: bool = False
    is_active: bool = True
    notes: Optional[str] = None


class ClientBillingProjectCommercialFields(BaseModel):
    regular_labor_rate: Optional[Decimal] = None
    transport_rate: Optional[Decimal] = None


class ClientBillingProjectBase(ClientBillingProjectOperationalBase, ClientBillingProjectCommercialFields):
    pass


class ClientBillingProjectCreate(ClientBillingProjectBase):
    client_id: UUID


class ClientBillingProjectUpdate(BaseModel):
    site_id: Optional[UUID] = None
    project_reference: Optional[str] = None
    project_year: Optional[str] = None
    service_type: Optional[BillingServiceType] = None
    payment_mode: Optional[BillingPaymentMode] = None
    description: Optional[str] = None
    regular_labor_rate: Optional[Decimal] = None
    transport_rate: Optional[Decimal] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class ClientBillingProjectOperationalInDBBase(ClientBillingProjectOperationalBase):
    id: UUID
    client_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClientBillingProjectCommercialInDBBase(
    ClientBillingProjectOperationalInDBBase,
    ClientBillingProjectCommercialFields,
):
    pass


class ClientBillingProjectInDBBase(ClientBillingProjectCommercialInDBBase):
    pass


class ClientBillingProject(ClientBillingProjectInDBBase):
    pass


class ClientBillingProjectOperational(ClientBillingProjectOperationalInDBBase):
    pass


class ClientBillingProjectCommercial(ClientBillingProjectCommercialInDBBase):
    pass

class ClientContactBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role: Optional[str] = None


class ClientContactCreate(ClientContactBase):
    client_id: UUID


class ClientContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role: Optional[str] = None


class ClientContactInDBBase(ClientContactBase):
    id: UUID
    client_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClientContact(ClientContactInDBBase):
    pass


class ClientBase(BaseModel):
    name: str
    client_number: Optional[str] = None
    project_number: Optional[str] = None
    salutation_name: Optional[str] = None
    vat_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(ClientBase):
    name: Optional[str] = None

class ClientInDBBase(ClientBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    sites: List[ClientSite] = Field(default_factory=list)
    contacts: List[ClientContact] = Field(default_factory=list)
    billing_projects: List[ClientBillingProjectOperational | ClientBillingProjectCommercial] = Field(default_factory=list)

    class Config:
        from_attributes = True

class Client(ClientInDBBase):
    pass
