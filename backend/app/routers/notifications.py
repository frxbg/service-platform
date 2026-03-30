from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.core import deps
from app.database import get_db

router = APIRouter()


def _serialize_notification(notification: models.UserNotification) -> dict[str, Any]:
    return {
        "id": str(notification.id),
        "notification_type": notification.notification_type,
        "title": notification.title,
        "message": notification.message,
        "entity_type": notification.entity_type,
        "entity_id": str(notification.entity_id) if notification.entity_id else None,
        "is_read": notification.is_read,
        "created_at": notification.created_at,
        "read_at": notification.read_at,
    }


def _get_user_notification_or_404(db: Session, *, notification_id: UUID, user_id: UUID) -> models.UserNotification:
    notification = (
        db.query(models.UserNotification)
        .filter(
            models.UserNotification.id == notification_id,
            models.UserNotification.user_id == user_id,
        )
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


@router.get("", response_model=list[schemas.notification.UserNotification])
def read_my_notifications(
    db: Session = Depends(get_db),
    unread_only: bool = False,
    limit: int = 50,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    query = db.query(models.UserNotification).filter(models.UserNotification.user_id == current_user.id)
    if unread_only:
        query = query.filter(models.UserNotification.is_read.is_(False))
    notifications = (
        query
        .order_by(models.UserNotification.created_at.desc())
        .limit(max(1, min(limit, 200)))
        .all()
    )
    return [_serialize_notification(item) for item in notifications]


@router.post("/read-all")
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    notifications = (
        db.query(models.UserNotification)
        .filter(
            models.UserNotification.user_id == current_user.id,
            models.UserNotification.is_read.is_(False),
        )
        .all()
    )
    read_at = datetime.utcnow()
    for notification in notifications:
        notification.is_read = True
        notification.read_at = read_at
        db.add(notification)
    db.commit()
    return {"updated": len(notifications)}


@router.post("/{notification_id}/read", response_model=schemas.notification.UserNotification)
def mark_notification_as_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    notification = _get_user_notification_or_404(
        db,
        notification_id=notification_id,
        user_id=current_user.id,
    )
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        db.add(notification)
        db.commit()
        db.refresh(notification)
    return _serialize_notification(notification)
