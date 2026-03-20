"""auto timestamps

Revision ID: 20250205131808
Revises: 20250205114901
Create Date: 2025-02-05 13:18:08

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20250205131808"
down_revision = "20250205114901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("match_results", sa.Column("updated_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("match_results", "updated_at")
