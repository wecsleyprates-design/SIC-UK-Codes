import csv
import io
import logging
import uuid
import zipfile
from contextlib import contextmanager
from typing import Any, Iterator
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from sqlalchemy import MetaData, Table, text

from datapooler.adapters.db.models import NPIUpdateRunsDb
from datapooler.adapters.engines import Engines
from datapooler.adapters.redshift.tables import WarehouseTables
from datapooler.adapters.sessions import TransactionalSessions, WarehouseSessions

NPI_SCHEMA = "npi"
DEFAULT_LOOKBACK_DAYS = 7
WAREHOUSE_TABLES = (
    "endpoints",
    "othernames",
    "pl_pfile",
    "records",
)


FileMap = dict[str, list[dict[str, Any]]]


class NPIAutomationRepository(WarehouseTables):
    def __init__(self):
        self._transactional_sessions = TransactionalSessions
        self._warehouse_sessions = WarehouseSessions
        self._logger = logging.getLogger(__name__)
        self._primary_key = "npi"

    def get_last_update_run(self) -> NPIUpdateRunsDb | None:
        """
        Retrieve the last NPI update run from the database.
        """

        with self._transactional_sessions.get_session() as session:
            result = (
                session.query(NPIUpdateRunsDb).order_by(NPIUpdateRunsDb.created_at.desc()).first()
            )

        return result

    def add_run(self, update_run: NPIUpdateRunsDb) -> None:
        """
        Add a new NPI update run to the database.
        """

        with self._transactional_sessions.get_session() as session:
            session.add(update_run)
            session.commit()

    def load(self, tracker: NPIUpdateRunsDb, data: FileMap) -> None:
        """
        Load NPI data into the warehouse.
        """

        for table_name in WAREHOUSE_TABLES:
            with self._prepare_tables(table_name) as (table, temp_table):
                row_count = self._load_temp_table(temp_table, data[table_name])
                tracker.set_record_count(row_count, table_name)

                self._logger.info(
                    f"Loaded {row_count} rows into temporary table {temp_table.name}."
                )

                if row_count > 0:
                    self._merge(table, temp_table)
                else:
                    self._logger.warning(f"No data loaded into temporary table {temp_table.name}.")

        self.add_run(tracker)
        return tracker

    @contextmanager
    def _prepare_tables(self, table_name: str) -> Iterator[tuple[Table, Table]]:
        """
        Create a temporary table in the warehouse for processing NPI data.
        """

        try:
            table = WarehouseTables.get_table(NPI_SCHEMA, table_name)
            temp_table = table.to_metadata(
                MetaData(), name=f"{table_name}_temp_{uuid.uuid4().hex[:8]}"
            )
            temp_table.create(bind=Engines.warehouse)
            yield table, temp_table
        finally:
            temp_table.drop(bind=Engines.warehouse)

    def _load_temp_table(self, temp_table: Table, data: list[dict]) -> int:
        """
        Load data into the temporary table.
        """
        if not data:
            self._logger.warning("No data provided to load into the temporary table.")
            return

        with self._warehouse_sessions.get_session() as session:
            result = session.execute(temp_table.insert(), data)
            session.commit()

            return result.rowcount

    def _merge(self, table: Table, temp_table: Table) -> int:
        """
        Perform a Redshift MERGE between table and temp_table.
        Match on 'NPI'. Update all other columns. Insert if not matched.
        Handles special characters or spaces in column names.
        """

        merge_sql = self._generate_merge_clause(table, temp_table)

        with self._warehouse_sessions.get_session() as session:
            session.execute(text(merge_sql))
            session.commit()

            return

    def _generate_merge_clause(self, table: Table, temp_table: Table) -> str:
        """
        Generate the SQL clause for merging data from temp_table into table.
        """

        if self._primary_key not in (all_columns := [col.name for col in table.columns]):
            raise ValueError(f"Expected match key '{self._primary_key}' not found in table columns")

        update_columns = [col.name for col in table.columns if col.name != self._primary_key]
        set_clause = ", ".join(
            [f"target.{self.quote(col)} = source.{self.quote(col)}" for col in update_columns]
        )

        return f"""
            MERGE INTO {self.quote(table.name)} AS target
            USING {self.quote(temp_table.name)} AS source
            ON target.{self._primary_key} = source.{self._primary_key}
            WHEN MATCHED THEN
                UPDATE SET {set_clause}
            WHEN NOT MATCHED THEN
                INSERT ({', '.join(self.quote(col) for col in all_columns)})
                VALUES ({', '.join(['source.' + self.quote(col) for col in all_columns])});
        """


class NPIFileRepository:
    """
    Repository for downloading and Preparing NPI files. For Database Upload.
    """

    FILE_NAME_TO_TABLE_NAME = {
        "endpoint_": "endpoints",
        "othername_": "othernames",
        "pl_pfile_": "pl_pfile",
        "npidata_": "records",
    }

    def __init__(self):
        self._logger = logging.getLogger(__name__)
        self._base_url = "https://download.cms.gov/nppes/NPI_Files.html"
        self._file_identifier = "Weekly_V2.zip"

    def download(
        self, url: str, last_npi_run: NPIUpdateRunsDb | None = None
    ) -> tuple[NPIUpdateRunsDb, FileMap] | tuple[None, None]:
        if last_npi_run:
            if last_npi_run.url == url:
                self._logger.info("No new NPI file to download, using existing run.")
                return None, None

        self._logger.info(f"Downloading NPI file from {url}")

        new_npi_run = NPIUpdateRunsDb(url=url)
        response = requests.get(url)
        response.raise_for_status()

        return new_npi_run, self._generate_file_map(response.content)

    def get_download_link(self) -> str:
        """
        Get the download link for the NPI ZipFile.
        """

        resp = requests.get(self._base_url)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.lower().endswith(".zip"):
                full_url = urljoin(self._base_url, href)
                if self._file_identifier in full_url:
                    return full_url

        return None

    def _generate_file_map(self, zip_bytes: bytes) -> FileMap:
        """
        Extract CSV files from the downloaded ZIP bytes and return a mapping of
        file names to their content.
        """

        file_map: FileMap = {}
        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as z:
            csv_files = [f for f in z.namelist() if f.endswith(".csv") and "_fileheader" not in f]
            self._logger.info(f"Found data files: {csv_files}")

            for csv_file in csv_files:
                with z.open(csv_file) as file_obj:
                    reader = csv.DictReader(io.TextIOWrapper(file_obj, encoding="utf-8"))
                    table_name = self._get_table_name(csv_file)
                    file_map[table_name] = list(reader)

        return file_map

    def _get_table_name(self, file_name: str) -> str:
        """
        Get the table name corresponding to the file name.
        """

        for prefix, table_name in self.FILE_NAME_TO_TABLE_NAME.items():
            if file_name.startswith(prefix):
                return table_name

        raise ValueError(f"Unknown file name prefix: {file_name}")
