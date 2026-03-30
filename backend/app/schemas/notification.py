from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class UserNotification(BaseModel):
    id: UUID
    notification_type: str
    title: str
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True
