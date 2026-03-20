from unittest.mock import patch

import pytest

from datapooler.adapters.db.repositories.customer_export_repository import (
    ExportJobStatuses,
    ExportJobTypes,
)


@pytest.fixture
def mock_export_task():
    """Mock the export task to prevent actual Celery task execution."""
    with patch("datapooler.web.routers.export.routes.tasks") as mock_tasks:
        mock_tasks.perform_export_customer_file_task.delay.return_value = None
        yield mock_tasks


def test_export_customer_file_success(api_client, mock_export_task):
    """Test successful export request creation."""
    with patch("datapooler.web.routers.export.routes.config") as mock_config:
        mock_config.is_production = True

        # Make the request
        response = api_client.post("/export/test_customer_123/customer-file")

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["export_id"] >= 1
        assert data["customer_id"] == "test_customer_123"
        assert data["status"] == ExportJobStatuses.PENDING
        assert data["export_type"] == ExportJobTypes.CUSTOMER_FILE

        # Verify task was triggered
        mock_export_task.perform_export_customer_file_task.delay.assert_called_once()
        call_args = mock_export_task.perform_export_customer_file_task.delay.call_args
        assert call_args[0][0] == "test_customer_123"
        assert call_args[0][1] == data["export_id"]


def test_export_customer_file_blocked_in_non_production(api_client, mock_export_task):
    """Test export is blocked in non-production environments."""
    with patch("datapooler.web.routers.export.routes.config") as mock_config:
        mock_config.is_production = False

        response = api_client.post("/export/test_customer_123/customer-file")

        # Verify 403 forbidden response
        assert response.status_code == 403
        assert "not allowed in non-production environments" in response.json()["detail"]

        # Verify no task was triggered
        mock_export_task.perform_export_customer_file_task.delay.assert_not_called()
