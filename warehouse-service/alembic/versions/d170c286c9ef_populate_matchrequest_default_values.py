"""populate matchrequest default values

Revision ID: 20250513165615
Revises: 20250513115528
Create Date: 2025-05-13 16:56:15

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20250513165615"
down_revision = "20250513115528"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update default values on match_requests names and addresses columns
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE match_requests
            SET names = '[]'::jsonb, addresses = '[]'::jsonb
            WHERE names IS NULL OR addresses IS NULL;
            """
        )
    )


def downgrade() -> None:
    # Downgrade is not needed as the default values are already set to empty lists
    pass
