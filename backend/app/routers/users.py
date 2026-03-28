from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app import models, schemas
from app.core import deps, security
from app.core.permissions import ALL_PERMISSIONS, PermissionCode, require_permissions
from app.database import get_db

router = APIRouter()


def _normalize_permissions(permission_codes: list[str] | None) -> list[str]:
    normalized = sorted({code for code in (permission_codes or []) if code})
    invalid = [code for code in normalized if code not in ALL_PERMISSIONS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown permissions: {', '.join(invalid)}")
    return normalized


def _replace_user_permissions(
    db: Session,
    *,
    user: models.User,
    permission_codes: list[str] | None,
    actor_user_id: str,
) -> None:
    db.query(models.UserPermission).filter(models.UserPermission.user_id == user.id).delete()
    if user.role == models.UserRole.ADMIN:
        return

    for permission_code in _normalize_permissions(permission_codes):
        db.add(
            models.UserPermission(
                user_id=user.id,
                permission_code=permission_code,
                created_by_user_id=actor_user_id,
            )
        )

@router.get("/", response_model=List[schemas.user.User])
def read_users(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.USERS_MANAGE.value,
            PermissionCode.SERVICE_REQUESTS_ASSIGN.value,
            PermissionCode.SERVICE_REQUESTS_CREATE.value,
            require_all=False,
        )
    ),
) -> Any:
    query = db.query(models.User)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            (models.User.email.ilike(search_term))
            | (models.User.full_name.ilike(search_term))
            | (models.User.user_code.ilike(search_term))
        )
    users = query.offset(skip).limit(limit).all()
    return users


@router.get("/permissions-catalog", response_model=List[str])
def read_permissions_catalog(
    current_user: models.User = Depends(require_permissions(PermissionCode.USERS_MANAGE.value)),
) -> Any:
    return sorted(ALL_PERMISSIONS)

@router.post("/", response_model=schemas.user.User)
def create_user(
    *,
    db: Session = Depends(get_db),
    user_in: schemas.user.UserCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.USERS_MANAGE.value)),
) -> Any:
    user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    
    user_code = db.query(models.User).filter(models.User.user_code == user_in.user_code).first()
    if user_code:
        raise HTTPException(
            status_code=400,
            detail="The user with this user_code already exists in the system.",
        )

    db_user = models.User(
        email=user_in.email,
        password_hash=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        user_code=user_in.user_code,
        is_active=user_in.is_active,
    )
    db.add(db_user)
    db.flush()
    _replace_user_permissions(
        db,
        user=db_user,
        permission_codes=user_in.permissions,
        actor_user_id=current_user.id,
    )
    db.commit()
    db.refresh(db_user)
    return db_user

@router.patch("/{user_id}", response_model=schemas.user.User)
def update_user(
    *,
    db: Session = Depends(get_db),
    user_id: str,
    user_in: schemas.user.UserUpdate,
    current_user: models.User = Depends(require_permissions(PermissionCode.USERS_MANAGE.value)),
) -> Any:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    
    obj_data = jsonable_encoder(user)
    update_data = user_in.dict(exclude_unset=True)
    permissions = update_data.pop("permissions", None)
    
    if "password" in update_data and update_data["password"]:
        hashed_password = security.get_password_hash(update_data["password"])
        del update_data["password"]
        update_data["password_hash"] = hashed_password
        
    for field in obj_data:
        if field in update_data:
            setattr(user, field, update_data[field])

    if permissions is not None or ("role" in update_data and user.role == models.UserRole.ADMIN):
        _replace_user_permissions(
            db,
            user=user,
            permission_codes=permissions,
            actor_user_id=current_user.id,
        )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}", response_model=schemas.user.User)
def delete_user(
    *,
    db: Session = Depends(get_db),
    user_id: str,
    current_user: models.User = Depends(require_permissions(PermissionCode.USERS_MANAGE.value)),
) -> Any:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    # Soft delete
    user.is_active = False
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
