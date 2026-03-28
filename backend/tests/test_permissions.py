import pytest
from fastapi import HTTPException

from app.core.permissions import ALL_PERMISSIONS
from app.models.user import User, UserRole
from app.routers.users import _normalize_permissions


def test_normalize_permissions_accepts_known_values() -> None:
    sample = sorted(list(ALL_PERMISSIONS))[:3]
    result = _normalize_permissions(sample + sample)
    assert result == sorted(set(sample))


def test_normalize_permissions_rejects_unknown_values() -> None:
    with pytest.raises(HTTPException):
        _normalize_permissions(['service_requests.create', 'unknown.permission'])


def test_admin_user_exposes_all_permissions() -> None:
    user = User(
        email='admin@example.com',
        password_hash='hash',
        role=UserRole.ADMIN,
        user_code='ADM',
    )
    assert sorted(user.permissions) == sorted(ALL_PERMISSIONS)
