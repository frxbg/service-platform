from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import models, schemas
from app.core import deps, security
from app.core.permissions import (
    ALL_PERMISSIONS,
    PermissionCode,
    SYSTEM_ROLE_TEMPLATE_DEFINITIONS,
    get_role_permissions,
    require_permissions,
)
from app.database import get_db

router = APIRouter()


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


def _normalize_permissions(permission_codes: list[str] | None) -> list[str]:
    normalized = sorted({code for code in (permission_codes or []) if code})
    invalid = [code for code in normalized if code not in ALL_PERMISSIONS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown permissions: {', '.join(invalid)}")
    return normalized


def _normalize_role_storage(db: Session) -> None:
    db.execute(text(ROLE_STORAGE_NORMALIZATION_SQL))
    db.commit()


def _get_role_template_or_400(db: Session, role_template_id: str | None) -> models.RoleTemplate | None:
    _normalize_role_storage(db)
    if not role_template_id:
        return None
    role_template = db.query(models.RoleTemplate).filter(models.RoleTemplate.id == role_template_id).first()
    if not role_template:
        raise HTTPException(status_code=400, detail="Selected role does not exist")
    if not role_template.is_active:
        raise HTTPException(status_code=400, detail="Selected role is inactive")
    return role_template


def _get_default_role_template(db: Session, role: models.UserRole) -> models.RoleTemplate | None:
    _normalize_role_storage(db)
    _ensure_system_role_templates(db)
    return (
        db.query(models.RoleTemplate)
        .filter(models.RoleTemplate.role == role, models.RoleTemplate.is_system.is_(True))
        .order_by(models.RoleTemplate.name.asc())
        .first()
    )


def _ensure_system_role_templates(db: Session) -> None:
    existing_codes = {
        code
        for code, in db.query(models.RoleTemplate.code).filter(models.RoleTemplate.is_system.is_(True)).all()
    }
    created_any = False

    for code, definition in SYSTEM_ROLE_TEMPLATE_DEFINITIONS.items():
        if code in existing_codes:
            continue
        db.add(
            models.RoleTemplate(
                code=code,
                name=definition["name"],
                description=definition["description"],
                role=definition["role"],
                permission_codes=_normalize_permissions(definition["permission_codes"]),
                is_system=definition.get("is_system", True),
                is_active=True,
            )
        )
        created_any = True

    if created_any:
        db.commit()


def _resolve_role_permissions(
    *,
    role: models.UserRole,
    role_template: models.RoleTemplate | None,
    explicit_permissions: list[str] | None,
) -> list[str]:
    if role == models.UserRole.ADMIN:
        return []
    if role_template:
        return _normalize_permissions(role_template.permission_codes)
    if explicit_permissions is not None:
        return _normalize_permissions(explicit_permissions)
    return _normalize_permissions(get_role_permissions(role))


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


def _sync_role_template_users(db: Session, role_template: models.RoleTemplate, *, actor_user_id: str) -> None:
    users = db.query(models.User).filter(models.User.role_template_id == role_template.id).all()
    normalized_permissions = _normalize_permissions(role_template.permission_codes)
    for user in users:
        user.role = role_template.role
        db.add(user)
        _replace_user_permissions(
            db,
            user=user,
            permission_codes=normalized_permissions,
            actor_user_id=actor_user_id,
        )


def _serialize_role_catalog() -> list[dict]:
    role_codes = {definition["role"].value for definition in SYSTEM_ROLE_TEMPLATE_DEFINITIONS.values()}
    role_codes.add(models.UserRole.CUSTOM.value)
    return [
        {"value": role_code, "label": role_code}
        for role_code in sorted(role_codes)
    ]

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
    _normalize_role_storage(db)
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


@router.get("/roles-catalog", response_model=List[dict[str, str]])
def read_roles_catalog(
    current_user: models.User = Depends(require_permissions(PermissionCode.USERS_MANAGE.value)),
) -> Any:
    return _serialize_role_catalog()


@router.get("/roles", response_model=List[schemas.role_template.RoleTemplate])
def read_role_templates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permissions(PermissionCode.USERS_MANAGE.value)),
) -> Any:
    _normalize_role_storage(db)
    _ensure_system_role_templates(db)
    return (
        db.query(models.RoleTemplate)
        .order_by(models.RoleTemplate.is_system.desc(), models.RoleTemplate.name.asc())
        .all()
    )


@router.post("/roles", response_model=schemas.role_template.RoleTemplate)
def create_role_template(
    *,
    db: Session = Depends(get_db),
    role_in: schemas.role_template.RoleTemplateCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.USERS_MANAGE.value)),
) -> Any:
    _normalize_role_storage(db)
    existing = db.query(models.RoleTemplate).filter(models.RoleTemplate.code == role_in.code.strip().lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Role code already exists")

    permission_codes = _normalize_permissions(role_in.permission_codes)
    if role_in.role == models.UserRole.ADMIN:
        permission_codes = sorted(ALL_PERMISSIONS)

    role_template = models.RoleTemplate(
        code=role_in.code.strip().lower(),
        name=role_in.name.strip(),
        description=(role_in.description or "").strip() or None,
        role=role_in.role,
        permission_codes=permission_codes,
        is_system=False,
        is_active=role_in.is_active,
    )
    db.add(role_template)
    db.commit()
    db.refresh(role_template)
    return role_template


@router.patch("/roles/{role_id}", response_model=schemas.role_template.RoleTemplate)
def update_role_template(
    *,
    db: Session = Depends(get_db),
    role_id: str,
    role_in: schemas.role_template.RoleTemplateUpdate,
    current_user: models.User = Depends(require_permissions(PermissionCode.USERS_MANAGE.value)),
) -> Any:
    _normalize_role_storage(db)
    role_template = db.query(models.RoleTemplate).filter(models.RoleTemplate.id == role_id).first()
    if not role_template:
        raise HTTPException(status_code=404, detail="Role not found")

    update_data = role_in.dict(exclude_unset=True)
    if "code" in update_data:
        normalized_code = update_data["code"].strip().lower()
        existing = (
            db.query(models.RoleTemplate)
            .filter(models.RoleTemplate.code == normalized_code, models.RoleTemplate.id != role_template.id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Role code already exists")
        update_data["code"] = normalized_code
    if "name" in update_data and update_data["name"] is not None:
        update_data["name"] = update_data["name"].strip()
    if "description" in update_data:
        update_data["description"] = (update_data["description"] or "").strip() or None
    if "permission_codes" in update_data and update_data["permission_codes"] is not None:
        update_data["permission_codes"] = _normalize_permissions(update_data["permission_codes"])
    if update_data.get("role") == models.UserRole.ADMIN:
        update_data["permission_codes"] = sorted(ALL_PERMISSIONS)

    for field, value in update_data.items():
        setattr(role_template, field, value)

    db.add(role_template)
    _sync_role_template_users(db, role_template, actor_user_id=current_user.id)
    db.commit()
    db.refresh(role_template)
    return role_template


@router.delete("/roles/{role_id}", response_model=schemas.role_template.RoleTemplate)
def delete_role_template(
    *,
    db: Session = Depends(get_db),
    role_id: str,
    current_user: models.User = Depends(require_permissions(PermissionCode.USERS_MANAGE.value)),
) -> Any:
    _normalize_role_storage(db)
    role_template = db.query(models.RoleTemplate).filter(models.RoleTemplate.id == role_id).first()
    if not role_template:
        raise HTTPException(status_code=404, detail="Role not found")

    if role_template.role == models.UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Administrator roles cannot be deleted")

    assigned_users_count = (
        db.query(models.User)
        .filter(models.User.role_template_id == role_template.id)
        .count()
    )
    if assigned_users_count > 0:
        raise HTTPException(status_code=400, detail="Role is assigned to users and cannot be deleted")

    db.delete(role_template)
    db.commit()
    return role_template


@router.post("/", response_model=schemas.user.User)
def create_user(
    *,
    db: Session = Depends(get_db),
    user_in: schemas.user.UserCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.USERS_MANAGE.value)),
) -> Any:
    _normalize_role_storage(db)
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

    role_template = _get_role_template_or_400(db, user_in.role_template_id) or _get_default_role_template(db, user_in.role)
    resolved_role = role_template.role if role_template else user_in.role
    resolved_permissions = _resolve_role_permissions(
        role=resolved_role,
        role_template=role_template,
        explicit_permissions=user_in.permissions,
    )

    db_user = models.User(
        email=user_in.email,
        password_hash=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=resolved_role,
        role_template_id=role_template.id if role_template else None,
        user_code=user_in.user_code,
        is_active=user_in.is_active,
    )
    db.add(db_user)
    db.flush()
    _replace_user_permissions(
        db,
        user=db_user,
        permission_codes=resolved_permissions,
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
    _normalize_role_storage(db)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    
    obj_data = jsonable_encoder(user)
    update_data = user_in.dict(exclude_unset=True)
    permissions = update_data.pop("permissions", None)
    next_role_template_id = update_data.pop("role_template_id", None) if "role_template_id" in update_data else None
    
    if "password" in update_data and update_data["password"]:
        hashed_password = security.get_password_hash(update_data["password"])
        del update_data["password"]
        update_data["password_hash"] = hashed_password
        
    for field in obj_data:
        if field in update_data:
            setattr(user, field, update_data[field])

    role_template = None
    role_template_updated = "role_template_id" in user_in.dict(exclude_unset=True)
    if role_template_updated:
        role_template = _get_role_template_or_400(db, next_role_template_id)
        user.role_template_id = role_template.id if role_template else None
        if role_template:
            user.role = role_template.role
        elif "role" in update_data and update_data["role"] is not None:
            user.role = update_data["role"]
            default_template = _get_default_role_template(db, user.role)
            user.role_template_id = default_template.id if default_template else None
    elif "role" in update_data and update_data["role"] is not None:
        default_template = _get_default_role_template(db, user.role)
        user.role_template_id = default_template.id if default_template else None

    if permissions is not None or role_template_updated or role_template is not None or "role" in update_data:
        resolved_permissions = _resolve_role_permissions(
            role=user.role,
            role_template=role_template,
            explicit_permissions=permissions,
        )
        _replace_user_permissions(
            db,
            user=user,
            permission_codes=resolved_permissions,
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
    _normalize_role_storage(db)
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
