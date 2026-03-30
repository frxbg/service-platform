"""extend mobile signature workflow fields

Revision ID: 20260330_sig_flow
Revises: 20260329_service_travel_logs
Create Date: 2026-03-30
"""

from alembic import op
import sqlalchemy as sa


revision = "20260330_sig_flow"
down_revision = "20260329_service_travel_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("service_protocol_signatures", "signature_image_data", existing_type=sa.Text(), nullable=True)
    op.add_column(
        "service_protocol_signatures",
        sa.Column("is_refused", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "service_protocol_signatures",
        sa.Column("refusal_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "service_protocol_signatures",
        sa.Column("client_remark", sa.Text(), nullable=True),
    )
    op.execute("UPDATE service_protocol_signatures SET is_refused = false WHERE is_refused IS NULL")
    op.alter_column("service_protocol_signatures", "is_refused", server_default=None)


def downgrade() -> None:
    op.drop_column("service_protocol_signatures", "client_remark")
    op.drop_column("service_protocol_signatures", "refusal_reason")
    op.drop_column("service_protocol_signatures", "is_refused")
    op.alter_column("service_protocol_signatures", "signature_image_data", existing_type=sa.Text(), nullable=False)
