from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, constr
from sqlalchemy.orm import Session

from app import models, schemas
from app.core import security
from app.database import get_db

router = APIRouter()

class BootstrapStatus(BaseModel):
    initial_setup_required: bool

class FirstSuperuserCreate(BaseModel):
    email: EmailStr
    password: constr(min_length=6)
    full_name: str
    user_code: constr(min_length=2, max_length=10)

@router.get("/bootstrap-status", response_model=BootstrapStatus)
def get_bootstrap_status(
    db: Session = Depends(get_db),
) -> Any:
    """
    Check if initial setup is required (no users exist in database)
    """
    user_count = db.query(models.User).count()
    return BootstrapStatus(initial_setup_required=(user_count == 0))

@router.post("/bootstrap-superuser", response_model=schemas.user.User)
def create_first_superuser(
    user_in: FirstSuperuserCreate,
    db: Session = Depends(get_db),
) -> Any:
    """
    Create the first superuser/admin - only works when database is empty
    """
    # 1) Check if any users already exist
    user_count = db.query(models.User).count()
    if user_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Initial setup already completed.",
        )

    # 2) Check for duplicate email (shouldn't happen but being defensive)
    existing_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="User with this email already exists.",
        )

    # 3) Check for duplicate user_code
    existing_code = db.query(models.User).filter(models.User.user_code == user_in.user_code).first()
    if existing_code:
        raise HTTPException(
            status_code=400,
            detail="User with this user_code already exists.",
        )

    # 4) Create first superuser
    db_user = models.User(
        email=user_in.email,
        password_hash=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=models.UserRole.ADMIN,
        role_template_id=(
            db.query(models.RoleTemplate.id)
            .filter(models.RoleTemplate.code == "administrator")
            .scalar()
        ),
        user_code=user_in.user_code.upper(),
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
