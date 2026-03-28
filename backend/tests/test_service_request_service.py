from datetime import date, datetime, time
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app import models
from app.services.service_request_service import ServiceRequestService


def test_split_minutes_regular_and_overtime_on_weekday() -> None:
    total, regular, overtime, weekend, holiday = ServiceRequestService._split_minutes_by_category(
        work_date=date(2026, 3, 27),
        time_from=time(7, 30),
        time_to=time(17, 30),
        is_holiday_override=False,
    )

    assert total == 600
    assert regular == 540
    assert overtime == 60
    assert weekend == 0
    assert holiday == 0


def test_split_minutes_weekend_bucket() -> None:
    total, regular, overtime, weekend, holiday = ServiceRequestService._split_minutes_by_category(
        work_date=date(2026, 3, 28),
        time_from=time(9, 0),
        time_to=time(11, 0),
        is_holiday_override=False,
    )

    assert total == 120
    assert regular == 0
    assert overtime == 0
    assert weekend == 120
    assert holiday == 0


def test_split_minutes_holiday_override_bucket() -> None:
    total, regular, overtime, weekend, holiday = ServiceRequestService._split_minutes_by_category(
        work_date=date(2026, 3, 27),
        time_from=time(9, 0),
        time_to=time(10, 30),
        is_holiday_override=True,
    )

    assert total == 90
    assert regular == 0
    assert overtime == 0
    assert weekend == 0
    assert holiday == 90


def test_split_minutes_rejects_invalid_ranges() -> None:
    with pytest.raises(HTTPException):
        ServiceRequestService._split_minutes_by_category(
            work_date=date(2026, 3, 27),
            time_from=time(10, 0),
            time_to=time(9, 0),
            is_holiday_override=False,
        )


class DummyQuery:
    def __init__(self, items):
        self.items = items

    def order_by(self, *_args, **_kwargs):
        return self

    def all(self):
        return self.items


def build_dashboard_request(
    *,
    status: models.ServiceRequestStatus,
    priority: models.ServiceRequestPriority,
    assigned_names: list[str] | None = None,
):
    request_id = uuid4()
    reported_at = datetime(2026, 3, 27, 9, 0)
    assignments = [
        SimpleNamespace(
            technician_user=SimpleNamespace(
                full_name=name,
                email=f"{name.lower().replace(' ', '.')}@example.com",
            )
        )
        for name in (assigned_names or [])
    ]
    return SimpleNamespace(
        id=request_id,
        request_number=f"SR-{str(request_id)[:8]}",
        client=SimpleNamespace(id=uuid4(), name="Client", client_number="C-1"),
        site=SimpleNamespace(id=uuid4(), site_code="SITE-1", site_name="Main site", address="Address"),
        responsible_user=SimpleNamespace(id=uuid4(), full_name="Dispatcher", email="dispatcher@example.com"),
        priority=priority,
        status=status,
        assignments=assignments,
        reported_at=reported_at,
        created_at=reported_at,
    )


def test_build_dashboard_summary_counts_and_deduplicates(monkeypatch) -> None:
    first = build_dashboard_request(
        status=models.ServiceRequestStatus.NEW,
        priority=models.ServiceRequestPriority.URGENT,
    )
    duplicate_first = first
    second = build_dashboard_request(
        status=models.ServiceRequestStatus.IN_PROGRESS,
        priority=models.ServiceRequestPriority.STANDARD,
        assigned_names=["Tech One"],
    )
    third = build_dashboard_request(
        status=models.ServiceRequestStatus.CLOSED,
        priority=models.ServiceRequestPriority.HIGH,
        assigned_names=["Tech Two"],
    )

    monkeypatch.setattr(
        ServiceRequestService,
        "_get_visibility_scope_query",
        staticmethod(lambda *_args, **_kwargs: DummyQuery([first, duplicate_first, second, third])),
    )

    summary = ServiceRequestService.build_dashboard_summary(
        db=None,
        current_user=SimpleNamespace(id=uuid4()),
    )

    assert summary["total_requests"] == 3
    assert summary["active_requests"] == 2
    assert summary["new_requests"] == 1
    assert summary["urgent_requests"] == 1
    assert summary["in_progress_requests"] == 1
    assert summary["unassigned_requests"] == 1
    assert summary["status_breakdown"]["NEW"] == 1
    assert summary["status_breakdown"]["IN_PROGRESS"] == 1
    assert summary["status_breakdown"]["CLOSED"] == 1
    assert len(summary["recent_requests"]) == 3
