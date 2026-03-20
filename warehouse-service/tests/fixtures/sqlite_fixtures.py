"""SQLite-based fixtures for repository testing with real test data."""

from unittest.mock import PropertyMock, patch

import pytest
from sqlalchemy import Column, Float, MetaData, String, Table, create_engine, insert
from sqlalchemy.orm import sessionmaker


@pytest.fixture(scope="session")
def sqlite_engine():
    """Create an in-memory SQLite engine for testing."""
    engine = create_engine("sqlite:///:memory:", echo=True)
    return engine


@pytest.fixture(autouse=True, scope="session")
def replace_redshift_warehouse_with_sqlite(sqlite_engine):
    """Patch only the `warehouse` attribute of Engines to return SQLite."""
    with patch(
        "datapooler.adapters.engines.Engines.warehouse", new_callable=PropertyMock
    ) as mock_warehouse:
        mock_warehouse.return_value = sqlite_engine
        yield


@pytest.fixture(scope="session", autouse=True)
def sqlite_sessions(sqlite_engine):
    """Patch WarehouseSessions to use SQLite engine."""
    with patch(
        "datapooler.adapters.sessions.WarehouseSessions.sessions",
        new=PropertyMock(return_value=sessionmaker(sqlite_engine, expire_on_commit=False)),
    ):
        yield


@pytest.fixture(scope="session", autouse=True)
def equifax_table(sqlite_engine):
    """Create Equifax table with test data."""
    metadata = MetaData()
    table = Table(
        "equifax_us_standardized",
        metadata,
        Column("efx_id", String),
        Column("efx_eng_companyname", String),
        Column("efx_eng_address", String),
        Column("efx_eng_city", String),
        Column("efx_eng_state", String),
        Column("efx_eng_zipcode", String),
        Column("efx_state", String),
        Column("efx_name", String),
        Column("efx_legal_name", String),
        Column("efx_contct", String),
        Column("efx_ceoname", String),
    )
    metadata.create_all(sqlite_engine)

    # Insert test data
    test_data = [
        {
            "efx_id": "EFX0",
            "efx_eng_companyname": "ACME CORPORATION",
            "efx_eng_address": "123 MAIN STREET",
            "efx_eng_city": "LOS ANGELES",
            "efx_eng_state": "CA",
            "efx_eng_zipcode": "12345",
            "efx_state": "CA",
            "efx_name": "ACME CORP",
            "efx_legal_name": "ACME CORPORATION",
            "efx_contct": "555-1234",
            "efx_ceoname": "John Smith",
        },
        {
            "efx_id": "EFX1",
            "efx_eng_companyname": "BETA LIMITED LIABILITY COMPANY",
            "efx_eng_address": "456 OAK AVENUE",
            "efx_eng_city": "NEW YORK",
            "efx_eng_state": "NY",
            "efx_eng_zipcode": "10001",
            "efx_state": "NY",
            "efx_name": "BETA LLC",
            "efx_legal_name": "BETA LIMITED LIABILITY COMPANY",
            "efx_contct": "555-5678",
            "efx_ceoname": "Jane Doe",
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


@pytest.fixture(scope="session", autouse=True)
def open_corporate_table(sqlite_engine):
    """Create OpenCorporate table with test data."""
    metadata = MetaData()
    table = Table(
        "open_corporate_entities_standardized",
        metadata,
        Column("company_number", String),
        Column("name", String),
        Column("normalised_name", String),
        Column("alternative_name", String),
        Column("region", String),
        Column("postal_code", String),
        Column("country_code", String),
        Column("zipcode_threedigits", String),
        Column("street_address_normalized", String),
        Column("dba_normalized", String),
        Column("locality", String),
        Column("jurisdiction_code", String),  # Another missing column
    )
    metadata.create_all(sqlite_engine)

    # Insert test data
    test_data = [
        {
            "company_number": "OPC0",
            "name": "ACME CORPORATION",
            "normalised_name": "ACME CORPORATION",
            "alternative_name": "ACME CORP",
            "region": "CA",
            "postal_code": "12340",
            "country_code": "US",
            "zipcode_threedigits": "123",
            "street_address_normalized": "123 MAIN ST",
            "dba_normalized": "ACME CORP",
            "locality": "LOS ANGELES",
            "jurisdiction_code": "US-NY",
        },
        {
            "company_number": "OPC1",
            "name": "BETA LIMITED",
            "normalised_name": "BETA LIMITED",
            "alternative_name": "BETA LTD",
            "region": "CA",
            "postal_code": "12341",
            "country_code": "US",
            "zipcode_threedigits": "123",
            "street_address_normalized": "456 OAK AVE",
            "dba_normalized": "BETA LLC",
            "locality": "LOS ANGELES",
            "jurisdiction_code": "US-NY",
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


@pytest.fixture(scope="session", autouse=True)
def zoominfo_table(sqlite_engine):
    """Create ZoomInfo table with test data."""
    metadata = MetaData()
    table = Table(
        "zoominfo_companies_standardized",
        metadata,
        Column("zi_c_company_id", String),
        Column("zi_c_location_id", String),
        Column("zi_es_location_id", String),
        Column("zi_eng_companyname", String),
        Column("zi_eng_state", String),
        Column("zi_eng_zipcode_threedigits", String),
        Column("country_code", String),
        Column("zi_eng_dba", String),
        Column("zi_eng_dba2", String),
        Column("zi_location_id", String),  # Fixed column name to match repository
        Column("zi_es_location_id", String),
        Column("zi_eng_address", String),  # Added missing column
        Column("zi_eng_city", String),  # Added missing column
        Column("zi_eng_zipcode", String),  # Added missing column
    )
    metadata.create_all(sqlite_engine)

    # Insert test data
    test_data = [
        {
            "zi_c_company_id": "ZB0",
            "zi_location_id": "LOC0",
            "zi_es_location_id": "ESLOC0",
            "zi_eng_companyname": "ACME TECHNOLOGIES",
            "zi_eng_address": "123 TECH STREET",
            "zi_eng_city": "SAN FRANCISCO",
            "zi_eng_state": "CA",
            "zi_eng_zipcode": "94105",
            "zi_eng_zipcode_threedigits": "941",
            "country_code": "US",
            "zi_eng_dba": "ACME TECH",
            "zi_eng_dba2": "ACME TECHNOLOGIES INC",
        },
        {
            "zi_c_company_id": "ZB1",
            "zi_location_id": "LOC1",  # Fixed column name
            "zi_es_location_id": "ESLOC1",
            "zi_eng_companyname": "BETA SOLUTIONS",
            "zi_eng_address": "456 BUSINESS AVE",
            "zi_eng_city": "NEW YORK",
            "zi_eng_state": "NY",
            "zi_eng_zipcode": "10001",
            "zi_eng_zipcode_threedigits": "100",
            "country_code": "US",
            "zi_eng_dba": "BETA SOLUTIONS",
            "zi_eng_dba2": "BETA SOLUTIONS LLC",
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


@pytest.fixture(scope="session", autouse=True)
def canada_open_table(sqlite_engine):
    """Create Canada Open table with test data."""
    metadata = MetaData()
    table = Table(
        "ca_open_businesses_standardized",
        metadata,
        Column("id", String),
        Column("business_number", String),
        Column("name", String),
        Column("current_name", String),
        Column("canonized_name", String),
        Column("sanitized_name", String),
        Column("business_number", String),
        Column("other_names", String),  # Added missing column
        Column("normalized_address", String),  # Added missing column
        Column("other_addresses", String),  # Added missing column
        Column("city", String),  # Added missing column
        Column("country", String),  # Added missing column
        Column("province", String),
        Column("region", String),
        Column("postal_code", String),
    )
    metadata.create_all(sqlite_engine)

    # Insert test data
    test_data = [
        {
            "id": "1",
            "name": "ACME CORP CANADA",
            "current_name": "ACME CORP CANADA",
            "canonized_name": "ACME CORP CANADA",
            "sanitized_name": "ACME CORP CANADA",
            "business_number": "BN123456789",
            "other_names": "ACME CORPORATION CANADA",
            "normalized_address": "123 MAIN ST",
            "other_addresses": "123 MAIN STREET",
            "city": "TORONTO",
            "country": "CA",
            "province": "ON",
            "region": "ON",
            "postal_code": "M5H2N2",
        },
        {
            "id": "2",
            "name": "BETA LLC CANADA",
            "current_name": "BETA LLC CANADA",
            "canonized_name": "BETA LLC CANADA",
            "sanitized_name": "BETA LLC CANADA",
            "business_number": "BN987654321",
            "other_names": "BETA LIMITED LIABILITY COMPANY",
            "normalized_address": "456 BUSINESS AVE",
            "other_addresses": "456 BUSINESS AVENUE",
            "city": "VANCOUVER",
            "country": "CA",
            "province": "BC",
            "region": "BC",
            "postal_code": "V6B1A1",
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


# Firmographic tables for get_firmographics testing
@pytest.fixture(scope="session", autouse=True)
def equifax_us_raw_table(sqlite_engine):
    """Create Equifax US raw firmographics table with test data."""
    metadata = MetaData()
    table = Table(
        "equifax_us_raw",
        metadata,
        Column("efx_id", String),
        Column("revenue", String),
        Column("employees", String),
        Column("industry", String),
        Column("sic_code", String),
        Column("year_founded", String),
        Column("yr", String),  # Required for firmographics ranking
        Column("mon", String),  # Required for firmographics ranking
    )
    metadata.create_all(sqlite_engine)

    # Insert test data
    test_data = [
        {
            "efx_id": "EFX0",
            "revenue": "1000000",
            "employees": "50",
            "industry": "Technology",
            "sic_code": "7372",
            "year_founded": "2010",
            "yr": "2024",
            "mon": "12",
        },
        {
            "efx_id": "EFX1",
            "revenue": "5000000",
            "employees": "200",
            "industry": "Consulting",
            "sic_code": "8742",
            "year_founded": "2005",
            "yr": "2024",
            "mon": "11",
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


@pytest.fixture(scope="session", autouse=True)
def equifax_bma_raw_table(sqlite_engine):
    """Create Equifax BMA raw firmographics table with test data."""
    metadata = MetaData()
    table = Table(
        "equifax_bma_raw",
        metadata,
        Column("efx_id", String),
        Column("business_type", String),
        Column("credit_score", String),
        Column("payment_behavior", String),
        Column("trade_lines", String),
        Column("yr", String),  # Required for firmographics ranking
        Column("mon", String),  # Required for firmographics ranking
    )
    metadata.create_all(sqlite_engine)

    # Insert test data
    test_data = [
        {
            "efx_id": "EFX0",
            "business_type": "LLC",
            "credit_score": "750",
            "payment_behavior": "Prompt",
            "trade_lines": "15",
            "yr": "2024",
            "mon": "12",
        },
        {
            "efx_id": "EFX1",
            "business_type": "Corporation",
            "credit_score": "680",
            "payment_behavior": "Slow",
            "trade_lines": "22",
            "yr": "2024",
            "mon": "11",
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


@pytest.fixture(scope="session", autouse=True)
def comp_standard_global_table(sqlite_engine):
    """Create ZoomInfo comp_standard_global firmographics table with test data."""
    metadata = MetaData()
    table = Table(
        "comp_standard_global",
        metadata,
        Column("zi_c_company_id", String),
        Column("zi_c_location_id", String),
        Column("zi_es_location_id", String),
        Column("annual_revenue", String),
        Column("employee_count", String),
        Column("industry_sector", String),
        Column("sub_industry", String),
        Column("stock_ticker", String),
    )
    metadata.create_all(sqlite_engine)

    # Insert test data
    test_data = [
        {
            "zi_c_company_id": "ZB0",
            "zi_c_location_id": "LOC0",
            "zi_es_location_id": "ESLOC0",
            "annual_revenue": "2000000",
            "employee_count": "75",
            "industry_sector": "Software",
            "sub_industry": "Enterprise Software",
            "stock_ticker": None,
        },
        {
            "zi_c_company_id": "ZB1",
            "zi_c_location_id": "LOC1",
            "zi_es_location_id": "ESLOC1",
            "annual_revenue": "8000000",
            "employee_count": "300",
            "industry_sector": "Professional Services",
            "sub_industry": "Management Consulting",
            "stock_ticker": None,
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


@pytest.fixture(scope="session", autouse=True)
def ca_open_businesses_table(sqlite_engine):
    """Create Canada Open businesses firmographics table with test data."""
    metadata = MetaData()
    table = Table(
        "ca_open_businesses",
        metadata,
        Column("id", String),  # Added missing id column
        Column("corporate_id", String),
        Column("business_number", String),
        Column("status", String),
        Column("registration_date", String),
        Column("business_type", String),
    )
    metadata.create_all(sqlite_engine)

    # Insert test data
    test_data = [
        {
            "id": "CA0",
            "corporate_id": "CA0",
            "business_number": "BN000000",
            "status": "Active",
            "registration_date": "2015-03-15",
            "business_type": "Corporation",
        },
        {
            "id": "CA1",  # Added id value
            "corporate_id": "CA1",
            "business_number": "BN000001",
            "status": "Active",
            "registration_date": "2018-07-22",
            "business_type": "LLC",
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


# OpenCorporate firmographic tables
@pytest.fixture(scope="session", autouse=True)
def additional_identifiers_table(sqlite_engine):
    """Create OpenCorporate additional_identifiers table."""
    metadata = MetaData()
    table = Table(
        "additional_identifiers",
        metadata,
        Column("company_number", String),
        Column("identifier_type", String),
        Column("identifier_value", String),
        Column("jurisdiction_code", String),
    )
    metadata.create_all(sqlite_engine)

    test_data = [
        {
            "company_number": "OPC0",
            "identifier_type": "EIN",
            "identifier_value": "12-3456789",
            "jurisdiction_code": "US-NY",
        },
        {
            "company_number": "OPC1",
            "identifier_type": "DUNS",
            "identifier_value": "123456789",
            "jurisdiction_code": "US-NY",
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


@pytest.fixture(scope="session", autouse=True)
def alternative_names_table(sqlite_engine):
    """Create OpenCorporate alternative_names table."""
    metadata = MetaData()
    table = Table(
        "alternative_names",
        metadata,
        Column("company_number", String),
        Column("company_name", String),
        Column("language", String),
        Column("type", String),
        Column("jurisdiction_code", String),  # Added missing column
    )
    metadata.create_all(sqlite_engine)

    test_data = [
        {
            "company_number": "OPC0",
            "company_name": "ACME CORPORATION",
            "language": "en",
            "type": "trading",
            "jurisdiction_code": "US-NY",
        },
        {
            "company_number": "OPC1",
            "company_name": "BETA LIMITED",
            "language": "en",
            "type": "legal",
            "jurisdiction_code": "US-NY",
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


@pytest.fixture(scope="session", autouse=True)
def companies_table(sqlite_engine):
    """Create OpenCorporate companies firmographics table."""
    metadata = MetaData()
    table = Table(
        "companies",
        metadata,
        Column("company_number", String),
        Column("incorporation_date", String),
        Column("company_type", String),
        Column("status", String),
        Column("agent_name", String),
        Column("jurisdiction_code", String),
        Column("home_jurisdiction_code", String),
        Column("home_jurisdiction_company_number", String),
    )
    metadata.create_all(sqlite_engine)

    test_data = [
        {
            "company_number": "OPC0",
            "incorporation_date": "2010-05-15",
            "company_type": "LLC",
            "status": "Active",
            "agent_name": "Corporate Services Inc",
            "jurisdiction_code": "US-NY",  # Added jurisdiction code
            "home_jurisdiction_code": "US-CA",
            "home_jurisdiction_company_number": "OPCHOME0",
        },
        {
            "company_number": "OPC1",
            "incorporation_date": "2008-11-03",
            "company_type": "Corporation",
            "status": "Active",
            "agent_name": "Business Solutions LLC",
            "jurisdiction_code": "US-NY",  # Added jurisdiction code
            "home_jurisdiction_code": "",
            "home_jurisdiction_company_number": "",
        },
        {
            "company_number": "OPCHOME0",
            "incorporation_date": "2000-01-01",
            "company_type": "Corporation",
            "status": "Active",
            "agent_name": "Home Jurisdiction Inc",
            "jurisdiction_code": "US-CA",  # Added jurisdiction code
            "home_jurisdiction_code": "",
            "home_jurisdiction_company_number": "",
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


@pytest.fixture(scope="session", autouse=True)
def non_reg_addresses_table(sqlite_engine):
    """Create OpenCorporate non_reg_addresses table."""
    metadata = MetaData()
    table = Table(
        "non_reg_addresses",
        metadata,
        Column("company_number", String),
        Column("jurisdiction_code", String),
        Column("address_type", String),
        Column("address", String),
        Column("locality", String),
        Column("region", String),
        Column("postal_code", String),
        Column("country", String),
    )
    metadata.create_all(sqlite_engine)

    test_data = [
        {
            "company_number": "OPC0",
            "jurisdiction_code": "US-NY",
            "address_type": "business",
            "address": "123 MAIN ST",
            "locality": "LOS ANGELES",
            "region": "CA",
            "postal_code": "12345",
            "country": "US",
        },
        {
            "company_number": "OPC1",
            "jurisdiction_code": "US-NY",
            "address_type": "mailing",
            "address": "456 OAK AVE",
            "locality": "NEW YORK",
            "region": "NY",
            "postal_code": "10001",
            "country": "US",
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


@pytest.fixture(scope="session", autouse=True)
def officers_table(sqlite_engine):
    """Create OpenCorporate officers table."""
    metadata = MetaData()
    table = Table(
        "officers",
        metadata,
        Column("company_number", String),
        Column("jurisdiction_code", String),
        Column("name", String),
        Column("position", String),
        Column("start_date", String),
        Column("end_date", String),
    )
    metadata.create_all(sqlite_engine)

    test_data = [
        {
            "company_number": "OPC0",
            "jurisdiction_code": "US-NY",
            "name": "JOHN SMITH",
            "position": "CEO",
            "start_date": "2010-05-15",
            "end_date": None,
        },
        {
            "company_number": "OPC0",
            "jurisdiction_code": "US-NY",
            "name": "JANE DOE",
            "position": "CFO",
            "start_date": "2012-01-01",
            "end_date": None,
        },
        {
            "company_number": "OPC1",
            "jurisdiction_code": "US-NY",
            "name": "ROBERT JOHNSON",
            "position": "President",
            "start_date": "2008-11-03",
            "end_date": None,
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


# NPI table for healthcare provider matching
@pytest.fixture(scope="session", autouse=True)
def npi_registry_table(sqlite_engine):
    """Create NPI registry table with test data."""
    metadata = MetaData()
    table = Table(
        "records",
        metadata,
        Column("npi", String),
        Column("entity type code", String),
        Column("replacement npi", String),
        Column("ein", String),
        Column("provider organization name", String),
        Column("provider last name", String),
        Column("provider first name", String),
        Column("provider middle name", String),
        Column("provider name prefix text", String),
        Column("provider name suffix text", String),
        Column("provider credential text", String),
        Column("provider other organization name", String),
        Column("provider other organization name type code", String),
        Column("provider other last name", String),
        Column("provider other first name", String),
        Column("provider other middle name", String),
        Column("provider other name prefix text", String),
        Column("provider other name suffix text", String),
        Column("provider other credential text", String),
        Column("provider other last name type code", String),
        Column("provider first line business mailing address", String),
        Column("provider second line business mailing address", String),
        Column("provider business mailing address city name", String),
        Column("provider business mailing address state name", String),
        Column("provider business mailing address postal code", String),
        Column("provider business mailing address country code if outside us", String),
        Column("provider business mailing address telephone number", String),
        Column("provider business mailing address fax number", String),
        Column("provider first line business practice location address", String),
        Column("provider second line business practice location address", String),
        Column("provider business practice location address city name", String),
        Column("provider business practice location address state name", String),
        Column("provider business practice location address postal code", String),
        Column(
            "provider business practice location address country code (if outside u.s.)", String
        ),
        Column("provider business practice location address telephone number", String),
        Column("provider business practice location address fax number", String),
        Column("provider enumeration date", String),
        Column("last update date", String),
        Column("npi deactivation reason code", String),
        Column("npi deactivation date", String),
        Column("npi reactivation date", String),
        Column("provider gender code", String),
        Column("authorized official last name", String),
        Column("authorized official first name", String),
        Column("authorized official middle name", String),
        Column("authorized official title or position", String),
        Column("authorized official telephone number", String),
        Column("healthcare provider taxonomy code 1", String),
        Column("provider license number", String),
        Column("provider license number 1", String),
        Column("provider license number state code 1", String),
        Column("healthcare provider primary taxonomy switch 1", String),
        Column("provider organization name (legal business name)", String),
        Column("provider last name (legal name)", String),
        Column("provider business practice location address address_1", String),
    )
    metadata.create_all(sqlite_engine)

    # Insert test NPI data
    test_data = [
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
        },
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


@pytest.fixture(scope="session", autouse=True)
def worth_score_audit_table(sqlite_engine):
    """Create Worth Score Audit table with test data."""
    metadata = MetaData()
    table = Table(
        "worth_score_input_audit",
        metadata,
        Column("score_date", String),
        Column("fill_field1", Float),
        Column("fill_field2", Float),
        Column("fill_field3", Float),
        Column("fill_field4", Float),
        Column("fill_field5", Float),
        Column("fill_field6", Float),
        Column("fill_field7", Float),
        Column("fill_field8", Float),
        Column("fill_field9", Float),
        Column("fill_field10", Float),
        Column("fill_field11", Float),
        Column("fill_field12", Float),
        Column("fill_field13", Float),
        Column("fill_field14", Float),
        Column("fill_field15", Float),
        Column("fill_field16", Float),
        Column("fill_field17", Float),
        Column("fill_field18", Float),
        Column("fill_field19", Float),
        Column("fill_field20", Float),
        Column("fill_field21", Float),
    )
    metadata.create_all(sqlite_engine)

    # Insert test NPI data
    test_data = [
        {
            "score_date": "2024-01-01",
            "fill_field1": 0.5,
            "fill_field2": 0.6,
            "fill_field3": 0.7,
            "fill_field4": 0.8,
            "fill_field5": 0.9,
            "fill_field6": 1.0,
            "fill_field7": 1.1,
            "fill_field8": 1.2,
            "fill_field9": 1.3,
            "fill_field10": 1.4,
            "fill_field11": 1.5,
            "fill_field12": 1.6,
            "fill_field13": 1.7,
            "fill_field14": 1.8,
            "fill_field15": 1.9,
            "fill_field16": 2.0,
            "fill_field17": 2.1,
            "fill_field18": 2.2,
            "fill_field19": 2.3,
            "fill_field20": 2.4,
            "fill_field21": 2.5,
        }
    ]

    with sqlite_engine.begin() as conn:
        conn.execute(insert(table), test_data)

    return table


@pytest.fixture(scope="session")
def sql_compiler(sqlite_engine):
    """Helper to compile SQLAlchemy queries to SQL strings."""

    def compile_query(query):
        compiled = query.compile(sqlite_engine, compile_kwargs={"literal_binds": True})
        return str(compiled)

    return compile_query


@pytest.fixture(scope="session")
def sqlite_table_registry(
    sqlite_engine,
    equifax_table,
    open_corporate_table,
    zoominfo_table,
    canada_open_table,
    equifax_us_raw_table,
    equifax_bma_raw_table,
    comp_standard_global_table,
    ca_open_businesses_table,
    additional_identifiers_table,
    alternative_names_table,
    companies_table,
    non_reg_addresses_table,
    officers_table,
    npi_registry_table,
):
    """Registry of all SQLite tables by schema and table name."""
    return {
        # Main matching tables
        ("warehouse", "equifax_us_standardized"): equifax_table,
        ("datascience", "open_corporates_standard"): open_corporate_table,
        ("datascience", "zoominfo_standard"): zoominfo_table,
        ("warehouse", "ca_open_businesses_standardized"): canada_open_table,
        # Firmographic tables
        ("warehouse", "equifax_us_raw"): equifax_us_raw_table,
        ("warehouse", "equifax_bma_raw"): equifax_bma_raw_table,
        ("zoominfo", "comp_standard_global"): comp_standard_global_table,
        ("warehouse", "ca_open_businesses"): ca_open_businesses_table,
        ("open_corporate", "additional_identifiers"): additional_identifiers_table,
        ("open_corporate", "alternative_names"): alternative_names_table,
        ("open_corporate", "companies"): companies_table,
        ("open_corporate", "non_reg_addresses"): non_reg_addresses_table,
        ("open_corporate", "officers"): officers_table,
        # NPI table
        ("npi", "records"): npi_registry_table,
        # Score audit table
        ("warehouse", "worth_score_input_audit"): worth_score_audit_table,
    }


@pytest.fixture(autouse=True)
def replace_redshift_with_sqlite(sqlite_engine, sqlite_table_registry):
    """Replace Redshift engine and tables with SQLite for all repository tests."""

    # Mock WarehouseTables.get_table() to return our SQLite tables
    def mock_get_table(schema_name, table_name):
        table_key = (schema_name, table_name)
        if table_key in sqlite_table_registry:
            return sqlite_table_registry[table_key]
        # If table not found, create a minimal one or raise an error
        raise ValueError(f"Table {schema_name}.{table_name} not found in test registry")

    warehouse_tables_path = (
        "datapooler.adapters.redshift.repository.match_repository.WarehouseTables.get_table"
    )
    with patch("datapooler.adapters.engines.Engines.warehouse", sqlite_engine), patch(
        warehouse_tables_path, side_effect=mock_get_table
    ):
        yield
