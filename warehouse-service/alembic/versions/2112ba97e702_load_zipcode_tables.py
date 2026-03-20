"""load zipcode tables

Revision ID: 20250603145407
Revises: 20250603141043
Create Date: 2025-06-03 14:54:07

"""

from alembic import op
from datapooler.adapters.db.models import CAZipCodeDb
from datapooler.services.zipcodes import ZipCodeService

# revision identifiers, used by Alembic.
revision = "20250603145407"
down_revision = "20250603141043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    zipcode_service = ZipCodeService()
    zipcode_service.load("artifacts/migrations/CanadianPostalCodes202403.csv.gz", CAZipCodeDb)


def downgrade() -> None:
    op.execute("TRUNCATE TABLE ca_zip_codes RESTART IDENTITY;")
