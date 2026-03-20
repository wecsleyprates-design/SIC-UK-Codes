import datetime

from sqlalchemy import BigInteger, Column, DateTime, String

from datapooler.adapters.db.models import base, mixins


class ExportRequestDb(mixins.TimestampMixin, base.Base):
    __tablename__ = "export_requests"

    id = Column(BigInteger, autoincrement=True, primary_key=True)
    customer_id = Column(String, index=True, nullable=False)
    export_type = Column(String, index=True, nullable=False)
    status = Column(String, index=True, nullable=False, default="pending")
    bucket = Column(String, nullable=True)
    s3_uri_path = Column(String, nullable=True)
    record_count = Column(BigInteger, nullable=True)
    started_at = Column(DateTime(timezone=True), index=True, nullable=True)
    completed_at = Column(DateTime(timezone=True), index=True, nullable=True)

    def s3_key(self) -> str:
        return f"customer_exports/{self.customer_id}/{self.id}"

    def fill_procedure_results(
        self,
        o_s3_path: str,
        o_record_count: int,
        o_started_at: datetime.datetime,
        o_ended_at: datetime.datetime,
    ) -> None:
        self.s3_uri_path = o_s3_path + "000.gz"
        self.record_count = o_record_count
        self.started_at = o_started_at
        self.completed_at = o_ended_at
