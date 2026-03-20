"""simplify matchresult table

Revision ID: 20250211104352
Revises: 20250205131808
Create Date: 2025-02-11 10:43:52

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20250211104352"
down_revision = "20250205131808"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(op.f("ix_match_results_match_id"), "match_results", ["match_id"], unique=False)
    op.drop_column("match_results", "company_number")
    op.drop_column("match_results", "company_id")
    op.drop_column("match_results", "location_id")
    op.drop_column("match_results", "efx_id")
    op.drop_column("match_results", "es_location_id")


def downgrade() -> None:
    op.add_column(
        "match_results",
        sa.Column("es_location_id", sa.VARCHAR(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "match_results", sa.Column("efx_id", sa.VARCHAR(), autoincrement=False, nullable=True)
    )
    op.add_column(
        "match_results", sa.Column("location_id", sa.VARCHAR(), autoincrement=False, nullable=True)
    )
    op.add_column(
        "match_results", sa.Column("company_id", sa.VARCHAR(), autoincrement=False, nullable=True)
    )
    op.add_column(
        "match_results",
        sa.Column("company_number", sa.VARCHAR(), autoincrement=False, nullable=True),
    )
    op.drop_index(op.f("ix_match_results_match_id"), table_name="match_results")
