"""add published status to offerstatus enum

Revision ID: add_published_status
Revises: 6440bebb90be
Create Date: 2025-12-06
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "add_published_status"
down_revision = "6440bebb90be"
branch_labels = None
depends_on = None


def upgrade():
    # Postgres enum update: add new value if it doesn't exist
    op.execute("ALTER TYPE offerstatus ADD VALUE IF NOT EXISTS 'published';")


def downgrade():
    # Dropping enum values in Postgres is non-trivial; leaving as no-op.
    pass
