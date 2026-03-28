"""merge billing projects and service protocol signature heads

Revision ID: 20260328_merge_heads
Revises: 20260327_client_billing_projects, 20260328_protocol_signatures
Create Date: 2026-03-28
"""


revision = "20260328_merge_heads"
down_revision = ("20260327_client_billing_projects", "20260328_protocol_signatures")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
