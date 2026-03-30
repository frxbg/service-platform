from datetime import date, time
from decimal import Decimal
from types import SimpleNamespace

from app.services.service_protocol_service import ServiceProtocolService


def test_build_preview_aggregates_time_and_materials() -> None:
    technician = SimpleNamespace(full_name='Tech One', email='tech@example.com')
    warehouse = SimpleNamespace(code='WH-1', name='Main Warehouse')
    material = SimpleNamespace(erp_code='MAT-100', name='Compressor', unit='pcs')

    request = SimpleNamespace(
        id='req-1',
        request_number='SR-2026-0001',
        client=SimpleNamespace(name='Client A'),
        site=SimpleNamespace(site_name='Site Alpha', site_code='ALPHA', address='Sofia'),
        reported_problem='Cooling failure',
        repair_type_code='repair',
        assignments=[SimpleNamespace(technician_user=technician)],
        work_logs=[
            SimpleNamespace(
                technician_user=technician,
                minutes_regular=120,
                minutes_overtime=30,
                minutes_weekend=0,
                minutes_holiday=0,
                minutes_total=150,
                work_date=date(2026, 3, 27),
                time_from=time(8, 0),
                time_to=time(10, 30),
                activity_description='Diagnostics and replacement',
            )
        ],
        material_usages=[
            SimpleNamespace(
                material=material,
                quantity=Decimal('1.000'),
                unit='pcs',
                warehouse=warehouse,
            )
        ],
    )

    preview = ServiceProtocolService.build_preview(request)

    assert preview['request_number'] == 'SR-2026-0001'
    assert preview['client_name'] == 'Client A'
    assert preview['technicians'] == ['Tech One']
    assert preview['total_minutes'] == 150
    assert preview['total_regular_minutes'] == 120
    assert preview['total_overtime_minutes'] == 30
    assert preview['materials'][0]['material_code'] == 'MAT-100'


def test_build_preview_includes_client_signature_remark_and_refusal() -> None:
    technician = SimpleNamespace(full_name='Tech One', email='tech@example.com')

    request = SimpleNamespace(
        id='req-2',
        request_number='SR-2026-0002',
        client=SimpleNamespace(name='Client B'),
        site=SimpleNamespace(site_name='Site Beta', site_code='BETA', address='Plovdiv'),
        reported_problem='Leak detected',
        repair_type_code='repair',
        assignments=[SimpleNamespace(technician_user=technician)],
        work_logs=[],
        material_usages=[],
        signatures=[
            SimpleNamespace(
                id='sig-tech',
                signer_role=SimpleNamespace(value='technician'),
                signer_name='Tech One',
                signed_at='2026-03-30T10:00:00Z',
                signature_image_data='data:image/png;base64,abc',
                is_active=True,
                is_refused=False,
                refusal_reason=None,
                client_remark=None,
                created_at='2026-03-30T10:00:00Z',
            ),
            SimpleNamespace(
                id='sig-client',
                signer_role=SimpleNamespace(value='client'),
                signer_name='Client Contact',
                signed_at='2026-03-30T10:05:00Z',
                signature_image_data=None,
                is_active=True,
                is_refused=True,
                refusal_reason='Client unavailable for signing',
                client_remark='Observed cosmetic damage on the panel.',
                created_at='2026-03-30T10:05:00Z',
            ),
        ],
    )

    preview = ServiceProtocolService.build_preview(request)

    client_signature = preview['signatures'][-1]
    assert client_signature['is_refused'] is True
    assert client_signature['refusal_reason'] == 'Client unavailable for signing'
    assert client_signature['client_remark'] == 'Observed cosmetic damage on the panel.'
