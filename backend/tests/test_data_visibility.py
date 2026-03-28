from app.core.data_visibility import (
    can_read_billing_projects_commercial,
    can_read_billing_projects_operational,
    can_read_materials_commercial,
    can_read_materials_operational,
)
from app.models.user import User, UserRole


def _build_user() -> User:
    return User(
        email="visibility@example.com",
        password_hash="hash",
        role=UserRole.USER,
        user_code="VIS",
    )


def test_material_usage_permission_allows_only_operational_visibility(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.core.data_visibility.resolve_permissions",
        lambda db, user: {"material_usages.manage"},
    )

    user = _build_user()
    assert can_read_materials_operational(None, user) is True
    assert can_read_materials_commercial(None, user) is False


def test_material_commercial_permission_unlocks_pricing(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.core.data_visibility.resolve_permissions",
        lambda db, user: {"materials.read_commercial"},
    )

    user = _build_user()
    assert can_read_materials_operational(None, user) is True
    assert can_read_materials_commercial(None, user) is True


def test_client_read_only_sees_operational_billing_data(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.core.data_visibility.resolve_permissions",
        lambda db, user: {"clients.read"},
    )

    user = _build_user()
    assert can_read_billing_projects_operational(None, user) is True
    assert can_read_billing_projects_commercial(None, user) is False


def test_labor_and_transport_rate_permissions_unlock_billing_commercial(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.core.data_visibility.resolve_permissions",
        lambda db, user: {"labor_rates.read", "transport_rates.read"},
    )

    user = _build_user()
    assert can_read_billing_projects_commercial(None, user) is True
