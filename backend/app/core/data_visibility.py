from app import models
from app.core.permissions import PermissionCode, resolve_permissions
from sqlalchemy.orm import Session


def _granted_permissions(db: Session, user: models.User) -> set[str]:
    return resolve_permissions(db, user)


def can_read_materials_operational(db: Session, user: models.User) -> bool:
    granted = _granted_permissions(db, user)
    return bool(
        granted
        & {
            PermissionCode.MATERIALS_READ.value,
            PermissionCode.MATERIALS_READ_OPERATIONAL.value,
            PermissionCode.MATERIALS_READ_COMMERCIAL.value,
            PermissionCode.MATERIALS_MANAGE.value,
            PermissionCode.MATERIAL_USAGES_MANAGE.value,
        }
    )


def can_read_materials_commercial(db: Session, user: models.User) -> bool:
    granted = _granted_permissions(db, user)
    return bool(
        granted
        & {
            PermissionCode.MATERIALS_READ_COMMERCIAL.value,
            PermissionCode.MATERIALS_MANAGE.value,
        }
    )


def can_read_billing_projects_operational(db: Session, user: models.User) -> bool:
    granted = _granted_permissions(db, user)
    return bool(
        granted
        & {
            PermissionCode.CLIENTS_READ.value,
            PermissionCode.CLIENTS_MANAGE.value,
            PermissionCode.BILLING_PROJECTS_READ_OPERATIONAL.value,
            PermissionCode.BILLING_PROJECTS_READ_COMMERCIAL.value,
        }
    )


def can_read_billing_projects_commercial(db: Session, user: models.User) -> bool:
    granted = _granted_permissions(db, user)
    has_explicit_commercial = bool(
        granted
        & {
            PermissionCode.CLIENTS_MANAGE.value,
            PermissionCode.BILLING_PROJECTS_READ_COMMERCIAL.value,
        }
    )
    has_rate_permissions = {
        PermissionCode.LABOR_RATES_READ.value,
        PermissionCode.TRANSPORT_RATES_READ.value,
    }.issubset(granted)
    return has_explicit_commercial or has_rate_permissions
