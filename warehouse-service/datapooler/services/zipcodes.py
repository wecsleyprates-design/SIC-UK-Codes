import csv

import smart_open

from datapooler.adapters.db.models import CAZipCodeDb, USZipCodeDb
from datapooler.adapters.db.repositories import zipcode_repository
from datapooler.models import zipcodes


class ZipCodeService:
    def __init__(self):
        self.zipcode_repository = zipcode_repository.ZipCodeRepository()

    async def fetch(
        self, zipcode: str, country: str
    ) -> zipcodes.USZipCode | zipcodes.CAZipCode | None:
        """
        Retrieve a ZipCode by its code and country.
        """
        return await self.zipcode_repository.get(zipcode, country)

    def load(
        self, zipcode_file: str, _db_model: USZipCodeDb | CAZipCodeDb, _early_stop: bool = False
    ) -> None:
        """
        Load a list of ZipCodes from a file into the database.
        """

        with smart_open.open(zipcode_file, mode="rt", encoding="utf-8-sig") as file:
            reader = csv.DictReader(
                file,
                quoting=csv.QUOTE_ALL if isinstance(_db_model, USZipCodeDb) else csv.QUOTE_MINIMAL,
            )
            zipcodes_list = []

            for i, row in enumerate(reader):
                if _db_model is USZipCodeDb and (
                    any(not value for value in row.values()) or len(row) < 10
                ):
                    # Skip rows with empty values in US zip code data
                    continue

                try:
                    zip_code_instance = _db_model.from_flat_file(row)
                    zipcodes_list.append(zip_code_instance)
                except Exception:
                    continue  # Skip rows that cannot be parsed

            self.zipcode_repository.load(zipcodes_list, _early_stop=_early_stop)
