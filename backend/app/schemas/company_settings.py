from typing import Optional
from pydantic import BaseModel, Field


class CompanySettingsBase(BaseModel):
    company_name: str
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[str] = None
    company_website: Optional[str] = None
    company_vat_number: Optional[str] = None
    company_registration_number: Optional[str] = None
    footer_text: Optional[str] = None
    session_timeout_minutes: int = Field(default=0, ge=0)


class CompanySettingsCreate(CompanySettingsBase):
    pass


class CompanySettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[str] = None
    company_website: Optional[str] = None
    company_vat_number: Optional[str] = None
    company_registration_number: Optional[str] = None
    footer_text: Optional[str] = None
    session_timeout_minutes: Optional[int] = Field(default=None, ge=0)


class CompanySettings(CompanySettingsBase):
    id: int

    class Config:
        from_attributes = True
