import pytest

from datapooler.adapters.db.models import zipcodes
from datapooler.models.zipcodes import CAZipCode, USZipCode
from datapooler.services.zipcodes import ZipCodeService


@pytest.fixture
def seed_zipcodes():
    """
    Seed the database with test zip codes.
    """
    zcs = ZipCodeService()
    zcs.load(
        "artifacts/migrations/USZIPCodes202506.csv.gz",
        zipcodes.USZipCodeDb,
        _early_stop=True,
    )

    zcs.load(
        "artifacts/migrations/CanadianPostalCodes202403.csv.gz",
        zipcodes.CAZipCodeDb,
        _early_stop=True,
    )

    yield


@pytest.mark.asyncio
async def test_fetch_zipcode(seed_zipcodes):
    """
    Test fetching zip codes from the database.
    """
    service = ZipCodeService()

    # Test Valid US Zip Code
    result = await service.fetch("00501", "US")
    assert isinstance(result, USZipCode)

    # Test Valid CA Zip Code
    result = await service.fetch("J9P 7B7", "CA")
    assert isinstance(result, CAZipCode)

    # Test Non-existent US Zip Code
    result = await service.fetch("99999", "US")
    assert result is None

    # Test Non-existent CA Zip Code
    result = await service.fetch("XXX XXX", "CA")
    assert result is None

    # Test Invalid Country Code
    result = await service.fetch("12345", "XX")
    assert result is None
