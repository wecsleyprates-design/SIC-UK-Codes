from sqlalchemy import BigInteger, Column, String

from datapooler.adapters.db.models import base, mixins


class NPIUpdateRunsDb(base.Base, mixins.TimestampMixin):
    __tablename__ = "npi_update_runs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    url = Column(String, nullable=False)
    pl_records = Column(BigInteger, nullable=True)
    endpoint_records = Column(BigInteger, nullable=True)
    othername_records = Column(BigInteger, nullable=True)
    npi_records = Column(BigInteger, nullable=True)

    def set_record_count(self, count: int, table_name: str) -> None:
        """
        Set the record count for a specific table in this update run.
        """
        if table_name == "pl_pfile":
            self.pl_records = count
        elif table_name == "endpoints":
            self.endpoint_records = count
        elif table_name == "othernames":
            self.othername_records = count
        elif table_name == "records":
            self.npi_records = count
        else:
            raise ValueError(f"Unknown table name: {table_name}")
