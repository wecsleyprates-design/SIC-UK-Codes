from sqlalchemy import MetaData, Table
from sqlalchemy.sql import compiler

from datapooler.adapters import Engines

metadata = MetaData(bind=Engines.warehouse)


class WarehouseTables:

    @classmethod
    def get_table(cls, schema: str, table_name: str) -> Table:
        return Table(
            table_name, metadata, autoload=True, autoload_with=Engines.warehouse, schema=schema
        )

    @classmethod
    def quote(cls, value: str) -> str:
        """
        Returns a quoted version of the table name, handling special characters or spaces.
        """

        dialect = Engines.warehouse.dialect
        preparer = compiler.IdentifierPreparer(dialect)
        return preparer.quote(value, force=True)
