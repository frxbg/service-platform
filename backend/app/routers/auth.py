from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from pydantic import ValidationError

from app import models, schemas
from app.core import security, deps
from app.config import settings
from app.database import get_db
from app.services import email_service
from app.services.audit_service import AuditService

router = APIRouter()

@router.post("/login", response_model=schemas.token.Token)
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.password_hash):
        AuditService.log_event(
            db,
            action="auth.login_failed",
            entity_type="auth",
            details={"email": form_data.username},
        )
        db.commit()
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token_expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRES_MINUTES)
    refresh_token_expires = timedelta(minutes=settings.JWT_REFRESH_TOKEN_EXPIRES_MINUTES)
    
    AuditService.log_event(
        db,
        action="auth.login_success",
        entity_type="auth",
        actor_user_id=user.id,
        details={"email": user.email},
    )
    db.commit()

    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "refresh_token": security.create_refresh_token(
            user.id, expires_delta=refresh_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/refresh", response_model=schemas.token.Token)
def refresh_token(
    payload: schemas.token.RefreshTokenRequest,
    db: Session = Depends(get_db)
) -> Any:
    try:
        payload = jwt.decode(
            payload.refresh_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        token_data = schemas.token.TokenPayload(**payload)
        
        if token_data.type != "refresh":
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
        
    user = db.query(models.User).filter(models.User.id == token_data.sub).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token_expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRES_MINUTES)
    refresh_token_expires = timedelta(minutes=settings.JWT_REFRESH_TOKEN_EXPIRES_MINUTES)

    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "refresh_token": security.create_refresh_token(
            user.id, expires_delta=refresh_token_expires
        ),
        "token_type": "bearer",
    }

@router.get("/me", response_model=schemas.user.User)
def read_users_me(
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    return current_user

@router.patch("/me", response_model=schemas.user.User)
def update_user_me(
    *,
    db: Session = Depends(get_db),
    user_in: schemas.user.UserUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update current user's own profile (full_name, position)
    """
    # Only allow updating certain fields
    update_data = user_in.model_dump(exclude_unset=True, exclude={'email', 'role', 'is_active', 'user_code', 'password'})
    
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.post("/me/change-password")
def change_user_me_password(
    *,
    db: Session = Depends(get_db),
    payload: schemas.user.ChangePasswordRequest,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    if not security.verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must be different")

    current_user.password_hash = security.get_password_hash(payload.new_password)
    db.add(current_user)
    AuditService.log_event(
        db,
        action="auth.password_changed",
        entity_type="user",
        entity_id=str(current_user.id),
        actor_user_id=current_user.id,
    )
    db.commit()

    return {"message": "Password updated successfully"}

@router.post("/password-reset/request")
def request_password_reset(
    payload: schemas.password_reset.PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Any:
    user = db.query(models.User).filter(models.User.email == payload.email).first()

    # Always respond success to avoid leaking which emails exist
    if not user:
        return {"message": "If that email exists, a reset link has been sent."}

    reset_token = security.create_password_reset_token(user.id)
    frontend_base = settings.FRONTEND_BASE_URL or "http://localhost:5173"
    reset_link = f"{frontend_base.rstrip('/')}/reset-password?token={reset_token}"

    subject = "Reset your Service Platform password"
    body = (
        "You requested a password reset for your Service Platform account.\n\n"
        f"Reset link: {reset_link}\n\n"
        "If you did not request this, you can ignore this email."
    )

    try:
        background_tasks.add_task(
            email_service.send_email,
            to_email=user.email,
            subject=subject,
            body=body,
        )
    except email_service.EmailNotConfigured as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    return {"message": "If that email exists, a reset link has been sent."}

@router.post("/password-reset/confirm")
def confirm_password_reset(
    payload: schemas.password_reset.PasswordResetConfirm,
    db: Session = Depends(get_db),
) -> Any:
    try:
        user_id = security.decode_password_reset_token(payload.token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = security.get_password_hash(payload.new_password)
    db.add(user)
    db.commit()

    return {"message": "Password updated successfully"}
