from app.core.offer_permissions import (
    apply_offer_visibility_filter,
    can_edit_offer,
    can_read_offer,
)
from app.models.offer import Offer, OfferStatus
from app.models.user import User, UserRole


class DummyQuery:
    def __init__(self) -> None:
        self.filter_calls = 0

    def filter(self, *_args, **_kwargs):
        self.filter_calls += 1
        return self


def build_user(user_id: str = "owner-id") -> User:
    return User(
        id=user_id,
        email=f"{user_id}@example.com",
        password_hash="hash",
        role=UserRole.USER,
        user_code="USR",
    )


def build_offer(owner_id: str, status: OfferStatus) -> Offer:
    return Offer(
        user_id=owner_id,
        status=status,
        offer_number="OF-1",
        project_name="Project",
        site_address="Site",
        currency="EUR",
        validity_days=30,
        payment_terms="Cash",
        delivery_time="5 days",
    )


def test_apply_offer_visibility_filter_keeps_full_query_for_global_access() -> None:
    query = DummyQuery()
    user = build_user()

    result = apply_offer_visibility_filter(
        query,
        permission_codes={"offers.edit_all"},
        user=user,
    )

    assert result is query
    assert query.filter_calls == 0


def test_apply_offer_visibility_filter_limits_query_for_own_scope() -> None:
    query = DummyQuery()
    user = build_user()

    result = apply_offer_visibility_filter(
        query,
        permission_codes={"offers.read_own"},
        user=user,
    )

    assert result is query
    assert query.filter_calls == 1


def test_can_read_offer_allows_owner_and_non_draft_for_own_scope() -> None:
    user = build_user("user-1")
    other_offer = build_offer("user-2", OfferStatus.PUBLISHED)
    draft_offer = build_offer("user-2", OfferStatus.DRAFT)
    own_draft = build_offer("user-1", OfferStatus.DRAFT)

    assert can_read_offer(permission_codes={"offers.read_own"}, user=user, offer=other_offer) is True
    assert can_read_offer(permission_codes={"offers.read_own"}, user=user, offer=draft_offer) is False
    assert can_read_offer(permission_codes={"offers.read_own"}, user=user, offer=own_draft) is True


def test_can_edit_offer_requires_owner_for_own_scope() -> None:
    user = build_user("user-1")
    own_offer = build_offer("user-1", OfferStatus.DRAFT)
    other_offer = build_offer("user-2", OfferStatus.DRAFT)

    assert can_edit_offer(permission_codes={"offers.edit_own"}, user=user, offer=own_offer) is True
    assert can_edit_offer(permission_codes={"offers.edit_own"}, user=user, offer=other_offer) is False
    assert can_edit_offer(permission_codes={"offers.edit_all"}, user=user, offer=other_offer) is True
