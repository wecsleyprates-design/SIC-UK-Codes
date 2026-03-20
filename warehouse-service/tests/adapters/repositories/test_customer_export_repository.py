import datetime
from unittest.mock import Mock, patch

import pytest

from datapooler.adapters.db.models import exports
from datapooler.adapters.db.repositories.customer_export_repository import (
    CustomerExportRepository,
    ExportJobStatuses,
    ExportJobTypes,
)
from datapooler.adapters.sessions import TransactionalSessions


@pytest.fixture
def seed_export_request():
    """Create a test export request in the database."""
    with TransactionalSessions.get_session() as session:
        export_request = exports.ExportRequestDb(
            customer_id="test_customer_123",
            export_type=ExportJobTypes.CUSTOMER_FILE,
            status=ExportJobStatuses.PENDING,
            bucket="test-bucket",
        )
        session.add(export_request)
        session.commit()
        request_id = export_request.id

    yield request_id


@pytest.mark.asyncio
async def test_create_request():
    """Test creating an export request."""
    repository = CustomerExportRepository()
    customer_id = "test_customer_456"

    export_request = await repository.create_request(customer_id)

    assert export_request is not None
    assert export_request.customer_id == customer_id
    assert export_request.export_type == ExportJobTypes.CUSTOMER_FILE
    assert export_request.status == ExportJobStatuses.PENDING
    assert export_request.bucket == repository.bucket
    assert export_request.id is not None


def test_get_existing_request(seed_export_request):
    """Test retrieving an existing export request."""
    repository = CustomerExportRepository()
    customer_id = "test_customer_123"

    export_request = repository.get(seed_export_request, customer_id)

    assert export_request is not None
    assert export_request.id == seed_export_request
    assert export_request.customer_id == customer_id
    assert export_request.status == ExportJobStatuses.PENDING


def test_get_nonexistent_request():
    """Test retrieving a non-existent export request."""
    repository = CustomerExportRepository()

    export_request = repository.get(99999, "nonexistent_customer")

    assert export_request is None


def test_get_wrong_customer():
    """Test retrieving with wrong customer_id returns None."""
    repository = CustomerExportRepository()

    # Create a request for one customer
    with TransactionalSessions.get_session() as session:
        export_request = exports.ExportRequestDb(
            customer_id="customer_a",
            export_type=ExportJobTypes.CUSTOMER_FILE,
            status=ExportJobStatuses.PENDING,
            bucket="test-bucket",
        )
        session.add(export_request)
        session.commit()
        request_id = export_request.id

    # Try to get it with a different customer_id
    result = repository.get(request_id, "customer_b")

    assert result is None


@pytest.mark.asyncio
async def test_get_async_existing_request(seed_export_request):
    """Test async retrieval of an existing export request."""
    repository = CustomerExportRepository()
    customer_id = "test_customer_123"

    export_request = await repository.get_async(seed_export_request, customer_id)

    assert export_request is not None
    assert export_request.id == seed_export_request
    assert export_request.customer_id == customer_id
    assert export_request.status == ExportJobStatuses.PENDING


@pytest.mark.asyncio
async def test_get_async_nonexistent_request():
    """Test async retrieval of a non-existent export request."""
    repository = CustomerExportRepository()

    export_request = await repository.get_async(99999, "nonexistent_customer")

    assert export_request is None


def test_update_status(seed_export_request):
    """Test updating export request status."""
    repository = CustomerExportRepository()

    # Get the original request
    export_request = repository.get(seed_export_request, "test_customer_123")
    assert export_request.status == ExportJobStatuses.PENDING

    # Update to IN_PROGRESS
    updated_request = repository.update(export_request, ExportJobStatuses.IN_PROGRESS)
    assert updated_request.status == ExportJobStatuses.IN_PROGRESS

    # Verify it was persisted
    retrieved_request = repository.get(seed_export_request, "test_customer_123")
    assert retrieved_request.status == ExportJobStatuses.IN_PROGRESS


def test_update_status_to_completed(seed_export_request):
    """Test updating export request to completed status."""
    repository = CustomerExportRepository()

    export_request = repository.get(seed_export_request, "test_customer_123")
    updated_request = repository.update(export_request, ExportJobStatuses.COMPLETED)

    assert updated_request.status == ExportJobStatuses.COMPLETED

    # Verify persistence
    retrieved_request = repository.get(seed_export_request, "test_customer_123")
    assert retrieved_request.status == ExportJobStatuses.COMPLETED


def test_update_status_to_failed(seed_export_request):
    """Test updating export request to failed status."""
    repository = CustomerExportRepository()

    export_request = repository.get(seed_export_request, "test_customer_123")
    updated_request = repository.update(export_request, ExportJobStatuses.FAILED)

    assert updated_request.status == ExportJobStatuses.FAILED

    # Verify persistence
    retrieved_request = repository.get(seed_export_request, "test_customer_123")
    assert retrieved_request.status == ExportJobStatuses.FAILED


def test_export_calls_procedure(seed_export_request):
    """Test export method calls the Redshift procedure and updates request."""
    repository = CustomerExportRepository()

    # Get the export request
    export_request = repository.get(seed_export_request, "test_customer_123")

    # Mock the warehouse session execute method
    mock_result = {
        "o_s3_path": "s3://test-bucket/customer_exports/test_customer_123/1/customer_export_20260127120000_",  # noqa: E501
        "o_record_count": 100,
        "o_started_at": datetime.datetime(2026, 1, 27, 12, 0, 0),
        "o_ended_at": datetime.datetime(2026, 1, 27, 12, 5, 0),
    }

    with patch.object(repository, "warehouse_sessions") as mock_warehouse_sessions:
        mock_session = Mock()
        mock_execute_result = Mock()
        mock_execute_result.mappings.return_value.first.return_value = mock_result
        mock_session.execute.return_value = mock_execute_result
        mock_warehouse_sessions.get_session.return_value.__enter__.return_value = mock_session

        # Execute the export
        result = repository.export(export_request)

        # Verify the procedure was called with correct parameters
        mock_session.execute.assert_called_once()
        call_args = mock_session.execute.call_args

        # Check that the SQL text contains the procedure call
        sql_text = str(call_args[0][0])
        assert "CALL sp_export_customer_file_to_s3" in sql_text
        assert ":customer_id" in sql_text
        assert ":s3_key" in sql_text

        # Check the bound parameters
        assert call_args[0][1]["customer_id"] == "test_customer_123"
        assert (
            call_args[0][1]["s3_key"] == f"customer_exports/test_customer_123/{seed_export_request}"
        )

        # Verify the export request was updated with procedure results
        assert result.s3_uri_path == mock_result["o_s3_path"] + "000.gz"
        assert result.record_count == 100
        assert result.started_at == mock_result["o_started_at"]
        assert result.completed_at == mock_result["o_ended_at"]


def test_s3_key_generation(seed_export_request):
    """Test s3_key method generates correct S3 key."""
    repository = CustomerExportRepository()
    export_request = repository.get(seed_export_request, "test_customer_123")

    s3_key = export_request.s3_key()

    assert s3_key == f"customer_exports/test_customer_123/{seed_export_request}"


def test_fill_procedure_results():
    """Test fill_procedure_results method correctly populates fields."""
    export_request = exports.ExportRequestDb(
        customer_id="test_customer",
        export_type=ExportJobTypes.CUSTOMER_FILE,
        status=ExportJobStatuses.IN_PROGRESS,
        bucket="test-bucket",
    )

    o_s3_path = "s3://test-bucket/customer_exports/test_customer/1/customer_export_20260127120000_"
    o_record_count = 500
    o_started_at = datetime.datetime(2026, 1, 27, 12, 0, 0)
    o_ended_at = datetime.datetime(2026, 1, 27, 12, 10, 0)

    export_request.fill_procedure_results(
        o_s3_path=o_s3_path,
        o_record_count=o_record_count,
        o_started_at=o_started_at,
        o_ended_at=o_ended_at,
    )

    # Verify it appends "000.gz" to the s3_uri_path
    assert export_request.s3_uri_path == o_s3_path + "000.gz"
    assert export_request.record_count == o_record_count
    assert export_request.started_at == o_started_at
    assert export_request.completed_at == o_ended_at
