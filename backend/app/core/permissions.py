from enum import Enum
from typing import Iterable

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.core import deps
from app.database import get_db


class PermissionCode(str, Enum):
    OFFERS_READ_ALL = "offers.read_all"
    OFFERS_READ_OWN = "offers.read_own"
    OFFERS_EDIT_OWN = "offers.edit_own"
    OFFERS_EDIT_ALL = "offers.edit_all"
    CLIENTS_READ = "clients.read"
    CLIENTS_MANAGE = "clients.manage"
    MATERIALS_READ = "materials.read"
    MATERIALS_READ_OPERATIONAL = "materials.read_operational"
    MATERIALS_READ_COMMERCIAL = "materials.read_commercial"
    MATERIALS_MANAGE = "materials.manage"
    LABOR_RATES_READ = "labor_rates.read"
    TRANSPORT_RATES_READ = "transport_rates.read"
    BILLING_PROJECTS_READ_OPERATIONAL = "billing_projects.read_operational"
    BILLING_PROJECTS_READ_COMMERCIAL = "billing_projects.read_commercial"
    SERVICE_REQUESTS_READ_ALL = "service_requests.read_all"
    SERVICE_REQUESTS_READ_ASSIGNED = "service_requests.read_assigned"
    SERVICE_REQUESTS_CREATE = "service_requests.create"
    SERVICE_REQUESTS_ASSIGN = "service_requests.assign"
    SERVICE_REQUESTS_ACCEPT = "service_requests.accept"
    SERVICE_REQUESTS_REJECT = "service_requests.reject"
    SERVICE_REQUESTS_EDIT = "service_requests.edit"
    SERVICE_REQUESTS_CLOSE = "service_requests.close"
    WORK_LOGS_MANAGE = "work_logs.manage"
    MATERIAL_USAGES_MANAGE = "material_usages.manage"
    WAREHOUSES_MANAGE = "warehouses.manage"
    EQUIPMENT_MANAGE = "equipment.manage"
    SETTINGS_MANAGE = "settings.manage"
    USERS_MANAGE = "users.manage"


ALL_PERMISSIONS = {permission.value for permission in PermissionCode}


def resolve_permissions(db: Session, user: models.User) -> set[str]:
    if user.role == models.UserRole.ADMIN:
        return set(ALL_PERMISSIONS)

    rows = (
        db.query(models.UserPermission.permission_code)
        .filter(models.UserPermission.user_id == user.id)
        .all()
    )
    return {permission_code for permission_code, in rows}


def has_permissions(
    db: Session,
    user: models.User,
    required_permissions: Iterable[str],
    *,
    require_all: bool = True,
) -> bool:
    granted_permissions = resolve_permissions(db, user)
    required = set(required_permissions)
    if not required:
        return True
    if require_all:
        return required.issubset(granted_permissions)
    return bool(required & granted_permissions)


def require_permissions(*permission_codes: str, require_all: bool = True):
    def dependency(
        db: Session = Depends(get_db),
        current_user: models.User = Depends(deps.get_current_active_user),
    ) -> models.User:
        if not has_permissions(db, current_user, permission_codes, require_all=require_all):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_user

    return dependency
