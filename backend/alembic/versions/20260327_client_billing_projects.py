"""add client billing projects and request snapshots

Revision ID: 20260327_client_billing_projects
Revises: 20260327_service_platform
Create Date: 2026-03-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260327_client_billing_projects"
down_revision = "20260327_service_platform"
branch_labels = None
depends_on = None


billing_service_type = postgresql.ENUM(
    "paid_service",
    "warranty",
    "maintenance",
    "installation",
    "subscription",
    "other",
    name="billingservicetype",
    create_type=False,
)
billing_payment_mode = postgresql.ENUM(
    "paid",
    "warranty",
    "contract",
    "internal",
    "other",
    name="billingpaymentmode",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    billing_service_type.create(bind, checkfirst=True)
    billing_payment_mode.create(bind, checkfirst=True)

    op.create_table(
        "client_billing_projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("client_sites.id", ondelete="CASCADE"), nullable=True),
        sa.Column("project_reference", sa.String(), nullable=False),
        sa.Column("project_year", sa.String(), nullable=True),
        sa.Column("service_type", billing_service_type, nullable=False, server_default="other"),
        sa.Column("payment_mode", billing_payment_mode, nullable=False, server_default="other"),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("regular_labor_rate", sa.Numeric(10, 2), nullable=True),
        sa.Column("transport_rate", sa.Numeric(10, 2), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_client_billing_projects_client_id", "client_billing_projects", ["client_id"])
    op.create_index("ix_client_billing_projects_site_id", "client_billing_projects", ["site_id"])
    op.create_index("ix_client_billing_projects_project_reference", "client_billing_projects", ["project_reference"])
    op.create_index("ix_client_billing_projects_project_year", "client_billing_projects", ["project_year"])

    op.add_column("service_requests", sa.Column("billing_project_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("service_requests", sa.Column("project_reference_snapshot", sa.String(), nullable=True))
    op.add_column("service_requests", sa.Column("service_type_snapshot", billing_service_type, nullable=True))
    op.add_column("service_requests", sa.Column("payment_mode_snapshot", billing_payment_mode, nullable=True))
    op.create_foreign_key(
        "fk_service_requests_billing_project_id",
        "service_requests",
        "client_billing_projects",
        ["billing_project_id"],
        ["id"],
    )
    op.create_index("ix_service_requests_billing_project_id", "service_requests", ["billing_project_id"])


def downgrade() -> None:
    op.drop_index("ix_service_requests_billing_project_id", table_name="service_requests")
    op.drop_constraint("fk_service_requests_billing_project_id", "service_requests", type_="foreignkey")
    op.drop_column("service_requests", "payment_mode_snapshot")
    op.drop_column("service_requests", "service_type_snapshot")
    op.drop_column("service_requests", "project_reference_snapshot")
    op.drop_column("service_requests", "billing_project_id")

    op.drop_index("ix_client_billing_projects_project_year", table_name="client_billing_projects")
    op.drop_index("ix_client_billing_projects_project_reference", table_name="client_billing_projects")
    op.drop_index("ix_client_billing_projects_site_id", table_name="client_billing_projects")
    op.drop_index("ix_client_billing_projects_client_id", table_name="client_billing_projects")
    op.drop_table("client_billing_projects")

    bind = op.get_bind()
    billing_payment_mode.drop(bind, checkfirst=True)
    billing_service_type.drop(bind, checkfirst=True)
