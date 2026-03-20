from unittest.mock import Mock, patch

import pytest

from datapooler.adapters.db.repositories.customer_export_repository import (
    ExportJobStatuses,
)
from datapooler.services.export import ExportResponseModel, ExportServiceError
from datapooler.tasks.perform_customer_file_export import (
    perform_export_customer_file_task,
)


@pytest.fixture
def mock_export_service():
    """Create a mock ExportService."""
    with patch("datapooler.tasks.perform_customer_file_export.ExportService") as mock_service_class:
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        yield mock_service


def test_perform_export_customer_file_task_success(mock_export_service):
    """Test successful execution of customer file export task."""
    customer_id = "test_customer_123"
    request_id = 1

    # Create mock response
    mock_response = ExportResponseModel(
        id=request_id,
        customer_id=customer_id,
        export_type="customer_file",
        status=ExportJobStatuses.COMPLETED,
        s3_uri_path="s3://test-bucket/customer_exports/test_customer_123/1/export_000.gz",
        record_count=150,
    )

    mock_export_service.run_export.return_value = mock_response

    # Execute the task
    result = perform_export_customer_file_task.run(customer_id, request_id)

    # Verify service was called correctly
    mock_export_service.run_export.assert_called_once_with(customer_id, request_id)

    # Verify result format
    assert isinstance(result, tuple)
    assert len(result) == 3
    s3_path, success, record_count = result

    assert s3_path == "s3://test-bucket/customer_exports/test_customer_123/1/export_000.gz"
    assert success is True
    assert record_count == 150


def test_perform_export_customer_file_task_failed_status(mock_export_service):
    """Test task execution when export completes but status is not completed."""
    customer_id = "test_customer_456"
    request_id = 2

    # Create mock response with FAILED status
    mock_response = ExportResponseModel(
        id=request_id,
        customer_id=customer_id,
        export_type="customer_file",
        status=ExportJobStatuses.FAILED,
        s3_uri_path=None,
        record_count=None,
    )

    mock_export_service.run_export.return_value = mock_response

    # Execute the task
    result = perform_export_customer_file_task.run(customer_id, request_id)

    # Verify result
    s3_path, success, record_count = result

    assert s3_path == ""  # Empty string since s3_uri_path is None
    assert success is False  # Status is not "completed"
    assert record_count == 0  # 0 since record_count is None


def test_perform_export_customer_file_task_in_progress_status(mock_export_service):
    """Test task execution when export is still in progress."""
    customer_id = "test_customer_789"
    request_id = 3

    # Create mock response with IN_PROGRESS status
    mock_response = ExportResponseModel(
        id=request_id,
        customer_id=customer_id,
        export_type="customer_file",
        status=ExportJobStatuses.IN_PROGRESS,
        s3_uri_path=None,
        record_count=None,
    )

    mock_export_service.run_export.return_value = mock_response

    # Execute the task
    result = perform_export_customer_file_task.run(customer_id, request_id)

    # Verify result
    s3_path, success, record_count = result

    assert s3_path == ""
    assert success is False
    assert record_count == 0


def test_perform_export_customer_file_task_service_error(mock_export_service):
    """Test task execution when ExportService raises an error."""
    customer_id = "test_customer_error"
    request_id = 4

    # Mock service to raise an error
    mock_export_service.run_export.side_effect = ExportServiceError(
        "Export failed for request CustomerId: test_customer_error, RequestId: 4: Database error"
    )

    # Verify that the error propagates
    with pytest.raises(ExportServiceError) as exc_info:
        perform_export_customer_file_task.run(customer_id, request_id)

    assert "Export failed for request CustomerId: test_customer_error" in str(exc_info.value)
    assert "Database error" in str(exc_info.value)


def test_perform_export_customer_file_task_with_partial_data(mock_export_service):
    """Test task with export that has s3_uri_path but no record count."""
    customer_id = "test_customer_partial"
    request_id = 5

    # Create mock response with partial data
    mock_response = ExportResponseModel(
        id=request_id,
        customer_id=customer_id,
        export_type="customer_file",
        status=ExportJobStatuses.COMPLETED,
        s3_uri_path="s3://test-bucket/customer_exports/test_customer_partial/5/export_000.gz",
        record_count=None,  # No record count
    )

    mock_export_service.run_export.return_value = mock_response

    # Execute the task
    result = perform_export_customer_file_task.run(customer_id, request_id)

    # Verify result
    s3_path, success, record_count = result

    assert s3_path == "s3://test-bucket/customer_exports/test_customer_partial/5/export_000.gz"
    assert success is True  # Status is completed
    assert record_count == 0  # Defaults to 0 when None


def test_perform_export_customer_file_task_empty_s3_path(mock_export_service):
    """Test task when s3_uri_path is None but status is completed."""
    customer_id = "test_customer_no_path"
    request_id = 6

    # Create mock response with no s3_uri_path
    mock_response = ExportResponseModel(
        id=request_id,
        customer_id=customer_id,
        export_type="customer_file",
        status=ExportJobStatuses.COMPLETED,
        s3_uri_path=None,
        record_count=250,
    )

    mock_export_service.run_export.return_value = mock_response

    # Execute the task
    result = perform_export_customer_file_task.run(customer_id, request_id)

    # Verify result
    s3_path, success, record_count = result

    assert s3_path == ""  # Empty string when None
    assert success is True  # Status is completed
    assert record_count == 250


def test_perform_export_customer_file_task_zero_records(mock_export_service):
    """Test task when export completes with zero records."""
    customer_id = "test_customer_empty"
    request_id = 7

    # Create mock response with zero records
    mock_response = ExportResponseModel(
        id=request_id,
        customer_id=customer_id,
        export_type="customer_file",
        status=ExportJobStatuses.COMPLETED,
        s3_uri_path="s3://test-bucket/customer_exports/test_customer_empty/7/export_000.gz",
        record_count=0,
    )

    mock_export_service.run_export.return_value = mock_response

    # Execute the task
    result = perform_export_customer_file_task.run(customer_id, request_id)

    # Verify result
    s3_path, success, record_count = result

    assert s3_path == "s3://test-bucket/customer_exports/test_customer_empty/7/export_000.gz"
    assert success is True
    assert record_count == 0


def test_perform_export_customer_file_task_generic_exception(mock_export_service):
    """Test task execution when a generic exception is raised."""
    customer_id = "test_customer_exception"
    request_id = 8

    # Mock service to raise a generic exception
    mock_export_service.run_export.side_effect = RuntimeError("Unexpected error occurred")

    # Verify that the error propagates
    with pytest.raises(RuntimeError) as exc_info:
        perform_export_customer_file_task.run(customer_id, request_id)

    assert "Unexpected error occurred" in str(exc_info.value)
