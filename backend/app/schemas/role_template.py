from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.user import UserRole


class RoleTemplateBase(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=2, max_length=120)
    description: Optional[str] = None
    role: UserRole = UserRole.TECHNICIAN
    permission_codes: list[str] = Field(default_factory=list)
    is_active: bool = True


class RoleTemplateCreate(RoleTemplateBase):
    pass


class RoleTemplateUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=2, max_length=50)
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = None
    role: Optional[UserRole] = None
    permission_codes: Optional[list[str]] = None
    is_active: Optional[bool] = None


class RoleTemplate(RoleTemplateBase):
    id: UUID
    is_system: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
