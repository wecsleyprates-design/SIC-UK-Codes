import os
from unittest.mock import Mock, patch

import pytest
import smart_open
from fastapi.testclient import TestClient
from sqlalchemy import Table, create_engine
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy_utils import create_database, database_exists

from datapooler import config
from datapooler.adapters import engines, sessions
from datapooler.adapters.db.models import MatchRequestDb, base
from datapooler.adapters.redshift.repository import match_repository
from datapooler.models import businesses, firmographics
from datapooler.services.firmographics import FirmographicsService
from datapooler.web.routers.matching.models import MatchRequest

pytest_plugins = [
    "tests.fixtures.sqlite_fixtures",
]


@pytest.fixture(autouse=True, scope="session")
def mock_kafka_messaging():
    """Automatically mock Kafka connections to prevent network connections in tests."""
    # Patch KafkaProducer to prevent actual connections
    with patch("datapooler.adapters.messages.producer.KafkaProducer") as mock_kafka_producer:
        # Create mock producer instance that tracks method calls
        mock_producer_instance = Mock()
        mock_producer_instance.send.return_value = None
        mock_producer_instance.flush.return_value = None
        mock_kafka_producer.return_value = mock_producer_instance

        # Store reference for test access
        mock_kafka_messaging.mock_producer = mock_producer_instance

        yield mock_producer_instance


@pytest.fixture(scope="session", autouse=True)
def patch_db_name():
    with patch.object(config, "config_db_name", "test_db"):
        with patch.object(
            engines.Engines, "transactional", create_engine(config.postgres_connection_string())
        ):
            with patch.object(
                sessions.TransactionalSessions,
                "sessions",
                sessionmaker(engines.Engines.transactional, expire_on_commit=False),
            ):
                yield


@pytest.fixture(scope="function", autouse=True)
def patch_async_db_name():
    with patch.object(config, "config_db_name", "test_db"):
        # Create a new async engine for each test function
        async_engine = create_async_engine(config.postgres_connection_string(_async=True))
        with patch.object(
            engines.Engines,
            "async_transactional",
            async_engine,
        ):
            # Create a new sessionmaker bound to the new engine
            async_session_maker = sessionmaker(
                async_engine,
                expire_on_commit=False,
                class_=sessions.AsyncSession,
            )
            with patch.object(
                sessions.AsyncTransactionalSessions,
                "sessions",
                async_session_maker,
            ):
                yield


@pytest.fixture(scope="function", autouse=True)
def set_database(patch_db_name):
    if not database_exists(engines.Engines.transactional.url):
        create_database(engines.Engines.transactional.url)

    base.Base.metadata.bind = engines.Engines.transactional
    base.Base.metadata.create_all()
    yield
    base.Base.metadata.drop_all()


@pytest.fixture()
def integrations_base_file_path() -> str:
    return os.path.join(os.path.dirname(__file__), "data/integrations")


@pytest.fixture()
def middesk_business_entity_verification_data(integrations_base_file_path) -> str:
    path = os.path.join(integrations_base_file_path, "middesk/business_entity_verification.json.gz")

    with smart_open.open(path, "r") as f:
        return f.readline()


@pytest.fixture()
def rutter_balance_sheet_data(integrations_base_file_path) -> str:
    path = os.path.join(integrations_base_file_path, "rutter/balancesheet.json.gz")

    with smart_open.open(path, "r") as f:
        return f.readline()


@pytest.fixture()
def rutter_business_info_data(integrations_base_file_path) -> str:
    path = os.path.join(integrations_base_file_path, "rutter/business_info.json.gz")

    with smart_open.open(path, "r") as f:
        return f.readline()


@pytest.fixture()
def rutter_cash_flow_data(integrations_base_file_path) -> str:
    path = os.path.join(integrations_base_file_path, "rutter/cashflow.json.gz")

    with smart_open.open(path, "r") as f:
        return f.readline()


@pytest.fixture()
def rutter_income_statement_data(integrations_base_file_path) -> str:
    path = os.path.join(integrations_base_file_path, "rutter/incomestatement.json.gz")

    with smart_open.open(path, "r") as f:
        return f.readline()


@pytest.fixture()
def plaid_assests_report_data(integrations_base_file_path) -> str:
    path = os.path.join(integrations_base_file_path, "plaid/asset_reports.json.gz")

    with smart_open.open(path, "r") as f:
        return f.readline()


@pytest.fixture()
def verdata_public_records_data(integrations_base_file_path) -> str:
    path = os.path.join(integrations_base_file_path, "verdata/public_records.json.gz")

    with smart_open.open(path, "r") as f:
        return f.readline()


@pytest.fixture()
def equifax_judgements_liens_data(integrations_base_file_path) -> str:
    path = os.path.join(integrations_base_file_path, "equifax/judgementsLiens.json.gz")

    with smart_open.open(path, "r") as f:
        return f.readline()


@pytest.fixture
def worth_businesses(n=2):
    businesses_list = [
        businesses.WorthBusiness(
            business_id="business_id",
            name=f"Worth Business {i}",
            address=f"{i} Main St",
            state="CA",
            zip=f"1234{i}",
            city="Los Angeles",
            country="US",
        )
        for i in range(n)
    ]
    yield businesses_list


@pytest.fixture
def equifax_businesses(n=2):
    businesses_list = [
        businesses.EquifaxBusiness(
            efx_id=f"EFX{i}",
            name=f"Equifax Business {i}",
            address=f"{i} Elm St",
            city="San Francisco",
            state="CA",
            zip=f"9410{i}",
        )
        for i in range(n)
    ]
    yield businesses_list


@pytest.fixture
def zoominfo_businesses(n=2):
    businesses_list = [
        businesses.ZoomInfoBusiness(
            company_id=f"ZB{i}",
            location_id=f"LOC{i}",
            es_location_id=f"ESLOC{i}",
            name=f"ZoomInfo Business {i}",
            address=f"{i} Oak St",
            city="Seattle",
            state="WA",
            zip=f"9810{i}",
        )
        for i in range(n)
    ]
    yield businesses_list


@pytest.fixture
def open_corporate_businesses(n=2):
    businesses_list = [
        businesses.OpenCorporateBusiness(
            company_uuid=f"OC{i}",
            company_number=f"OPC{i}",
            name=f"Open Corporate Business {i}",
            address=f"{i} Pine St",
            city="New York",
            state="NY",
            jurisdiction_code="US-NY",
            zip=f"1000{i}",
        )
        for i in range(n)
    ]
    yield businesses_list


@pytest.fixture
def canada_open_businesses(n=2):
    businesses_list = [
        businesses.CanadaOpenBusiness(
            corporate_id=f"CA{i}",
            business_number=f"BN{i:06d}",
            current_name=f"Canada Business {i}",
            sanitized_name=f"Canada Business {i}",
            normalized_name=f"Canada Business {i}",
            other_names=f"Canada Biz {i}",
            normalized_address=f"{i} Maple Rd",
            other_addresses=f"Unit {i}, {i} Maple Rd",
            city="Toronto",
            region="Ontario",
            postal_code=f"M5V {i}T{i}",
            country="CA",
        )
        for i in range(n)
    ]
    yield businesses_list


@pytest.fixture
def npi_businesses(n=2):
    businesses_list = [
        businesses.NPIBusiness(
            npi="1234567890",
            first_name=f"First{i}",
            last_name=f"Last{i}",
            name=f"NPI Organization {i}",
            address=f"{i} Health St",
            city="Los Angeles",
            state="CA",
            zip="12345",
        )
        for i in range(n)
    ]
    yield businesses_list


@pytest.fixture
def mock_canada_open_repository(canada_open_businesses):
    with patch.object(
        match_repository.CanadaOpenMatchRepository, "get_matches"
    ) as mock_get_matches:
        with patch.object(
            match_repository.CanadaOpenMatchRepository, "_get_table_obj"
        ) as mock_get_tbl:
            mock_get_tbl.return_value = Table
            mock_get_matches.return_value = [*canada_open_businesses]

            yield mock_get_matches


@pytest.fixture
def mock_equifax_repository(equifax_businesses):
    with patch.object(match_repository.EquifaxMatchRepository, "get_matches") as mock_get_matches:
        with patch.object(
            match_repository.EquifaxMatchRepository, "_get_table_obj"
        ) as mock_get_tbl:
            mock_get_tbl.return_value = Table
            mock_get_matches.return_value = [*equifax_businesses]

            yield mock_get_matches


@pytest.fixture
def mock_zoominfo_repository(zoominfo_businesses):
    with patch.object(match_repository.ZoomInfoMatchRepository, "get_matches") as mock_get_matches:
        with patch.object(
            match_repository.ZoomInfoMatchRepository, "_get_table_obj"
        ) as mock_get_tbl:
            mock_get_tbl.return_value = Table
            mock_get_matches.return_value = [*zoominfo_businesses]

            yield mock_get_matches


@pytest.fixture
def mock_open_corporate_repository(open_corporate_businesses):
    with patch.object(
        match_repository.OpenCorporateMatchRepository, "get_matches"
    ) as mock_get_matches:
        with patch.object(
            match_repository.OpenCorporateMatchRepository, "_get_table_obj"
        ) as mock_get_tbl:
            mock_get_tbl.return_value = Table
            mock_get_matches.return_value = [*open_corporate_businesses]

            yield mock_get_matches


@pytest.fixture
def seed_request():
    with sessions.TransactionalSessions.get_session() as session:
        match_request = MatchRequestDb(
            match_id="test_id",
            status="pending",
            business_id="business_id",
            names=["name1", "name2"],
            addresses=[
                {
                    "address": "123 Main St",
                    "city": "Los Angeles",
                    "state": "CA",
                    "zip": "12345",
                    "country": "US",
                }
            ],
        )
        session.add(match_request)
        session.commit()

        yield match_request.match_id


@pytest.fixture
def seed_request_ca():
    with sessions.TransactionalSessions.get_session() as session:
        match_request = MatchRequestDb(
            match_id="test_id",
            status="pending",
            business_id="business_id",
            names=["name1", "name2"],
            addresses=[
                {
                    "address": "123 Main St",
                    "city": "Toronto",
                    "state": "Ontario",
                    "zip": "A1B 2C3",
                    "country": "CA",
                }
            ],
        )
        session.add(match_request)
        session.commit()

        yield match_request.match_id


@pytest.fixture
def seed_request_uk():
    with sessions.TransactionalSessions.get_session() as session:
        match_request = MatchRequestDb(
            match_id="test_id",
            status="pending",
            business_id="business_id",
            names=["name1", "name2"],
            addresses=[
                {
                    "address": "123 High St",
                    "city": "London",
                    "state": "England",
                    "zip": "SW1A 1AA",
                    "country": "GB",
                }
            ],
        )
        session.add(match_request)
        session.commit()

        yield match_request.match_id


@pytest.fixture
def start_matching_request() -> MatchRequest:
    return MatchRequest(
        business_id="business_id",
        names=["Worth Business 0", "Worth Business 1"],
        addresses=[
            businesses.BusinessAddress(
                address="0 Main St", city="Los Angeles", state="CA", zip="12340", country="US"
            ),
            businesses.BusinessAddress(
                address="1 Main St", city="Los Angeles", state="CA", zip="12341", country="US"
            ),
        ],
    )


@pytest.fixture(scope="session")
def api_client() -> TestClient:
    """
    Create a FastAPI test client for integration tests.
    """
    from datapooler.web.app import app

    return TestClient(app)


# Firmographics test fixtures
@pytest.fixture
def mock_firmographics_data():
    """Mock firmographics data for testing."""
    return firmographics.Firmographics(
        {
            "equifax_us_raw": [
                {
                    "efx_id": "12345",
                    "efx_eng_companyname": "Test Company",
                    "efx_eng_address": "123 Test St",
                    "efx_eng_city": "Test City",
                    "efx_eng_state": "CA",
                    "efx_eng_zipcode": "12345",
                    "efx_eng_country": "US",
                    "employee_count": 100,
                    "annual_revenue": 5000000,
                }
            ],
            "equifax_bma_raw": [
                {
                    "efx_id": "12345",
                    "credit_score": 720,
                    "payment_behavior": "Excellent",
                }
            ],
        }
    )


@pytest.fixture(
    params=[
        (
            "equifax",
            "equifax_businesses",
            {
                "equifax_us_raw": [
                    {
                        "efx_id": "12345",
                        "efx_eng_companyname": "Equifax Test Company",
                        "efx_eng_address": "123 Equifax St",
                        "efx_eng_city": "Atlanta",
                        "efx_eng_state": "GA",
                        "efx_eng_zipcode": "30309",
                        "employee_count": 250,
                        "annual_revenue": 15000000,
                    }
                ],
                "equifax_bma_raw": [
                    {
                        "efx_id": "12345",
                        "credit_score": 750,
                        "payment_behavior": "Excellent",
                        "risk_rating": "Low",
                    }
                ],
            },
        ),
        (
            "zoominfo",
            "zoominfo_businesses",
            {
                "comp_standard_global": [
                    {
                        "zi_c_company_id": "zi123",
                        "zi_eng_companyname": "ZoomInfo Test Company",
                        "zi_eng_address": "456 ZoomInfo Ave",
                        "zi_eng_city": "Waltham",
                        "zi_eng_state": "MA",
                        "zi_eng_zipcode": "02451",
                        "employees": 500,
                        "revenue": 25000000,
                        "industry": "Technology",
                    }
                ]
            },
        ),
        (
            "open_corporate",
            "open_corporate_businesses",
            {
                "companies": [
                    {
                        "company_number": "oc123",
                        "name": "OpenCorp Test Company",
                        "company_type": "Private Limited Company",
                        "jurisdiction_code": "gb",
                        "incorporation_date": "2015-01-15",
                        "current_status": "Active",
                    }
                ],
                "officers": [
                    {
                        "company_number": "oc123",
                        "name": "John Doe",
                        "position": "Director",
                        "start_date": "2015-01-15",
                    }
                ],
                "additional_identifiers": [
                    {
                        "company_number": "oc123",
                        "identifier": "VAT123456789",
                        "identifier_type": "vat_number",
                    }
                ],
            },
        ),
        (
            "canada_open",
            "canada_open_businesses",
            {
                "ca_open_businesses": [
                    {
                        "id": "ca123",
                        "business_number": "123456789BC0001",
                        "current_name": "Canada Test Company",
                        "canonized_name": "CANADA TEST COMPANY",
                        "city": "Vancouver",
                        "region": "BC",
                        "postal_code": "V6B 1A1",
                        "country": "CA",
                        "status": "Active",
                    }
                ]
            },
        ),
    ]
)
def integration_test_data(request):
    """Parameterized fixture for integration test data."""
    integration, business_fixture, firmographics_data = request.param
    return {
        "integration": integration,
        "business_fixture": business_fixture,
        "firmographics_data": firmographics.Firmographics(firmographics_data),
    }


@pytest.fixture
def simple_firmographics_service(
    equifax_businesses, mock_redshift_repositories, mock_kafka_messaging
):
    """Create a simple FirmographicsService for basic tests."""
    business = equifax_businesses[0]
    business_id = "test_business_123"

    service = FirmographicsService(
        business_id=business_id, businesses=[business], integration="equifax"
    )
    return service, business_id, business
