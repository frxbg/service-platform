"""add client codes and sites

Revision ID: d4d5c9a3e5f7
Revises: 86165b8b5b41
Create Date: 2025-12-07 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4d5c9a3e5f7'
down_revision = '86165b8b5b41'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('clients', sa.Column('client_number', sa.String(), nullable=True))
    op.add_column('clients', sa.Column('project_number', sa.String(), nullable=True))
    op.create_index('ix_clients_client_number', 'clients', ['client_number'], unique=True)

    op.create_table(
        'client_sites',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('site_code', sa.String(), nullable=False),
        sa.Column('site_name', sa.String(), nullable=True),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('address', sa.String(), nullable=True),
        sa.Column('project_number', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('client_id', 'site_code', name='uq_client_site_code_per_client'),
    )
    op.create_index('ix_client_sites_client_id', 'client_sites', ['client_id'], unique=False)
    op.create_index('ix_client_sites_site_code', 'client_sites', ['site_code'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_client_sites_site_code', table_name='client_sites')
    op.drop_index('ix_client_sites_client_id', table_name='client_sites')
    op.drop_table('client_sites')

    op.drop_index('ix_clients_client_number', table_name='clients')
    op.drop_column('clients', 'project_number')
    op.drop_column('clients', 'client_number')
