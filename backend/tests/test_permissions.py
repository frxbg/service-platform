import pytest
from fastapi import HTTPException

from app.core.permissions import ALL_PERMISSIONS
from app.models.user import User, UserRole
from app.models.user_permission import UserPermission
from app.routers.users import _normalize_permissions
from app.routers.users import _replace_user_permissions


class DummySession:
    def __init__(self) -> None:
        self.flush_calls = 0

    def flush(self) -> None:
        self.flush_calls += 1


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


def test_replace_user_permissions_rebuilds_loaded_permission_entries() -> None:
    db = DummySession()
    user = User(
        id="user-1",
        email='office@example.com',
        password_hash='hash',
        role=UserRole.OFFICE,
        user_code='OFF',
    )
    old_entry = UserPermission(
        user_id="user-1",
        permission_code='clients.manage',
        created_by_user_id="actor-1",
    )
    user.permission_entries = [old_entry]

    _replace_user_permissions(
        db,
        user=user,
        permission_codes=['service_requests.create', 'users.manage'],
        actor_user_id="actor-2",
    )

    assert db.flush_calls == 1
    assert old_entry not in user.permission_entries
    assert sorted(entry.permission_code for entry in user.permission_entries) == [
        'service_requests.create',
        'users.manage',
    ]
    assert all(entry.created_by_user_id == "actor-2" for entry in user.permission_entries)


def test_replace_user_permissions_clears_entries_for_admin() -> None:
    db = DummySession()
    user = User(
        id="user-1",
        email='admin@example.com',
        password_hash='hash',
        role=UserRole.ADMIN,
        user_code='ADM',
    )
    user.permission_entries = [
        UserPermission(
            user_id="user-1",
            permission_code='clients.manage',
            created_by_user_id="actor-1",
        )
    ]

    _replace_user_permissions(
        db,
        user=user,
        permission_codes=['clients.manage'],
        actor_user_id="actor-2",
    )

    assert db.flush_calls == 1
    assert user.permission_entries == []
