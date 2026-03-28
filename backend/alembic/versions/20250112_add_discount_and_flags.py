"""Add discount percent to offer lines and show_discount_column flag to offers

Revision ID: add_discount_and_flags
Revises: 7b7c21712bd3
Create Date: 2025-01-12
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_discount_and_flags'
down_revision = '7b7c21712bd3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'offer_lines',
        sa.Column('discount_percent', sa.Numeric(5, 2), nullable=False, server_default='0')
    )
    op.add_column(
        'offers',
        sa.Column('show_discount_column', sa.Boolean(), nullable=False, server_default=sa.false())
    )


def downgrade():
    op.drop_column('offer_lines', 'discount_percent')
    op.drop_column('offers', 'show_discount_column')
