import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    position = Column(String, nullable=True)  # Job title/position for PDF signature
    role = Column(Enum(UserRole), nullable=False, default=UserRole.USER)
    user_code = Column(String(10), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    permission_entries = relationship(
        "UserPermission",
        foreign_keys="UserPermission.user_id",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    @property
    def permissions(self) -> list[str]:
        if self.role == UserRole.ADMIN:
            try:
                from app.core.permissions import ALL_PERMISSIONS
                return sorted(ALL_PERMISSIONS)
            except Exception:
                return []
        return sorted(
            entry.permission_code
            for entry in (self.permission_entries or [])
            if getattr(entry, "permission_code", None)
        )
