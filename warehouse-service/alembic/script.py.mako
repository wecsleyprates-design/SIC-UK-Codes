<%import datetime%>
<%timestamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')%>

"""${message}

Revision ID: ${timestamp}
Revises: ${down_revision | comma,n}
Create Date: ${datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision = '${timestamp}'
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
