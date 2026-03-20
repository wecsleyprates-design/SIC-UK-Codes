import logging

from more_itertools import chunked
from sqlalchemy import select

from datapooler.adapters import sessions
from datapooler.adapters.db.models import zipcodes as db_models
from datapooler.models import zipcodes

ZIPCODE_MODEL_MAPPING = {
    "US": (db_models.USZipCodeDb, zipcodes.USZipCode),
    "CA": (db_models.CAZipCodeDb, zipcodes.CAZipCode),
}


class ZipCodeRepository:
    def __init__(self):
        self._async_sessionmaker = sessions.AsyncTransactionalSessions
        self._sync_sessionmaker = sessions.TransactionalSessions
        self._logger = logging.getLogger(__name__)

    async def get(
        self, zipcode: str, country: str
    ) -> zipcodes.USZipCode | zipcodes.CAZipCode | None:
        """
        Retrieve a ZipCode by its code and country.
        """
        try:
            model_db, model_cls = self._model_selector(country)
        except ValueError as e:
            self._logger.error(f"Error selecting model for country {country}: {e}")

            return None

        async with self._async_sessionmaker.get_session() as session:
            stmt = select(model_db)

            if country == "US":
                stmt = stmt.where(model_db.zip_code == zipcode)
            elif country == "CA":
                stmt = stmt.where(model_db.postal_code == zipcode)
            else:
                return None

            result = await session.scalars(stmt)
            record = result.first()

        if record:
            return model_cls.model_validate(record, from_attributes=True)

        return record

    def load(
        self,
        zipcodes: list[db_models.USZipCodeDb] | list[db_models.CAZipCodeDb],
        _early_stop: bool = False,
    ) -> None:
        """
        Load a list of ZipCodes into the database.
        """
        if not zipcodes:
            return

        for chunk in chunked(zipcodes, 1000):
            with self._sync_sessionmaker.get_session() as session:
                self._logger.info(f"Loading {len(chunk)} zipcodes into the database.")
                session.bulk_save_objects(chunk)

            if _early_stop:
                self._logger.info("Early stop requested, breaking out of the loop.")
                break

    def _model_selector(
        self, country: str
    ) -> (
        tuple[db_models.USZipCodeDb, zipcodes.USZipCode]
        | tuple[db_models.CAZipCodeDb, zipcodes.CAZipCode]
    ):
        """
        Select the appropriate model class based on the country.
        """
        if country not in ZIPCODE_MODEL_MAPPING:
            raise ValueError(f"Unsupported country for fetching zipcodes: {country}")

        return ZIPCODE_MODEL_MAPPING[country]
