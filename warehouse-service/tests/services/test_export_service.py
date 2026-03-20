from unittest.mock import Mock, patch

import pytest

from datapooler.adapters.db.models import exports
from datapooler.adapters.db.repositories.customer_export_repository import (
    ExportJobStatuses,
    ExportJobTypes,
)
from datapooler.services.export import (
    ExportResponseModel,
    ExportService,
    ExportServiceError,
)


@pytest.fixture
def mock_redshift_export():
    """Mock the Redshift stored procedure call."""
    with patch(
        "datapooler.adapters.db.repositories.customer_export_repository.CustomerExportRepository.export"  # noqa: E501
    ) as mock_export:
        yield mock_export


@pytest.fixture
def mock_kafka():
    """Mock Kafka message sender."""
    with patch("datapooler.services.export.KafkaMessageSender") as mock_sender_class:
        mock_sender_instance = Mock()
        mock_connect_context = Mock()
        mock_connect_context.__enter__ = Mock(return_value=mock_sender_instance)
        mock_connect_context.__exit__ = Mock(return_value=None)
        mock_sender = Mock()
        mock_sender.connect = Mock(return_value=mock_connect_context)
        mock_sender_class.return_value = mock_sender
        yield mock_sender_instance


@pytest.fixture
async def export_request():
    """Create a real export request in the database."""
    service = ExportService()
    request = await service.create_request("test_customer_123")
    return request


@pytest.mark.asyncio
async def test_create_request():
    """Test creating an export request."""
    service = ExportService()
    result = await service.create_request("test_customer_123")

    assert isinstance(result, ExportResponseModel)
    assert result.customer_id == "test_customer_123"
    assert result.status == ExportJobStatuses.PENDING
    assert result.export_type == ExportJobTypes.CUSTOMER_FILE
    assert result.export_id >= 1


@pytest.mark.asyncio
async def test_run_export_success(mock_redshift_export, mock_kafka):
    """Test successful export execution."""
    # Create a request
    service = ExportService()
    request = await service.create_request("test_customer_123")

    # Setup mock to return completed request
    completed_request = exports.ExportRequestDb(
        id=request.export_id,
        customer_id="test_customer_123",
        export_type=ExportJobTypes.CUSTOMER_FILE,
        status=ExportJobStatuses.COMPLETED,
        bucket="test-bucket",
        s3_uri_path=f"s3://test-bucket/customer_exports/test_customer_123/{request.export_id}/export_000.gz",  # noqa: E501
        record_count=100,
    )
    mock_redshift_export.return_value = completed_request

    # Run the export
    result = service.run_export("test_customer_123", request.export_id)

    # Verify result
    assert result.status == ExportJobStatuses.COMPLETED
    assert result.record_count == 100

    # Verify Kafka message was sent
    mock_kafka.send_message.assert_called_once()
    call_args = mock_kafka.send_message.call_args
    assert call_args[1]["key"] == "test_customer_123"
    assert call_args[1]["value"].status == ExportJobStatuses.COMPLETED


@pytest.mark.asyncio
async def test_run_export_failure(mock_redshift_export, mock_kafka):
    """Test export execution with failure."""
    # Create a request
    service = ExportService()
    request = await service.create_request("test_customer_123")

    # Setup mock to raise exception
    mock_redshift_export.side_effect = Exception("Procedure failed")

    # Run the export and expect error
    with pytest.raises(ExportServiceError) as exc_info:
        service.run_export("test_customer_123", request.export_id)

    assert "Export failed for request CustomerId: test_customer_123" in str(exc_info.value)
    assert "Procedure failed" in str(exc_info.value)

    # Verify failed message was published to Kafka
    mock_kafka.send_message.assert_called_once()
    call_args = mock_kafka.send_message.call_args
    assert call_args[1]["value"].status == ExportJobStatuses.FAILED


@pytest.mark.asyncio
async def test_run_export_no_kafka_on_in_progress(mock_redshift_export, mock_kafka):
    """Test that Kafka message is not sent when status is still IN_PROGRESS."""
    # Create a request
    service = ExportService()
    request = await service.create_request("test_customer_123")

    # Setup mock to return in-progress request
    in_progress_request = exports.ExportRequestDb(
        id=request.export_id,
        customer_id="test_customer_123",
        export_type=ExportJobTypes.CUSTOMER_FILE,
        status=ExportJobStatuses.IN_PROGRESS,
        bucket="test-bucket",
    )
    mock_redshift_export.return_value = in_progress_request

    # Mock the update to also return in-progress
    with patch(
        "datapooler.adapters.db.repositories.customer_export_repository.CustomerExportRepository.update"  # noqa: E501
    ) as mock_update:
        mock_update.return_value = in_progress_request

        # Run the export
        result = service.run_export("test_customer_123", request.export_id)

    # Verify no Kafka message was sent
    mock_kafka.send_message.assert_not_called()
    assert result.status == ExportJobStatuses.IN_PROGRESS


def test_publish_method(mock_kafka):
    """Test the _publish method directly."""
    service = ExportService()

    response_model = ExportResponseModel(
        id=1,
        customer_id="test_customer_123",
        export_type=ExportJobTypes.CUSTOMER_FILE,
        status=ExportJobStatuses.COMPLETED,
        s3_uri_path="s3://bucket/path",
        record_count=100,
    )

    service._publish(response_model)

    # Verify message was sent with correct parameters
    mock_kafka.send_message.assert_called_once()
    call_args = mock_kafka.send_message.call_args
    assert call_args[1]["key"] == "test_customer_123"
    assert call_args[1]["value"] == response_model


def test_export_response_model_validation():
    """Test that ExportResponseModel correctly validates ExportRequestDb."""
    import datetime

    db_request = exports.ExportRequestDb(
        id=1,
        customer_id="test_customer_123",
        export_type=ExportJobTypes.CUSTOMER_FILE,
        status=ExportJobStatuses.COMPLETED,
        bucket="test-bucket",
        s3_uri_path="s3://test-bucket/customer_exports/test_customer_123/1/export_000.gz",
        record_count=100,
        started_at=datetime.datetime(2026, 1, 27, 12, 0, 0),
        completed_at=datetime.datetime(2026, 1, 27, 12, 5, 0),
    )

    response_model = ExportResponseModel.model_validate(db_request)

    assert response_model.export_id == 1
    assert response_model.customer_id == "test_customer_123"
    assert response_model.export_type == ExportJobTypes.CUSTOMER_FILE
    assert response_model.status == ExportJobStatuses.COMPLETED
    assert (
        response_model.s3_uri_path
        == "s3://test-bucket/customer_exports/test_customer_123/1/export_000.gz"
    )
    assert response_model.record_count == 100
