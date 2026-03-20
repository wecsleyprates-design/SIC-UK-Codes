"""npi incremental runs

Revision ID: 20250714163152
Revises: 20250603151430
Create Date: 2025-07-14 16:31:52

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20250714163152"
down_revision = "20250603151430"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "npi_update_runs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("pl_records", sa.BigInteger(), nullable=True),
        sa.Column("endpoint_records", sa.BigInteger(), nullable=True),
        sa.Column("othername_records", sa.BigInteger(), nullable=True),
        sa.Column("npi_records", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("npi_update_runs")
