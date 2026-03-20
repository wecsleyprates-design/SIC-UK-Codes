"""extras column in match_request

Revision ID: 20251002124428
Revises: 20250714163152
Create Date: 2025-10-02 12:44:28

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20251002124428"
down_revision = "20250714163152"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "match_requests", sa.Column("extra", postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("match_requests", "extra")
