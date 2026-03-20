import pytest

from datapooler.models import businesses, firmographics
from datapooler.services.firmographics import FirmographicsService


class TestFirmographicsService:
    """Test the FirmographicsService using SQLite fixtures for real repository testing."""

    @pytest.mark.parametrize(
        "integration,business_fixture",
        [
            ("equifax", "equifax_businesses"),
            ("zoominfo", "zoominfo_businesses"),
            ("canada_open", "canada_open_businesses"),
            ("open_corporate", "open_corporate_businesses"),
        ],
    )
    def test_get_firmographics_success(self, integration, business_fixture, request):
        """Test successful retrieval of firmographics for all integrations using real repos."""
        # Get businesses from the appropriate fixture
        businesses_list = request.getfixturevalue(business_fixture)
        business = businesses_list[0]
        business_id = "test_business_123"

        # Create service - the SQLite fixtures handle repository mocking automatically
        service = FirmographicsService(
            business_id=business_id,
            businesses=[business],
            integration=integration,
            match_id="match_123",
            prediction=0.95,
        )

        # Test get_firmographics - this will use the real repository with SQLite data
        result = service.get_firmographics()

        # Verify result structure
        assert isinstance(result, firmographics.FirmographicsResult)
        assert result.business_id == business_id
        assert result.source == integration
        assert result.match_id == "match_123"
        assert result.prediction == 0.95
        assert isinstance(result.firmographics, firmographics.Firmographics)

        # Verify firmographics data is not empty
        # Use .root to access the underlying dict since Firmographics is a RootModel
        firmographics_dict = result.firmographics.root

        for key, value in firmographics_dict.items():
            assert isinstance(value, list)
            assert len(value) > 0

    def test_get_firmographics_empty_business_list(self):
        """Test error when business list is empty."""
        service = FirmographicsService(
            business_id="test_business_123",
            match_id="match_123",
            prediction=0.01,
            businesses=[],
            integration="equifax",
        )

        with pytest.raises(ValueError, match="Business list is empty"):
            service.get_firmographics()

    def test_get_firmographics_no_data_found(self, equifax_businesses):
        """Test when no firmographics data is found for the given business."""
        # Use a business that won't match any data in SQLite
        non_matching_business = businesses.EquifaxBusiness(
            efx_id="nonexistent_id",
            name="Non-existent Business",
            address="999 Nowhere St",
            city="Nowhere",
            state="XX",
            zip="00000",
        )

        business_id = "nonexistent_business_123"

        service = FirmographicsService(
            business_id=business_id,
            businesses=[non_matching_business],
            integration="equifax",
            match_id="match_123",
            prediction=0.99,
        )

        # Test get_firmographics - it should return empty firmographics instead of raising error
        result = service.get_firmographics()

        # Verify the result has empty firmographics data
        assert isinstance(result, firmographics.FirmographicsResult)
        assert result.business_id == business_id
        assert result.source == "equifax"

        # The firmographics should be empty or have empty lists
        firmographics_dict = result.firmographics.root
        if firmographics_dict:
            for key, value in firmographics_dict.items():
                assert isinstance(value, list)
                assert len(value) == 0  # Empty list for no matches
