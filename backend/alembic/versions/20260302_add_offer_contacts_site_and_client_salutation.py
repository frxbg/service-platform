"""add offer contacts, offer site, and client salutation

Revision ID: 20260302_offer_contacts
Revises: 0714142f8030
Create Date: 2026-03-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260302_offer_contacts"
down_revision = "0714142f8030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("salutation_name", sa.String(), nullable=True))

    op.add_column("offers", sa.Column("site_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_offers_site_id", "offers", ["site_id"], unique=False)
    op.create_foreign_key(
        "fk_offers_site_id_client_sites",
        "offers",
        "client_sites",
        ["site_id"],
        ["id"],
    )

    op.create_table(
        "offer_contacts",
        sa.Column("offer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["offer_id"], ["offers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contact_id"], ["client_contacts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("offer_id", "contact_id"),
    )
    op.create_index("ix_offer_contacts_contact_id", "offer_contacts", ["contact_id"], unique=False)

    # Backfill association table from legacy single-contact field.
    op.execute(
        """
        INSERT INTO offer_contacts (offer_id, contact_id)
        SELECT id, contact_person_id
        FROM offers
        WHERE contact_person_id IS NOT NULL
        ON CONFLICT DO NOTHING
        """
    )

    # Best-effort backfill of site_id by matching current project/site text.
    op.execute(
        """
        UPDATE offers AS o
        SET site_id = s.id
        FROM client_sites AS s
        WHERE o.site_id IS NULL
          AND s.client_id = o.client_id
          AND (
            (o.project_name IS NOT NULL AND (s.site_code = o.project_name OR s.site_name = o.project_name OR s.project_number = o.project_name))
            OR
            (o.site_address IS NOT NULL AND s.address = o.site_address)
          )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_offer_contacts_contact_id", table_name="offer_contacts")
    op.drop_table("offer_contacts")

    op.drop_constraint("fk_offers_site_id_client_sites", "offers", type_="foreignkey")
    op.drop_index("ix_offers_site_id", table_name="offers")
    op.drop_column("offers", "site_id")

    op.drop_column("clients", "salutation_name")
