"""add client contacts and offer contact person

Revision ID: add_client_contacts
Revises: 2beaec4d67d7
Create Date: 2025-12-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "add_client_contacts"
down_revision = "2beaec4d67d7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "client_contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id"), nullable=False, index=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()")),
    )

    op.add_column(
        "offers",
        sa.Column("contact_person_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("client_contacts.id"), nullable=True),
    )
    op.add_column(
        "offers",
        sa.Column("contact_person_name", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_column("offers", "contact_person_name")
    op.drop_column("offers", "contact_person_id")
    op.drop_table("client_contacts")
