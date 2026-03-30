"""add role templates and user role links

Revision ID: 20260328_role_templates
Revises: 20260328_user_notifications
Create Date: 2026-03-28
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260328_role_templates"
down_revision = "20260328_user_notifications"
branch_labels = None
depends_on = None


ROLE_TEMPLATE_IDS = {
    "administrator": "00000000-0000-0000-0000-000000000001",
    "office": "00000000-0000-0000-0000-000000000002",
    "technician": "00000000-0000-0000-0000-000000000003",
}

user_role_enum = postgresql.ENUM(
    "ADMIN",
    "USER",
    "OFFICE",
    "TECHNICIAN",
    "CUSTOM",
    name="userrole",
    create_type=False,
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'OFFICE'")
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'TECHNICIAN'")
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'CUSTOM'")

    op.create_table(
        "role_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("role", user_role_enum, nullable=False),
        sa.Column("permission_codes", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_role_templates_code", "role_templates", ["code"], unique=True)
    op.add_column("users", sa.Column("role_template_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_users_role_template_id", "users", ["role_template_id"], unique=False)
    op.create_foreign_key(
        "fk_users_role_template_id",
        "users",
        "role_templates",
        ["role_template_id"],
        ["id"],
    )

    op.execute(
        """
        INSERT INTO role_templates (id, code, name, description, role, permission_codes, is_system, is_active)
        VALUES
            (
                '00000000-0000-0000-0000-000000000001',
                'administrator',
                'Administrator',
                'Full access across the platform, including user administration and destructive actions.',
                'ADMIN',
                '[
                    "offers.read_all",
                    "offers.read_own",
                    "offers.edit_own",
                    "offers.edit_all",
                    "clients.read",
                    "clients.manage",
                    "materials.read",
                    "materials.read_operational",
                    "materials.read_commercial",
                    "materials.manage",
                    "labor_rates.read",
                    "transport_rates.read",
                    "billing_projects.read_operational",
                    "billing_projects.read_commercial",
                    "service_requests.read_all",
                    "service_requests.read_assigned",
                    "service_requests.create",
                    "service_requests.assign",
                    "service_requests.accept",
                    "service_requests.reject",
                    "service_requests.edit",
                    "service_requests.close",
                    "work_logs.manage",
                    "material_usages.manage",
                    "warehouses.manage",
                    "equipment.manage",
                    "settings.manage",
                    "users.manage"
                ]'::jsonb,
                true,
                true
            ),
            (
                '00000000-0000-0000-0000-000000000002',
                'office',
                'Office',
                'Office coordination role for intake, assignment, client data, warehouse operations, and commercial visibility.',
                'OFFICE',
                '[
                    "offers.read_all",
                    "offers.edit_all",
                    "clients.read",
                    "clients.manage",
                    "materials.read",
                    "materials.read_operational",
                    "materials.read_commercial",
                    "materials.manage",
                    "labor_rates.read",
                    "transport_rates.read",
                    "billing_projects.read_operational",
                    "billing_projects.read_commercial",
                    "service_requests.read_all",
                    "service_requests.create",
                    "service_requests.assign",
                    "service_requests.edit",
                    "service_requests.close",
                    "work_logs.manage",
                    "material_usages.manage",
                    "warehouses.manage",
                    "equipment.manage"
                ]'::jsonb,
                true,
                true
            ),
            (
                '00000000-0000-0000-0000-000000000003',
                'technician',
                'Technician',
                'Field technician role with operational access to assigned work, materials, work logs, and equipment.',
                'TECHNICIAN',
                '[
                    "materials.read_operational",
                    "billing_projects.read_operational",
                    "service_requests.read_assigned",
                    "service_requests.accept",
                    "service_requests.reject",
                    "service_requests.edit",
                    "work_logs.manage",
                    "material_usages.manage",
                    "equipment.manage"
                ]'::jsonb,
                true,
                true
            )
        """
    )

    op.execute("UPDATE users SET role = 'OFFICE' WHERE role = 'USER'")
    op.execute(
        f"UPDATE users SET role_template_id = '{ROLE_TEMPLATE_IDS['administrator']}' WHERE role = 'ADMIN'"
    )
    op.execute(
        f"UPDATE users SET role_template_id = '{ROLE_TEMPLATE_IDS['office']}' WHERE role = 'OFFICE'"
    )
    op.execute(
        f"UPDATE users SET role_template_id = '{ROLE_TEMPLATE_IDS['technician']}' WHERE role = 'TECHNICIAN'"
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_role_template_id", "users", type_="foreignkey")
    op.drop_index("ix_users_role_template_id", table_name="users")
    op.drop_column("users", "role_template_id")
    op.drop_index("ix_role_templates_code", table_name="role_templates")
    op.drop_table("role_templates")
