"""add service platform foundation

Revision ID: 20260327_service_platform
Revises: 20260327_session_timeout
Create Date: 2026-03-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260327_service_platform"
down_revision = "20260327_session_timeout"
branch_labels = None
depends_on = None


service_request_source = postgresql.ENUM(
    "phone",
    "email",
    "external_number",
    "onsite",
    "other",
    name="servicerequestsource",
    create_type=False,
)
service_request_priority = postgresql.ENUM(
    "low",
    "standard",
    "high",
    "urgent",
    name="servicerequestpriority",
    create_type=False,
)
service_request_status = postgresql.ENUM(
    "NEW",
    "ASSIGNED",
    "PENDING_ACCEPTANCE",
    "ACCEPTED",
    "REJECTED_BY_TECHNICIAN",
    "IN_PROGRESS",
    "WAITING_PARTS",
    "WAITING_CLIENT",
    "COMPLETED",
    "CLOSED",
    "CANCELLED",
    name="servicerequeststatus",
    create_type=False,
)
service_assignment_status = postgresql.ENUM(
    "pending",
    "accepted",
    "rejected",
    "cancelled",
    name="serviceassignmentstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    service_request_source.create(bind, checkfirst=True)
    service_request_priority.create(bind, checkfirst=True)
    service_request_status.create(bind, checkfirst=True)
    service_assignment_status.create(bind, checkfirst=True)

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", sa.String(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("details_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"])
    op.create_index("ix_audit_logs_entity_type", "audit_logs", ["entity_type"])
    op.create_index("ix_audit_logs_entity_id", "audit_logs", ["entity_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])

    op.create_table(
        "user_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("permission_code", sa.String(), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "permission_code", name="uq_user_permission_code"),
    )
    op.create_index("ix_user_permissions_user_id", "user_permissions", ["user_id"])
    op.create_index("ix_user_permissions_permission_code", "user_permissions", ["permission_code"])

    op.create_table(
        "warehouses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("responsible_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("code"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_warehouses_code", "warehouses", ["code"])
    op.create_index("ix_warehouses_name", "warehouses", ["name"])

    op.create_table(
        "service_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("request_number", sa.String(), nullable=False),
        sa.Column("external_order_number", sa.String(), nullable=True),
        sa.Column("source", service_request_source, nullable=False, server_default="other"),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("client_sites.id"), nullable=False),
        sa.Column("responsible_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reported_problem", sa.Text(), nullable=False),
        sa.Column("request_reason_code", sa.String(), nullable=True),
        sa.Column("repair_type_code", sa.String(), nullable=True),
        sa.Column("priority", service_request_priority, nullable=False, server_default="standard"),
        sa.Column("status", service_request_status, nullable=False, server_default="NEW"),
        sa.Column("reported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("discovered_during_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_requests.id"), nullable=True),
        sa.Column("notes_internal", sa.Text(), nullable=True),
        sa.Column("notes_client", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("request_number"),
    )
    op.create_index("ix_service_requests_request_number", "service_requests", ["request_number"])
    op.create_index("ix_service_requests_external_order_number", "service_requests", ["external_order_number"])
    op.create_index("ix_service_requests_client_id", "service_requests", ["client_id"])
    op.create_index("ix_service_requests_site_id", "service_requests", ["site_id"])
    op.create_index("ix_service_requests_responsible_user_id", "service_requests", ["responsible_user_id"])
    op.create_index("ix_service_requests_created_by_user_id", "service_requests", ["created_by_user_id"])
    op.create_index(
        "ix_service_requests_status_priority_reported_at",
        "service_requests",
        ["status", "priority", "reported_at"],
    )

    op.create_table(
        "service_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("technician_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("assignment_status", service_assignment_status, nullable=False, server_default="pending"),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("request_id", "technician_user_id", name="uq_service_assignment_request_technician"),
    )
    op.create_index("ix_service_assignments_request_id", "service_assignments", ["request_id"])
    op.create_index("ix_service_assignments_technician_user_id", "service_assignments", ["technician_user_id"])

    op.create_table(
        "work_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("technician_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("time_from", sa.Time(), nullable=False),
        sa.Column("time_to", sa.Time(), nullable=False),
        sa.Column("minutes_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("minutes_regular", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("minutes_overtime", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("minutes_weekend", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("minutes_holiday", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("activity_description", sa.Text(), nullable=False),
        sa.Column("repair_type_code", sa.String(), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("minutes_total >= 0", name="ck_work_logs_minutes_total_nonnegative"),
        sa.CheckConstraint("minutes_regular >= 0", name="ck_work_logs_minutes_regular_nonnegative"),
        sa.CheckConstraint("minutes_overtime >= 0", name="ck_work_logs_minutes_overtime_nonnegative"),
        sa.CheckConstraint("minutes_weekend >= 0", name="ck_work_logs_minutes_weekend_nonnegative"),
        sa.CheckConstraint("minutes_holiday >= 0", name="ck_work_logs_minutes_holiday_nonnegative"),
    )
    op.create_index("ix_work_logs_request_id", "work_logs", ["request_id"])
    op.create_index("ix_work_logs_technician_user_id", "work_logs", ["technician_user_id"])
    op.create_index("ix_work_logs_work_date", "work_logs", ["work_date"])

    op.create_table(
        "material_usages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("material_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("materials.id"), nullable=False),
        sa.Column("warehouse_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("technician_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 3), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("used_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("quantity >= 0", name="ck_material_usages_quantity_nonnegative"),
    )
    op.create_index("ix_material_usages_request_id", "material_usages", ["request_id"])
    op.create_index("ix_material_usages_material_id", "material_usages", ["material_id"])
    op.create_index("ix_material_usages_warehouse_id", "material_usages", ["warehouse_id"])
    op.create_index("ix_material_usages_technician_user_id", "material_usages", ["technician_user_id"])

    op.create_table(
        "equipment_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_requests.id", ondelete="SET NULL"), nullable=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("client_sites.id"), nullable=False),
        sa.Column("equipment_type", sa.String(), nullable=False),
        sa.Column("manufacturer", sa.String(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("serial_number", sa.String(), nullable=True),
        sa.Column("asset_tag", sa.String(), nullable=True),
        sa.Column("location_note", sa.String(), nullable=True),
        sa.Column("refrigerant", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_equipment_assets_request_id", "equipment_assets", ["request_id"])
    op.create_index("ix_equipment_assets_client_id", "equipment_assets", ["client_id"])
    op.create_index("ix_equipment_assets_site_id", "equipment_assets", ["site_id"])
    op.create_index("ix_equipment_assets_serial_number", "equipment_assets", ["serial_number"])
    op.create_index("ix_equipment_assets_asset_tag", "equipment_assets", ["asset_tag"])


def downgrade() -> None:
    op.drop_index("ix_equipment_assets_asset_tag", table_name="equipment_assets")
    op.drop_index("ix_equipment_assets_serial_number", table_name="equipment_assets")
    op.drop_index("ix_equipment_assets_site_id", table_name="equipment_assets")
    op.drop_index("ix_equipment_assets_client_id", table_name="equipment_assets")
    op.drop_index("ix_equipment_assets_request_id", table_name="equipment_assets")
    op.drop_table("equipment_assets")

    op.drop_index("ix_material_usages_technician_user_id", table_name="material_usages")
    op.drop_index("ix_material_usages_warehouse_id", table_name="material_usages")
    op.drop_index("ix_material_usages_material_id", table_name="material_usages")
    op.drop_index("ix_material_usages_request_id", table_name="material_usages")
    op.drop_table("material_usages")

    op.drop_index("ix_work_logs_work_date", table_name="work_logs")
    op.drop_index("ix_work_logs_technician_user_id", table_name="work_logs")
    op.drop_index("ix_work_logs_request_id", table_name="work_logs")
    op.drop_table("work_logs")

    op.drop_index("ix_service_assignments_technician_user_id", table_name="service_assignments")
    op.drop_index("ix_service_assignments_request_id", table_name="service_assignments")
    op.drop_table("service_assignments")

    op.drop_index("ix_service_requests_status_priority_reported_at", table_name="service_requests")
    op.drop_index("ix_service_requests_created_by_user_id", table_name="service_requests")
    op.drop_index("ix_service_requests_responsible_user_id", table_name="service_requests")
    op.drop_index("ix_service_requests_site_id", table_name="service_requests")
    op.drop_index("ix_service_requests_client_id", table_name="service_requests")
    op.drop_index("ix_service_requests_external_order_number", table_name="service_requests")
    op.drop_index("ix_service_requests_request_number", table_name="service_requests")
    op.drop_table("service_requests")

    op.drop_index("ix_warehouses_name", table_name="warehouses")
    op.drop_index("ix_warehouses_code", table_name="warehouses")
    op.drop_table("warehouses")

    op.drop_index("ix_user_permissions_permission_code", table_name="user_permissions")
    op.drop_index("ix_user_permissions_user_id", table_name="user_permissions")
    op.drop_table("user_permissions")

    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_entity_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_entity_type", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    bind = op.get_bind()
    service_assignment_status.drop(bind, checkfirst=True)
    service_request_status.drop(bind, checkfirst=True)
    service_request_priority.drop(bind, checkfirst=True)
    service_request_source.drop(bind, checkfirst=True)
