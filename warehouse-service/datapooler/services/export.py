"""
Customer Data Export Service.

Manages asynchronous export of customer data to S3 for analytics and reporting.

Workflow:
1. Customer requests export via API
2. Export request created in database (PENDING status)
3. Background job processes export:
   - Executes database procedure to extract data
   - Writes to S3 in customer's designated path
   - Updates request with record count and S3 URI
4. Publishes completion event to Kafka

Status lifecycle: PENDING -> IN_PROGRESS -> COMPLETED/FAILED

Exports are customer-scoped and tracked for audit purposes.
"""

import datetime

from pydantic import BaseModel, Field

from datapooler.adapters.db.repositories.customer_export_repository import (
    CustomerExportRepository,
    ExportJobStatuses,
    ExportJobTypes,
)
from datapooler.adapters.messages import KafkaMessageSender

EXPORT_KAFKA_TOPIC = "customer_exports"


class ExportResponseModel(BaseModel):
    model_config = {"from_attributes": True, "populate_by_name": True}

    id: int = Field(serialization_alias="export_id")
    customer_id: str
    export_type: ExportJobTypes
    status: ExportJobStatuses
    s3_uri_path: str | None = None
    record_count: int | None = None
    started_at: datetime.datetime | None = None
    completed_at: datetime.datetime | None = None
    created_at: datetime.datetime | None = None
    updated_at: datetime.datetime | None = None

    @property
    def export_id(self) -> int:
        """Alias for id field to maintain backward compatibility."""
        return self.id


class ExportServiceError(Exception):
    """Raised when export operations fail."""

    pass


class ExportService:
    """
    Service for managing customer data exports.

    Coordinates export request lifecycle:
    - Request creation and tracking
    - Export execution (database procedure + S3 upload)
    - Status management
    - Event publishing to Kafka
    """

    def __init__(self) -> None:
        self.export_repository = CustomerExportRepository()
        self.message_sender = KafkaMessageSender(topic=EXPORT_KAFKA_TOPIC)

    async def create_request(self, customer_id: str) -> ExportResponseModel:
        request = await self.export_repository.create_request(customer_id)
        return ExportResponseModel.model_validate(request)

    def run_export(self, customer_id: str, request_id: int) -> ExportResponseModel:
        export_request = self.export_repository.get(request_id, customer_id)
        if export_request is None:
            raise ExportServiceError(
                f"Export request not found for CustomerId: {customer_id}, RequestId: {request_id}"
            )
        self.export_repository.update(export_request, ExportJobStatuses.IN_PROGRESS)

        try:
            # Run the export procedure, if this succeeds,
            # update the export request status to COMPLETED.
            # This will also set the number of records exported and the full S3 path.
            completed_request = self.export_repository.export(export_request)
            self.export_repository.update(
                completed_request,
                ExportJobStatuses.COMPLETED,
            )
        except Exception as e:
            # If export fails, update the status to FAILED
            failed_request = self.export_repository.update(export_request, ExportJobStatuses.FAILED)

            # Publish a failed export model to kafka, this will contain none of
            # the additional meta data because the procedure didn't complete.
            self._publish(ExportResponseModel.model_validate(failed_request))

            raise ExportServiceError(
                f"Export failed for request CustomerId: {export_request.customer_id}, "
                f"RequestId: {export_request.id}: {e}"
            ) from e

        # If we get a completed export, send a message to Kafka with location of
        # the exported file as well as other metadata.
        response_model = ExportResponseModel.model_validate(completed_request)
        if response_model.status == ExportJobStatuses.COMPLETED:
            self._publish(response_model)

        return response_model

    def _publish(self, response_model: ExportResponseModel) -> None:
        with self.message_sender.connect() as sender:
            sender.send_message(key=response_model.customer_id, value=response_model)
