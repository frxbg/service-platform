from typing import Any

from sqlalchemy.orm import Session

from app import models


class AuditService:
    @staticmethod
    def log_event(
        db: Session,
        *,
        action: str,
        entity_type: str,
        entity_id: str | None = None,
        actor_user_id: Any = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        db.add(
            models.AuditLog(
                actor_user_id=actor_user_id,
                entity_type=entity_type,
                entity_id=entity_id,
                action=action,
                details_json=details or {},
            )
        )
