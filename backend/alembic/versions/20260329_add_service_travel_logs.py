"""add service travel logs

Revision ID: 20260329_service_travel_logs
Revises: 20260328_role_templates
Create Date: 2026-03-29
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260329_service_travel_logs"
down_revision = "20260328_role_templates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "service_travel_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("technician_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("start_latitude", sa.Numeric(10, 6), nullable=True),
        sa.Column("start_longitude", sa.Numeric(10, 6), nullable=True),
        sa.Column("end_latitude", sa.Numeric(10, 6), nullable=True),
        sa.Column("end_longitude", sa.Numeric(10, 6), nullable=True),
        sa.Column("estimated_duration_minutes", sa.Integer(), nullable=True),
        sa.Column("final_duration_minutes", sa.Integer(), nullable=True),
        sa.Column("estimated_distance_km", sa.Numeric(10, 2), nullable=True),
        sa.Column("final_distance_km", sa.Numeric(10, 2), nullable=True),
        sa.Column("is_gps_estimated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("manual_adjustment_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "estimated_duration_minutes IS NULL OR estimated_duration_minutes >= 0",
            name="ck_service_travel_logs_estimated_duration_nonnegative",
        ),
        sa.CheckConstraint(
            "final_duration_minutes IS NULL OR final_duration_minutes >= 0",
            name="ck_service_travel_logs_final_duration_nonnegative",
        ),
        sa.CheckConstraint(
            "estimated_distance_km IS NULL OR estimated_distance_km >= 0",
            name="ck_service_travel_logs_estimated_distance_nonnegative",
        ),
        sa.CheckConstraint(
            "final_distance_km IS NULL OR final_distance_km >= 0",
            name="ck_service_travel_logs_final_distance_nonnegative",
        ),
    )
    op.create_index("ix_service_travel_logs_request_id", "service_travel_logs", ["request_id"])
    op.create_index("ix_service_travel_logs_technician_user_id", "service_travel_logs", ["technician_user_id"])
    op.create_index("ix_service_travel_logs_started_at", "service_travel_logs", ["started_at"])
    op.create_index("ix_service_travel_logs_ended_at", "service_travel_logs", ["ended_at"])


def downgrade() -> None:
    op.drop_index("ix_service_travel_logs_ended_at", table_name="service_travel_logs")
    op.drop_index("ix_service_travel_logs_started_at", table_name="service_travel_logs")
    op.drop_index("ix_service_travel_logs_technician_user_id", table_name="service_travel_logs")
    op.drop_index("ix_service_travel_logs_request_id", table_name="service_travel_logs")
    op.drop_table("service_travel_logs")
