from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import settings
from app.database import get_db

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)


ROLE_STORAGE_NORMALIZATION_SQL = """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
        UPDATE users
        SET role = UPPER(role::text)::userrole
        WHERE role::text IN ('admin', 'user', 'office', 'technician', 'custom');

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_templates') THEN
            UPDATE role_templates
            SET role = UPPER(role::text)::userrole
            WHERE role::text IN ('admin', 'user', 'office', 'technician', 'custom');
        END IF;
    END IF;
END $$;
"""

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(reusable_oauth2)
) -> models.User:
    db.execute(text(ROLE_STORAGE_NORMALIZATION_SQL))
    db.commit()
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        token_data = schemas.token.TokenPayload(**payload)
        
        if token_data.type != "access":
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
        
    user = db.query(models.User).filter(models.User.id == token_data.sub).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def get_current_active_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def get_current_active_superuser(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(
            status_code=400, detail="The user doesn't have enough privileges"
        )
    return current_user
