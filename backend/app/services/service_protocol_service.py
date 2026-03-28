from collections import defaultdict

from app import models


class ServiceProtocolService:
    @staticmethod
    def build_preview(request: models.ServiceRequest) -> dict:
        work_logs = list(request.work_logs or [])
        material_usages = list(request.material_usages or [])

        technicians = []
        technician_names = set()
        breakdown_map: dict[str, dict[str, int]] = defaultdict(
            lambda: {
                "regular_minutes": 0,
                "overtime_minutes": 0,
                "weekend_minutes": 0,
                "holiday_minutes": 0,
                "total_minutes": 0,
            }
        )

        for assignment in request.assignments or []:
            full_name = assignment.technician_user.full_name or assignment.technician_user.email
            if full_name not in technician_names:
                technician_names.add(full_name)
                technicians.append(full_name)

        for work_log in work_logs:
            name = work_log.technician_user.full_name or work_log.technician_user.email
            if name not in technician_names:
                technician_names.add(name)
                technicians.append(name)

            bucket = breakdown_map[name]
            bucket["regular_minutes"] += work_log.minutes_regular
            bucket["overtime_minutes"] += work_log.minutes_overtime
            bucket["weekend_minutes"] += work_log.minutes_weekend
            bucket["holiday_minutes"] += work_log.minutes_holiday
            bucket["total_minutes"] += work_log.minutes_total

        technician_time_breakdown = [
            {"technician_name": name, **minutes}
            for name, minutes in breakdown_map.items()
        ]

        time_from = min((item.time_from for item in work_logs), default=None)
        time_to = max((item.time_to for item in work_logs), default=None)
        execution_date = max((item.work_date for item in work_logs), default=None)

        materials = [
            {
                "material_code": usage.material.erp_code,
                "material_name": usage.material.name,
                "quantity": usage.quantity,
                "unit": usage.unit,
                "warehouse_code": usage.warehouse.code,
                "warehouse_name": usage.warehouse.name,
            }
            for usage in material_usages
        ]

        signatures = [
            {
                "id": signature.id,
                "signer_role": signature.signer_role.value if hasattr(signature.signer_role, "value") else str(signature.signer_role),
                "signer_name": signature.signer_name,
                "signed_at": signature.signed_at,
                "signature_image_data": signature.signature_image_data,
            }
            for signature in sorted(
                [item for item in (request.signatures or []) if item.is_active],
                key=lambda item: item.signed_at or item.created_at,
            )
        ]

        total_regular = sum(item.minutes_regular for item in work_logs)
        total_overtime = sum(item.minutes_overtime for item in work_logs)
        total_weekend = sum(item.minutes_weekend for item in work_logs)
        total_holiday = sum(item.minutes_holiday for item in work_logs)
        total_minutes = sum(item.minutes_total for item in work_logs)
        work_description = "\n".join(item.activity_description for item in work_logs if item.activity_description)

        return {
            "request_id": request.id,
            "request_number": request.request_number,
            "client_name": request.client.name,
            "site_name": request.site.site_name or request.site.site_code,
            "site_address": request.site.address,
            "reason_for_visit": request.reported_problem,
            "repair_type_code": request.repair_type_code,
            "execution_date": execution_date,
            "worked_time_from": time_from,
            "worked_time_to": time_to,
            "technicians": technicians,
            "technician_time_breakdown": technician_time_breakdown,
            "total_regular_minutes": total_regular,
            "total_overtime_minutes": total_overtime,
            "total_weekend_minutes": total_weekend,
            "total_holiday_minutes": total_holiday,
            "total_minutes": total_minutes,
            "work_description": work_description,
            "materials": materials,
            "signatures": signatures,
        }
