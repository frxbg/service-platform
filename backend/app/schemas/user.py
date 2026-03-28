from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from app.models.user import UserRole

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    position: Optional[str] = None
    is_active: Optional[bool] = True
    role: UserRole = UserRole.USER
    user_code: str

class UserCreate(UserBase):
    password: str
    permissions: list[str] = Field(default_factory=list)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    position: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None
    user_code: Optional[str] = None
    permissions: Optional[list[str]] = None

class UserInDBBase(UserBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    permissions: list[str] = Field(default_factory=list)

    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)
