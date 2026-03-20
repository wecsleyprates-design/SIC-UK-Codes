"""match result table

Revision ID: 20250205114901
Revises:
Create Date: 2025-02-05 11:49:01

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20250205114901"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "match_results",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("match_id", sa.String(), nullable=True),
        sa.Column("business_id", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("efx_id", sa.String(), nullable=True),
        sa.Column("company_number", sa.String(), nullable=True),
        sa.Column("company_id", sa.String(), nullable=True),
        sa.Column("location_id", sa.String(), nullable=True),
        sa.Column("es_location_id", sa.String(), nullable=True),
        sa.Column("match", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("prediction", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("match_results")
