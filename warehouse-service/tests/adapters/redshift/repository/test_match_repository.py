"""Tests for match repository classes using real SQLite database."""

import pytest
from sqlalchemy import String, cast, or_

from datapooler.adapters.redshift.repository.match_repository import (
    MAP_REPOSITORY_CLASSES,
    NULL_POSTAL_CODE_ALLOWED_COUNTRIES,
    CanadaOpenMatchRepository,
    EquifaxMatchRepository,
    NPIMatchRepository,
    OpenCorporateMatchRepository,
    ZoomInfoMatchRepository,
    _get_repository_class,
)
from datapooler.models import businesses
from datapooler.models.firmographics import Firmographics


class TestRepositoryFunctionality:
    """Test repository methods against SQLite database."""

    def test_equifax_get_matches(self, worth_businesses):
        """Test Equifax repository get_matches with real SQLite data."""
        repo = EquifaxMatchRepository()
        results = repo.get_matches(worth_businesses)

        # Should return actual EquifaxBusiness objects from SQLite
        assert isinstance(results, list)
        if results:  # If we have matches
            assert all(isinstance(r, businesses.EquifaxBusiness) for r in results)
            # Check that we got valid business data
            for business in results:
                assert business.efx_id is not None
                assert business.name is not None

    def test_open_corporate_get_matches(self, worth_businesses):
        """Test OpenCorporate repository get_matches with real SQLite data."""
        repo = OpenCorporateMatchRepository()
        results = repo.get_matches(worth_businesses)

        # Should return actual OpenCorporateBusiness objects from SQLite
        assert isinstance(results, list)
        if results:  # If we have matches
            assert all(isinstance(r, businesses.OpenCorporateBusiness) for r in results)
            # Check that we got valid business data
            for business in results:
                assert business.company_number is not None
                assert business.name is not None

    def test_zoominfo_get_matches(self, worth_businesses):
        """Test ZoomInfo repository get_matches with real SQLite data."""
        repo = ZoomInfoMatchRepository()
        results = repo.get_matches(worth_businesses)

        # Should return actual ZoomInfoBusiness objects from SQLite
        assert isinstance(results, list)
        if results:  # If we have matches
            assert all(isinstance(r, businesses.ZoomInfoBusiness) for r in results)
            # Check that we got valid business data
            for business in results:
                assert business.company_id is not None
                assert business.name is not None

    def test_canada_open_get_matches(self, worth_businesses):
        """Test Canada Open repository get_matches with real SQLite data."""
        repo = CanadaOpenMatchRepository()
        results = repo.get_matches(worth_businesses)

        # Should return actual CanadaOpenBusiness objects from SQLite
        assert isinstance(results, list)
        if results:  # If we have matches
            assert all(isinstance(r, businesses.CanadaOpenBusiness) for r in results)
            # Check that we got valid business data
            for business in results:
                assert business.corporate_id is not None
                assert business.name is not None

    @pytest.mark.skip(reason="lpad required for redshift, not in SQLite")
    def test_npi_get_matches(self):
        """Test NPI repository get_matches with real SQLite data."""

        smb = businesses.WorthBusiness(
            name="ACME MEDICAL CENTER",
            address="123 MAIN ST",
            zip="12345",
            state="CA",
            city="LOS ANGELES",
            country="US",
            business_id="test_001",
        )

        repo = NPIMatchRepository()
        results = repo.get_matches([smb])

        # Should return actual NPIBusiness objects from SQLite
        assert isinstance(results, list)
        assert all(isinstance(r, businesses.NPIBusiness) for r in results)
        # Check that we got valid business data
        for business in results:
            assert business.npi_number is not None
            assert business.name is not None

    def test_npi_set_results(self):

        rows = [
            {
                "npi": "1234567890",
                "entity type code": "1",
                "replacement npi": None,
                "ein": "12-3456789",
                "provider organization name": "ACME MEDICAL CENTER",
                "provider last name": "SMITH",
                "provider first name": "JOHN",
                "provider middle name": None,
                "provider name prefix text": None,
                "provider name suffix text": None,
                "provider credential text": None,
                "provider other organization name": "ACME HEALTH SERVICES",
                "provider other organization name type code": None,
                "provider other last name": None,
                "provider other first name": None,
                "provider other middle name": None,
                "provider other name prefix text": None,
                "provider other name suffix text": None,
                "provider other credential text": None,
                "provider other last name type code": None,
                "provider first line business mailing address": "123 MAIN ST",
                "provider second line business mailing address": None,
                "provider business mailing address city name": "LOS ANGELES",
                "provider business mailing address state name": "CA",
                "provider business mailing address postal code": "12345",
                "provider business mailing address country code if outside us": None,
                "provider business mailing address telephone number": "5551234567",
                "provider business mailing address fax number": None,
                "provider first line business practice location address": "123 MAIN ST",
                "provider second line business practice location address": None,
                "provider business practice location address city name": "LOS ANGELES",
                "provider business practice location address state name": "CA",
                "provider business practice location address postal code": "12345",
                "provider business practice location address country code if outside us": None,
                "provider business practice location address telephone number": "5551234567",
                "provider business practice location address fax number": None,
                "provider enumeration date": "2020-01-15",
                "last update date": "2023-06-10",
                "npi deactivation reason code": None,
                "npi deactivation date": None,
                "npi reactivation date": None,
                "provider gender code": None,
                "authorized official last name": "SMITH",
                "authorized official first name": "JOHN",
                "authorized official middle name": "A",
                "authorized official title or position": "CEO",
                "authorized official telephone number": "5551234567",
                "healthcare provider taxonomy code 1": "282N00000X",
                "provider license number 1": "CA12345",
                "provider license number state code 1": "CA",
                "healthcare provider primary taxonomy switch 1": "Y",
                "provider organization name (legal business name)": "ACME MEDICAL CENTER",
                "provider last name (legal name)": "SMITH",
                "provider business practice location address address_1": "123 MAIN ST",
                "provider business practice location address country code (if outside u.s.)": "US",
                "provider license number": "CA12345",
            }
        ]
        repo = NPIMatchRepository()
        results = []
        for row in rows:
            repo._set_results(results, row)

        # Since the seeded row that matches ACME MEDICAL CENTER has other name filled
        # We can expect the repository to return an NPIBusiness object for the legal name and
        # the other name so that matching can run against both names.
        assert len(results) == 2

        npi_match_candidate_1, npi_match_candidate_2 = results

        #  Since this match will be split into two candidates, one for each name field,
        #  we can check that the names are assigned correctly.
        assert npi_match_candidate_1.other_name == npi_match_candidate_2.name
        assert npi_match_candidate_2.other_name is None

    def test_empty_business_list_handling(self):
        """Test how repositories handle empty business lists."""
        empty_businesses = []

        # Equifax raises ValueError for empty lists
        equifax_repo = EquifaxMatchRepository()
        with pytest.raises(ValueError, match="Business list is empty"):
            equifax_repo.get_matches(empty_businesses)

        # Other repositories return None for empty lists
        open_corporate_repo = OpenCorporateMatchRepository()
        result = open_corporate_repo.get_matches(empty_businesses)
        assert result is None

        zoominfo_repo = ZoomInfoMatchRepository()
        result = zoominfo_repo.get_matches(empty_businesses)
        assert result is None

        canada_open_repo = CanadaOpenMatchRepository()
        result = canada_open_repo.get_matches(empty_businesses)
        assert result is None

    def test_single_business_matching(self):
        """Test matching with a single business."""
        single_business = [
            businesses.WorthBusiness(
                business_id="test_001",
                name="ACME Corporation",
                address="123 Main Street",
                city="Los Angeles",
                state="CA",
                zip="12345",
                country="US",
            )
        ]

        # Test each repository with a single business
        equifax_repo = EquifaxMatchRepository()
        equifax_results = equifax_repo.get_matches(single_business)
        assert isinstance(equifax_results, list)

        open_corporate_repo = OpenCorporateMatchRepository()
        oc_results = open_corporate_repo.get_matches(single_business)
        assert isinstance(oc_results, list)

        zoominfo_repo = ZoomInfoMatchRepository()
        zi_results = zoominfo_repo.get_matches(single_business)
        assert isinstance(zi_results, list)

        canada_open_repo = CanadaOpenMatchRepository()
        ca_results = canada_open_repo.get_matches(single_business)
        assert isinstance(ca_results, list)

    def test_equifax_get_firmographics(self):
        """Test Equifax get_firmographics with real SQLite data."""
        repo = EquifaxMatchRepository()

        # Create sample business objects with efx_id attributes
        sample_businesses = [
            businesses.EquifaxBusiness(
                efx_id="efx_001",
                efx_eng_companyname="ACME CORP",
                efx_eng_address="123 MAIN ST",
            ),
            businesses.EquifaxBusiness(
                efx_id="efx_002",
                efx_eng_companyname="BETA CORP",
                efx_eng_address="456 OAK ST",
            ),
        ]

        firmographics = repo.get_firmographics(sample_businesses)

        # Should return Firmographics object with data from SQLite
        assert isinstance(firmographics, Firmographics)

        # Check that we have the expected sources
        expected_sources = ["equifax_us_raw", "equifax_bma_raw"]
        for source in expected_sources:
            if source in firmographics:
                assert isinstance(firmographics[source], list)

    def test_open_canada_get_matches(self):
        worth_businesses = [
            businesses.WorthBusiness(
                business_id="test_001",
                name="ACME CORPORATION CANADA",
                address="123 MAIN ST",
                city="TORONTO",
                state="ON",
                zip="M5H2N2",
                country="CA",
            ),
            businesses.WorthBusiness(
                business_id="test_002",
                name="BETA LLC CANADA",
                address="456 BUSINESS AVE",
                city="VANCOUVER",
                state="BC",
                zip="V6B1A1",
                country="CA",
                extra=businesses.ExtraInfo(
                    canada_open_business_number="BN987654321",
                    canada_open_corporate_id="2",
                ),
            ),
        ]

        repo = CanadaOpenMatchRepository()
        results = repo.get_matches(worth_businesses)

        # Should return actual CanadaOpenBusiness objects from SQLite
        assert isinstance(results, list)
        cao_business_1, cao_business_2 = results

        assert isinstance(cao_business_1, businesses.CanadaOpenBusiness)
        assert cao_business_1.corporate_id == "1"
        assert cao_business_1.business_number == "BN123456789"
        assert cao_business_1.name == "ACME CORP CANADA"
        assert cao_business_1.address == "123 MAIN ST"
        assert cao_business_1.city == "TORONTO"
        assert cao_business_1.state == "ON"

        assert isinstance(cao_business_2, businesses.CanadaOpenBusiness)
        assert cao_business_2.corporate_id == "2"
        assert cao_business_2.business_number == "BN987654321"
        assert cao_business_2.name == "BETA LLC CANADA"
        assert cao_business_2.address == "456 BUSINESS AVE"
        assert cao_business_2.city == "VANCOUVER"
        assert cao_business_2.state == "BC"

    def test_explicit_id_clause(self):
        """Test the explicit ID clause for Canada Open repository."""
        repo = CanadaOpenMatchRepository()

        # Create a sample business with explicit IDs
        business = businesses.WorthBusiness(
            business_id="test_001",
            name="ACME CORP CANADA",
            address="123 MAIN ST",
            city="TORONTO",
            state="ON",
            zip="M5H2N2",
            country="CA",
            extra=businesses.ExtraInfo(
                canada_open_business_number="BN123456789",
                canada_open_corporate_id="1",
            ),
        )

        clause = str(repo._explicit_id_clause(business))

        # Check that the clause is correct
        expected_clause = str(
            or_(
                repo._tbl.c.business_number == "BN123456789",
                repo._tbl.c.id == "1",
            )
        )

        assert clause == expected_clause

    def test_canada_open_get_firmographics(self):
        """Test Canada Open get_firmographics with real SQLite data."""
        repo = CanadaOpenMatchRepository()

        # Create sample business objects with corporate_id attributes
        sample_businesses = [
            businesses.CanadaOpenBusiness(
                corporate_id="ca_001",
                name="ACME CORP CANADA",
                business_number="BN123456789",
            ),
            businesses.CanadaOpenBusiness(
                corporate_id="ca_002",
                name="BETA LLC CANADA",
                business_number="BN987654321",
            ),
        ]

        firmographics = repo.get_firmographics(sample_businesses)

        # Should return Firmographics object with data from SQLite
        assert isinstance(firmographics, Firmographics)

        # Check that we have the expected sources
        if "ca_open_businesses" in firmographics:
            assert isinstance(firmographics["ca_open_businesses"], list)

    def test_open_corporate_get_firmographics(self):
        """Test OpenCorporate get_firmographics with real SQLite data."""
        repo = OpenCorporateMatchRepository()

        # Create sample business objects with company_number attributes
        sample_businesses = [
            businesses.OpenCorporateBusiness(
                company_number="OPC0",
                jurisdiction_code="US-NY",
                name="ACME CORPORATION",
                address="123 MAIN ST",
                zip="12345",
            ),
        ]

        firmographics = repo.get_firmographics(sample_businesses)

        # Should return Firmographics object with data from SQLite
        assert isinstance(firmographics, Firmographics)

        # Check that we have the expected sources
        for source in repo._firmographic_sources:
            assert source in firmographics.keys()

        assert len(firmographics["companies"]) == 2  # Should include home jurisdiction match

    def test_npi_get_firmographics(self):
        """Test NPI get_firmographics with real SQLite data."""
        repo = NPIMatchRepository()

        # Create sample business objects with npi_number attributes
        sample_businesses = [
            businesses.NPIBusiness(
                npi="1234567890",
                name="ACME MEDICAL CENTER",
                address="123 MAIN ST",
                zip="12345",
                state="CA",
                city="LOS ANGELES",
                country="US",
            ),
        ]

        firmographics = repo.get_firmographics(sample_businesses)

        # Should return Firmographics object with data from SQLite
        assert isinstance(firmographics, Firmographics)

        for source in repo._firmographic_sources:
            assert source in firmographics.keys()
            assert isinstance(firmographics[source], list)
            assert len(firmographics[source]) > 0

    @pytest.mark.parametrize(
        "repository,country_code,column",
        [
            (OpenCorporateMatchRepository, "IE", "zipcode_threedigits"),
            (ZoomInfoMatchRepository, "IE", "zi_eng_zipcode_threedigits"),
            (OpenCorporateMatchRepository, "GB", "zipcode_threedigits"),
            (ZoomInfoMatchRepository, "GB", "zi_eng_zipcode_threedigits"),
        ],
    )
    def test_postal_code_clause(self, repository, country_code, column):
        """Test the postal code clause for different countries."""
        repo = repository()

        # Create a sample business with a postal code
        business = businesses.WorthBusiness(
            business_id="test_001",
            name="Test Business",
            address="123 Test St",
            zip="123456",
            country=country_code,
            state="N/A",
            city="Test City",
        )

        # Test the postal code clause
        clause = str(repo._postal_code_clause(business, getattr(repo._tbl.c, column)))

        # Check that the clause is correct
        if country_code in NULL_POSTAL_CODE_ALLOWED_COUNTRIES:
            # For IE, we allow None values to match as well
            assert str(clause) == str(
                or_(
                    getattr(repo._tbl.c, column) == cast(business.zip3, String),
                    getattr(repo._tbl.c, column).is_(None),
                )
            )
        else:
            assert clause == str((getattr(repo._tbl.c, column) == cast(business.zip3, String)))


class TestRepositoryFactory:
    """Test repository factory functionality."""

    @pytest.mark.parametrize(
        "integration", ["equifax", "open_corporate", "zoominfo", "canada_open"]
    )
    def test_get_repository_class(self, integration):
        """Test that _get_repository_class returns correct instances for all integrations."""
        repo_instance = _get_repository_class(integration)

        expected_classes = {
            "equifax": EquifaxMatchRepository,
            "open_corporate": OpenCorporateMatchRepository,
            "zoominfo": ZoomInfoMatchRepository,
            "canada_open": CanadaOpenMatchRepository,
            "npi": NPIMatchRepository,
        }

        # Check that we get an instance of the expected class
        assert isinstance(repo_instance, expected_classes[integration])

    def test_get_repository_class_invalid(self):
        """Test that _get_repository_class raises KeyError for invalid integration."""
        with pytest.raises(KeyError):
            _get_repository_class("invalid_integration")

    def test_map_repository_classes_completeness(self):
        """Test that MAP_REPOSITORY_CLASSES contains all expected repositories."""
        expected_integrations = {"equifax", "open_corporate", "zoominfo", "canada_open", "npi"}
        actual_integrations = set(MAP_REPOSITORY_CLASSES.keys())

        assert actual_integrations == expected_integrations

        # Test that all classes are correct
        assert MAP_REPOSITORY_CLASSES["equifax"] == EquifaxMatchRepository
        assert MAP_REPOSITORY_CLASSES["open_corporate"] == OpenCorporateMatchRepository
        assert MAP_REPOSITORY_CLASSES["zoominfo"] == ZoomInfoMatchRepository
        assert MAP_REPOSITORY_CLASSES["canada_open"] == CanadaOpenMatchRepository
        assert MAP_REPOSITORY_CLASSES["npi"] == NPIMatchRepository
