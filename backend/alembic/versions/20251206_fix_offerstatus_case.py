"""fix offerstatus enum to use consistent uppercase values

Revision ID: fix_offerstatus_case
Revises: add_published_status
Create Date: 2025-12-06
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "fix_offerstatus_case"
down_revision = "add_published_status"
branch_labels = None
depends_on = None


def upgrade():
    # Drop and recreate the enum type with all UPPERCASE values
    # First, we need to update existing data to use a temporary type
    op.execute("ALTER TABLE offers ALTER COLUMN status TYPE varchar(50)")
    op.execute("DROP TYPE offerstatus")
    op.execute("CREATE TYPE offerstatus AS ENUM ('DRAFT', 'PUBLISHED', 'SENT', 'ACCEPTED', 'REJECTED', 'ARCHIVED')")
    
    # Update any lowercase values to uppercase
    op.execute("UPDATE offers SET status = UPPER(status)")
    
    # Convert column back to enum type
    op.execute("ALTER TABLE offers ALTER COLUMN status TYPE offerstatus USING status::offerstatus")


def downgrade():
    # Revert to mixed case (not recommended, but for completeness)
    op.execute("ALTER TABLE offers ALTER COLUMN status TYPE varchar(50)")
    op.execute("DROP TYPE offerstatus")
    op.execute("CREATE TYPE offerstatus AS ENUM ('DRAFT', 'published', 'SENT', 'ACCEPTED', 'REJECTED', 'ARCHIVED')")
    op.execute("ALTER TABLE offers ALTER COLUMN status TYPE offerstatus USING status::offerstatus")
