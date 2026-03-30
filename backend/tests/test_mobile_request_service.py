from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.mobile_request_service import MobileRequestService


def make_signature(role: str, *, is_active: bool = True, is_refused: bool = False):
    return SimpleNamespace(
        signer_role=SimpleNamespace(value=role),
        is_active=is_active,
        is_refused=is_refused,
    )


def test_has_required_signatures_accepts_client_refusal_after_technician_signature() -> None:
    request = SimpleNamespace(
        signatures=[
            make_signature("technician"),
            make_signature("client", is_refused=True),
        ]
    )

    assert MobileRequestService._has_required_signatures(request) is True


def test_has_required_signatures_requires_real_technician_signature() -> None:
    request = SimpleNamespace(
        signatures=[
            make_signature("technician", is_refused=True),
            make_signature("client"),
        ]
    )

    assert MobileRequestService._has_required_signatures(request) is False


def test_ensure_work_started_rejects_when_no_work_logs() -> None:
    request = SimpleNamespace(work_logs=[])

    with pytest.raises(HTTPException):
        MobileRequestService._ensure_work_started(request)
