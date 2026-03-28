"""add session timeout to company settings

Revision ID: 20260327_session_timeout
Revises: 20260302_offer_contacts
Create Date: 2026-03-27
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260327_session_timeout"
down_revision = "20260302_offer_contacts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "company_settings",
        sa.Column("session_timeout_minutes", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("company_settings", "session_timeout_minutes")
