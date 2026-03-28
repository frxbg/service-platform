"""add service protocol signatures

Revision ID: 20260328_protocol_signatures
Revises: 20260327_service_platform
Create Date: 2026-03-28
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260328_protocol_signatures"
down_revision = "20260327_service_platform"
branch_labels = None
depends_on = None


service_protocol_signature_role = postgresql.ENUM(
    "technician",
    "client",
    name="serviceprotocolsignaturerole",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    service_protocol_signature_role.create(bind, checkfirst=True)

    op.create_table(
        "service_protocol_signatures",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("signer_role", service_protocol_signature_role, nullable=False),
        sa.Column("signer_name", sa.String(), nullable=False),
        sa.Column("signed_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("signature_image_data", sa.Text(), nullable=False),
        sa.Column("signature_strokes_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("device_info", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("invalidated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invalidation_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_service_protocol_signatures_request_id", "service_protocol_signatures", ["request_id"])
    op.create_index("ix_service_protocol_signatures_signed_by_user_id", "service_protocol_signatures", ["signed_by_user_id"])


def downgrade() -> None:
    op.drop_index("ix_service_protocol_signatures_signed_by_user_id", table_name="service_protocol_signatures")
    op.drop_index("ix_service_protocol_signatures_request_id", table_name="service_protocol_signatures")
    op.drop_table("service_protocol_signatures")

    bind = op.get_bind()
    service_protocol_signature_role.drop(bind, checkfirst=True)
