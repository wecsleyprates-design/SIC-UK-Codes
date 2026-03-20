import logging

from datapooler.adapters import queues
from datapooler.services.export import ExportService


@queues.TaskQueue.task(serializer="gzip-orjson", acks_late=True, reject_on_worker_lost=True)
def perform_export_customer_file_task(
    customer_id: str,
    request_id: int,
) -> tuple[str, bool, int]:
    logging.debug(
        f"Starting customer file export task for Customer ID: {customer_id}, Request ID: {request_id}"  # noqa
    )

    export_service = ExportService()
    export_response = export_service.run_export(customer_id, request_id)

    return (
        export_response.s3_uri_path or "",
        export_response.status == "completed",
        export_response.record_count or 0,
    )
