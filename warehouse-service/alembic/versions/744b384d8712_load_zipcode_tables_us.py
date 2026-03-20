"""load zipcode tables - us

Revision ID: 20250603151430
Revises: 20250603145407
Create Date: 2025-06-03 15:14:30

"""

from alembic import op
from datapooler.adapters.db.models import USZipCodeDb
from datapooler.services.zipcodes import ZipCodeService

# revision identifiers, used by Alembic.
revision = "20250603151430"
down_revision = "20250603145407"
branch_labels = None
depends_on = None


def upgrade() -> None:
    zipcode_service = ZipCodeService()
    zipcode_service.load("artifacts/migrations/USZIPCodes202506.csv.gz", USZipCodeDb)


def downgrade() -> None:
    op.execute("TRUNCATE TABLE us_zip_codes RESTART IDENTITY;")
