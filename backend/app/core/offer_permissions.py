from typing import Any, Iterable

from sqlalchemy import false, or_
from sqlalchemy.orm import Session

from app import models
from app.core.permissions import PermissionCode, resolve_permissions


READ_ALL_OFFERS = {
    PermissionCode.OFFERS_READ_ALL.value,
    PermissionCode.OFFERS_EDIT_ALL.value,
}
READ_OWN_OFFERS = {
    PermissionCode.OFFERS_READ_OWN.value,
    PermissionCode.OFFERS_EDIT_OWN.value,
}
EDIT_ALL_OFFERS = {PermissionCode.OFFERS_EDIT_ALL.value}
EDIT_OWN_OFFERS = {PermissionCode.OFFERS_EDIT_OWN.value}


def _normalize_permissions(permission_codes: Iterable[str]) -> set[str]:
    return {code for code in permission_codes if code}


def can_read_all_offers(permission_codes: Iterable[str]) -> bool:
    granted = _normalize_permissions(permission_codes)
    return bool(granted & READ_ALL_OFFERS)


def can_read_own_offers(permission_codes: Iterable[str]) -> bool:
    granted = _normalize_permissions(permission_codes)
    return bool(granted & READ_OWN_OFFERS) or can_read_all_offers(granted)


def can_edit_all_offers(permission_codes: Iterable[str]) -> bool:
    granted = _normalize_permissions(permission_codes)
    return bool(granted & EDIT_ALL_OFFERS)


def can_edit_own_offers(permission_codes: Iterable[str]) -> bool:
    granted = _normalize_permissions(permission_codes)
    return bool(granted & EDIT_OWN_OFFERS) or can_edit_all_offers(granted)


def apply_offer_visibility_filter(query: Any, *, permission_codes: Iterable[str], user: models.User) -> Any:
    granted = _normalize_permissions(permission_codes)
    if can_read_all_offers(granted):
        return query
    if can_read_own_offers(granted):
        return query.filter(
            or_(
                models.Offer.status != models.OfferStatus.DRAFT,
                models.Offer.user_id == user.id,
            )
        )
    return query.filter(false())


def can_read_offer(
    *,
    permission_codes: Iterable[str],
    user: models.User,
    offer: models.Offer,
) -> bool:
    granted = _normalize_permissions(permission_codes)
    if can_read_all_offers(granted):
        return True
    if not can_read_own_offers(granted):
        return False
    if offer.user_id == user.id:
        return True
    return offer.status != models.OfferStatus.DRAFT


def can_edit_offer(
    *,
    permission_codes: Iterable[str],
    user: models.User,
    offer: models.Offer,
) -> bool:
    granted = _normalize_permissions(permission_codes)
    if can_edit_all_offers(granted):
        return True
    if not can_edit_own_offers(granted):
        return False
    return offer.user_id == user.id


def resolve_offer_permissions(db: Session, user: models.User) -> set[str]:
    return resolve_permissions(db, user)
