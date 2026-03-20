from enum import StrEnum

from sqlalchemy import text

from datapooler import config
from datapooler.adapters import sessions
from datapooler.adapters.db.models import exports


class ExportJobTypes(StrEnum):
    CUSTOMER_FILE = "customer_file"


class ExportJobStatuses(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


CUSTOMER_EXPORT_PROCEDURE_NAME = "sp_export_customer_file_to_s3"


class CustomerExportRepository:
    def __init__(self) -> None:
        self.bucket = config.de_bucket
        self.async_transactional_sessions = sessions.AsyncTransactionalSessions
        self.transactional_sessions = sessions.TransactionalSessions
        self.warehouse_sessions = sessions.WarehouseSessions

    async def create_request(self, customer_id: str) -> exports.ExportRequestDb:
        async with self.async_transactional_sessions.get_session() as session:
            export_request = exports.ExportRequestDb(
                customer_id=customer_id,
                export_type=ExportJobTypes.CUSTOMER_FILE,
                status=ExportJobStatuses.PENDING,
                bucket=self.bucket,
            )
            session.add(export_request)

        return export_request

    def get(self, id: int, customer_id: str) -> exports.ExportRequestDb | None:
        with self.transactional_sessions.get_session() as session:
            export_request = (
                session.query(exports.ExportRequestDb)
                .filter_by(id=id, customer_id=customer_id)
                .one_or_none()
            )

        return export_request

    async def get_async(self, id: int, customer_id: str) -> exports.ExportRequestDb | None:
        from sqlalchemy import select

        async with self.async_transactional_sessions.get_session() as session:
            stmt = select(exports.ExportRequestDb).where(
                exports.ExportRequestDb.id == id, exports.ExportRequestDb.customer_id == customer_id
            )
            result = await session.execute(stmt)
            export_request = result.scalar_one_or_none()

        return export_request

    def update(
        self, export_request: exports.ExportRequestDb, status: ExportJobStatuses
    ) -> exports.ExportRequestDb:
        with self.transactional_sessions.get_session() as session:
            export_request.status = status
            session.merge(export_request)

        return export_request

    def export(
        self,
        export_request: exports.ExportRequestDb,
    ) -> exports.ExportRequestDb:
        with self.warehouse_sessions.get_session() as session:
            res = (
                session.execute(
                    text(f"CALL {CUSTOMER_EXPORT_PROCEDURE_NAME}(:customer_id, :s3_key)"),
                    {"customer_id": export_request.customer_id, "s3_key": export_request.s3_key()},
                )
                .mappings()
                .first()
            )

            export_request.fill_procedure_results(
                o_s3_path=res["o_s3_path"],
                o_record_count=res["o_record_count"],
                o_started_at=res["o_started_at"],
                o_ended_at=res["o_ended_at"],
            )

        return export_request
