from unittest.mock import Mock, patch

import pytest

from datapooler.models import firmographics
from datapooler.tasks.generate_firmographics import generate_firmographics_task


class TestGenerateFirmographicsTask:
    """Test the generate_firmographics_task function."""

    @patch("datapooler.tasks.generate_firmographics.firmographics.FirmographicsService")
    def test_generate_firmographics_task_success(
        self, mock_service_class, integration_test_data, request
    ):
        """Test successful execution of firmographics generation task."""
        test_data = integration_test_data
        businesses_list = request.getfixturevalue(test_data["business_fixture"])
        business = businesses_list[0]  # Use first business from fixture
        business_id = "test_business_456"
        integration = test_data["integration"]
        firmographics_data = test_data["firmographics_data"]
        match_id = "match_456"
        prediction = 0.85

        # Create the expected result using the parameterized data
        sample_firmographics_result = firmographics.FirmographicsResult(
            business_id=business_id,
            firmographics=firmographics_data,
            source=integration,
            match_id=match_id,
            prediction=prediction,
        )

        # Setup mock service
        mock_service = Mock()
        mock_service.get_firmographics.return_value = sample_firmographics_result
        mock_service.publish.return_value = True
        mock_service_class.return_value = mock_service

        # Execute the task
        result = generate_firmographics_task(
            business_id=business_id,
            business=business,
            integration=integration,
            match_id=match_id,
            prediction=prediction,
        )

        # Verify service was initialized correctly
        mock_service_class.assert_called_once_with(
            business_id=business_id,
            businesses=[business],
            integration=integration,
            match_id=match_id,
            prediction=prediction,
        )

        # Verify service methods were called
        mock_service.get_firmographics.assert_called_once()
        mock_service.publish.assert_called_once_with(sample_firmographics_result)

        # Verify result
        assert result == (business_id, True, integration)

    @patch("datapooler.tasks.generate_firmographics.firmographics.FirmographicsService")
    def test_generate_firmographics_task_get_firmographics_failure(
        self, mock_service_class, equifax_businesses
    ):
        """Test task when get_firmographics fails."""
        business = equifax_businesses[0]
        business_id = "test_business_456"

        # Setup mock service to fail on get_firmographics
        mock_service = Mock()
        mock_service.get_firmographics.side_effect = ValueError("No firmographics found")
        mock_service_class.return_value = mock_service

        # Execute the task and expect it to raise the exception
        with pytest.raises(ValueError, match="No firmographics found"):
            generate_firmographics_task(
                business_id=business_id,
                business=business,
                integration="equifax",
                match_id="match_456",
                prediction=0.85,
            )

        # Verify get_firmographics was called but publish was not
        mock_service.get_firmographics.assert_called_once()
        mock_service.publish.assert_not_called()

    @patch("datapooler.tasks.generate_firmographics.firmographics.FirmographicsService")
    def test_generate_firmographics_task_publish_failure(
        self, mock_service_class, equifax_businesses, mock_firmographics_data
    ):
        """Test task when publishing fails."""
        business = equifax_businesses[0]
        business_id = "test_business_456"

        # Create the firmographics result using the shared fixture
        sample_firmographics_result = firmographics.FirmographicsResult(
            business_id=business_id,
            firmographics=mock_firmographics_data,
            source="equifax",
            match_id="match_456",
            prediction=0.85,
        )

        # Setup mock service with publish failure
        mock_service = Mock()
        mock_service.get_firmographics.return_value = sample_firmographics_result
        mock_service.publish.return_value = False  # Simulate publish failure
        mock_service_class.return_value = mock_service

        # Execute the task - it should still return the result even if publish fails
        result = generate_firmographics_task(
            business_id=business_id,
            business=business,
            integration="equifax",
            match_id="match_456",
            prediction=0.85,
        )

        # Verify service methods were called
        mock_service.get_firmographics.assert_called_once()
        mock_service.publish.assert_called_once_with(sample_firmographics_result)

        # Verify result is still returned
        assert result == (business_id, True, "equifax")
