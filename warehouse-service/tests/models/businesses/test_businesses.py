import pytest

from datapooler.models.businesses import (
    CanadaOpenBusiness,
    ComparisonBusiness,
    EquifaxBusiness,
    ExtraInfo,
    NPIBusiness,
    OpenCorporateBusiness,
    SimpleComparisonBusiness,
    WorthBusiness,
    WorthBusinessList,
    ZoomInfoBusiness,
)


def test_worth_business_validation():
    business = WorthBusiness(
        business_id="123",
        name="Some Business LLC",
        address="123 Main St",
        state="California",
        zip="12345",
        city="Los Angeles",
        country="US",
        extra=ExtraInfo(first_name=" John ", last_name=" Doe "),
    )
    assert business.name == "SOME BUSINESS LLC"
    assert business.canonical_name == "SOME BUSINESS"
    assert business.normalized_zip == "12345"
    assert business.state_code == "CA"
    assert business.normalized_address == "123 MAIN STREET"
    assert business.zip3 == "123"
    assert business.street_number == 123
    assert business.street_name == "MAIN ST"
    assert business.short_name == "SOMEBUSINESS"
    assert business.extra.first_name == "JOHN"
    assert business.extra.last_name == "DOE"


def test_worth_business_canadian_validation():
    business = WorthBusiness(
        business_id="123",
        name="Some Business LLC",
        address="123 Main St",
        state="British Columbia",
        zip="A0A 0A0",
        city="Vancouver",
        country="CA",
    )
    assert business.name == "SOME BUSINESS LLC"
    assert business.canonical_name == "SOME BUSINESS"
    assert business.normalized_zip == "A0A0A0"
    assert business.state_code == "BC"
    assert business.normalized_address == "123 MAIN STREET"
    assert business.zip3 == "A0A"
    assert business.street_number == 123
    assert business.street_name == "MAIN ST"
    assert business.short_name == "SOMEBUSINESS"


def test_worth_business_uk_validation():
    business = WorthBusiness(
        business_id="123",
        name="Some UK Business",
        address="10 Downing St",
        state="SOUTH WEST LONDON",
        zip="SW1A 2AA",
        city="London",
        country="GB",
    )
    assert business.name == "SOME UK BUSINESS"
    assert business.canonical_name == "SOME UK BUSINESS"
    assert business.normalized_zip == "SW1A2AA"
    assert business.state_code == "SW"
    assert business.normalized_address == "10 DOWNING STREET"
    assert business.zip3 == "SW1"
    assert business.street_number == 10
    assert business.street_name == "DOWNING ST"
    assert business.short_name == "SOMEUKBUSINESS"


def test_worth_business_ireland_validation():
    business = WorthBusiness(
        business_id="123",
        name="Some Irish Business",
        address="123 O'Connell St",
        state="Dublin",
        zip="D01 F5P2",
        city="Dublin",
        country="IRELAND",
    )
    assert business.name == "SOME IRISH BUSINESS"
    assert business.canonical_name == "SOME IRISH BUSINESS"
    assert business.normalized_zip == "D01F5P2"
    assert business.state_code == "D01"
    assert business.normalized_address == "123 O'CONNELL STREET"
    assert business.zip3 == "D01"
    assert business.street_number == 123
    assert business.street_name == "O'CONNELL ST"
    assert business.short_name == "SOMEIRISHBUSINESS"
    assert business.country_code == "IE"


def test_worth_business_from_request(start_matching_request):
    businesses = WorthBusiness.from_request(start_matching_request.model_dump())

    assert len(businesses) == 4


def test_equifax_business_attributes():
    business = EquifaxBusiness(
        company_uuid="456",
        efx_id="EFX123",
        name="Equifax Business",
        legal_name="Equifax Legal Name",
        address="456 Elm St",
        city="San Francisco",
        state="CA",
        zip="94107-1102",
        contct="John Doe",
        ceoname="Jane Doe",
    )
    assert business.name == "EQUIFAX BUSINESS"
    assert business.canonical_name == "EQUIFAX BUSINESS"
    assert business.state_code == "CA"
    assert business.zip3 == "941"
    assert business.zip == "94107-1102"
    assert business.normalized_zip == "94107"
    assert business.street_number == 456
    assert business.street_name == "ELM ST"
    assert business.short_name == "EQUIFAXBUSINESS"


def test_equifax_business_aliases():
    business = EquifaxBusiness(
        company_uuid="456",
        efx_id="EFX123",
        efx_eng_companyname="Equifax Business",
        efx_legal_name="Equifax Legal Name",
        efx_eng_address="456 Elm St",
        efx_eng_city="San Francisco",
        efx_eng_state="CA",
        efx_eng_zipcode="94107",
        efx_contct="John Doe",
        efx_ceoname="Jane Doe",
        efx_eng_country="US",
    )
    assert business.name == "EQUIFAX BUSINESS"
    assert business.state_code == "CA"
    assert business.zip3 == "941"


def test_zoominfo_business_attributes():
    business = ZoomInfoBusiness(
        company_id="789",
        location_id="LOC789",
        es_location_id="ESLOC789",
        country_code="US",
        name="ZoomInfo Corp",
        address="789 Oak St",
        address_2="Suite 100",
        city="Seattle",
        state="WA",
        zip="98101",
    )
    assert business.name == "ZOOMINFO CORP"
    assert business.canonical_name == "ZOOMINFO"
    assert business.normalized_address == "789 OAK STREET"
    assert business.state_code == "WA"
    assert business.zip3 == "981"
    assert business.street_number == 789
    assert business.street_name == "OAK ST"
    assert business.short_name == "ZOOMINFO"


def test_zoominfo_business_aliases():
    business = ZoomInfoBusiness(
        zi_c_company_id="789",
        zi_c_location_id="LOC789",
        zi_es_location_id="ESLOC789",
        zi_eng_companyname="ZoomInfo Corp",
        zi_eng_address="789 Oak St",
        zi_eng_dba="Suite 100",
        zi_eng_city="Seattle",
        zi_eng_state="WA",
        zi_eng_zipcode="98101",
        zi_eng_country="US",
    )
    assert business.name == "ZOOMINFO CORP"
    assert business.canonical_name == "ZOOMINFO"
    assert business.normalized_address == "789 OAK STREET"
    assert business.state_code == "WA"


def test_opencorporate_business_attributes():
    business = OpenCorporateBusiness(
        company_uuid="101112",
        company_number="OPC101112",
        name="Open Corporate Inc",
        name_2="Open Co",
        address="101 Pine St",
        address_2="Floor 5",
        city="New York",
        state="NY",
        zip="10001",
        jurisdiction_code="US-NY",
    )
    assert business.name == "OPEN CORPORATE INC"
    assert business.canonical_name == "OPEN CORPORATE"
    assert business.state_code == "NY"
    assert business.normalized_address == "101 PINE STREET"
    assert business.zip3 == "100"
    assert business.street_number == 101
    assert business.street_name == "PINE ST"
    assert business.short_name == "OPENCORPORATE"


def test_opencorporate_business_aliases():
    business = OpenCorporateBusiness(
        company_uuid="101112",
        company_number="OPC101112",
        normalised_name="Open Corporate Inc",
        alternative_name="Open Co",
        street_address_normalized="101 Pine St",
        dba_normalized="Floor 5",
        locality="New York",
        region="NY",
        postal_code="10001",
        jurisdiction_code="US-NY",
    )
    assert business.name == "OPEN CORPORATE INC"
    assert business.canonical_name == "OPEN CORPORATE"
    assert business.state_code == "NY"
    assert business.normalized_address == "101 PINE STREET"


def test_canadaopen_business_attributes():
    business = CanadaOpenBusiness(
        corporate_id="CA1",
        business_number="BN123456",
        current_name="Canada Open Business",
        sanitized_name="Canada Open Business",
        normalized_name="Canada Open Business",
        other_names="Canada Open Biz",
        normalized_address="123 Maple Rd",
        other_addresses="Unit 2, 123 Maple Rd",
        city="Toronto",
        region="Ontario",
        postal_code="M5V 2T6",
        country="CA",
    )
    assert business.name == "CANADA OPEN BUSINESS"
    assert business.canonical_name == "CANADA OPEN BUSINESS"
    assert business.state_code == "ON"
    assert business.normalized_address == "123 MAPLE ROAD"
    assert business.zip == "M5V 2T6"
    assert business.normalized_zip == "M5V2T6"
    assert business.zip3 == "M5V"
    assert business.street_number == 123
    assert business.street_name == "MAPLE RD"
    assert business.short_name == "CANADAOPENBUSINESS"


def test_canadaopen_business_aliases():
    business = CanadaOpenBusiness(
        id="CA2",
        business_number="BN654321",
        current_name="Another Canada Biz",
        sanitized_name="Another Canada Biz",
        normalized_name="Another Canada Biz",
        other_names="Another Biz",
        normalized_address="456 Oak Ave",
        other_addresses="Suite 3, 456 Oak Ave",
        city="Montreal",
        region="Quebec",
        postal_code="H2X 1Y4",
        country="CA",
    )
    assert business.name == "ANOTHER CANADA BIZ"
    assert business.canonical_name == "ANOTHER CANADA BIZ"
    assert business.state_code == "QC"
    assert business.normalized_address == "456 OAK AVENUE"
    assert business.zip3 == "H2X"
    assert business.zip == "H2X 1Y4"
    assert business.normalized_zip == "H2X1Y4"
    assert business.street_number == 456
    assert business.street_name == "OAK AVE"
    assert business.short_name == "ANOTHERCANADABIZ"
    assert business.state == "QUEBEC"


def test_npi_business_attributes():
    business = NPIBusiness(
        npi="NPI123",
        name="Health Org",
        authorized_official_first_name="John",
        authorized_official_last_name="Doe",
        address="123 Health St",
        city="Health City",
        state="CA",
        zip="90001-1234",
        authorized_official_telephone_number="1234567890",
    )

    assert business.authorized_official_first_name == "JOHN"
    assert business.authorized_official_last_name == "DOE"
    assert business.normalized_address == "123 HEALTH STREET"
    assert business.state_code == "CA"
    assert business.zip3 == "900"
    assert business.zip == "90001-1234"
    assert business.normalized_zip == "90001"
    assert business.street_number == 123
    assert business.street_name == "HEALTH ST"
    assert business.name == "HEALTH ORG"
    assert business.short_name == "ORG"
    assert business.authorized_official_telephone_number == "1234567890"


def test_npi_business_aliases():
    business = NPIBusiness.model_validate(
        {
            "npi": "NPI123",
            "provider organization name (legal business name)": "Health Org",
            "provider first line business practice location address": "123 Health St",
            "provider business practice location address city name": "Health City",
            "provider business practice location address state name": "CA",
            "provider business practice location address postal code": "900011234",
            "provider business practice location address country code (if outside u.s.)": "US",
            "provider business practice location address telephone number": "1234567890",
            "provider first name": "Jane",
            "provider last name (legal name)": "Doe",
            "provider telephone number": "0987654321",
        }
    )

    assert business.first_name == "JANE"
    assert business.last_name == "DOE"
    assert business.normalized_address == "123 HEALTH STREET"
    assert business.state_code == "CA"
    assert business.zip3 == "900"
    assert business.zip == "900011234"
    assert business.normalized_zip == "90001"
    assert business.street_number == 123
    assert business.street_name == "HEALTH ST"
    assert business.short_name == "ORG"


def test_comparison_business_potential_matches():
    worth_business = WorthBusiness(
        business_id="123",
        name="Test Worth Business",
        address="123 Main St",
        state="CA",
        zip="12345",
        city="Los Angeles",
        country="US",
    )
    equifax_business = EquifaxBusiness(
        company_uuid="456",
        efx_id="EFX123",
        name="Test Equifax Business",
        address="456 Elm St",
        city="San Francisco",
        state="CA",
        zip="94107",
    )
    zoominfo_business = ZoomInfoBusiness(
        company_id="789",
        location_id="LOC789",
        zi_es_location_id="ESLOC789",
        name="Test ZoomInfo Business",
        address="789 Oak St",
        city="Seattle",
        state="WA",
        zip="98101",
    )
    open_corporate_business = OpenCorporateBusiness(
        company_uuid="101112",
        company_number="OPC101112",
        name="Test Open Corporate Business",
        address="101 Pine St",
        city="New York",
        state="NY",
        zip="10001",
    )
    canada_open = CanadaOpenBusiness(
        corporate_id="CA1",
        business_number="BN123456",
        current_name="Test Canada Open Business",
        sanitized_name="Test Canada Open Business",
        normalized_name="Test Canada Open Business",
        other_names="Test Canada Open Biz",
        normalized_address="123 Maple Rd",
        other_addresses="Unit 2, 123 Maple Rd",
        city="Toronto",
        region="Ontario",
        postal_code="M5V 2T6",
        country="CA",
    )

    comparison_business = ComparisonBusiness(
        worth=[worth_business],
        equifax=[equifax_business],
        zoominfo=[zoominfo_business],
        open_corporate=[open_corporate_business],
        canada_open=[canada_open],
    )
    matches = comparison_business.potential_matches()
    expected_matches = {
        (worth_business, equifax_business): {},
        (worth_business, zoominfo_business): {},
        (worth_business, open_corporate_business): {},
        (worth_business, canada_open): {},
    }
    assert matches == expected_matches


def test_comparison_business_multiple_matches():
    worth_businesses_1 = WorthBusiness(
        business_id="WB1",
        name="Worth Business 1",
        address="1 Main St",
        state="CA",
        zip="12341",
        city="Los Angeles",
        country="US",
    )
    worth_businesses_2 = WorthBusiness(
        business_id="WB2",
        name="Worth Business 2",
        address="2 Main St",
        state="CA",
        zip="12342",
        city="Los Angeles",
        country="US",
    )
    equifax_businesses_1 = EquifaxBusiness(
        company_uuid="EQ1",
        efx_id="EFX1",
        name="Equifax Business 1",
        address="1 Elm St",
        city="San Francisco",
        state="CA",
        zip="94101",
    )
    equifax_businesses_2 = EquifaxBusiness(
        company_uuid="EQ2",
        efx_id="EFX2",
        name="Equifax Business 2",
        address="2 Elm St",
        city="San Francisco",
        state="CA",
        zip="94102",
    )
    zoominfo_businesses_1 = ZoomInfoBusiness(
        company_id="ZB1",
        location_id="LOC1",
        zi_es_location_id="ESLOC1",
        name="ZoomInfo Business 1",
        address="1 Oak St",
        city="Seattle",
        state="WA",
        zip="98101",
        country_code="US",
    )
    zoominfo_businesses_2 = ZoomInfoBusiness(
        company_id="ZB2",
        location_id="LOC2",
        zi_es_location_id="ESLOC2",
        name="ZoomInfo Business 2",
        address="2 Oak St",
        city="Seattle",
        state="WA",
        zip="98102",
        country_code="US",
    )
    open_corporate_businesses_1 = OpenCorporateBusiness(
        company_uuid="OC1",
        company_number="OPC1",
        name="Open Corporate Business 1",
        address="1 Pine St",
        city="New York",
        state="NY",
        zip="10001",
    )
    open_corporate_businesses_2 = OpenCorporateBusiness(
        company_uuid="OC2",
        company_number="OPC2",
        name="Open Corporate Business 2",
        address="2 Pine St",
        city="New York",
        state="NY",
        zip="10002",
    )

    canada_open_businesses_1 = CanadaOpenBusiness(
        corporate_id="CA1",
        business_number="BN1",
        current_name="Canada Open Business 1",
        sanitized_name="Canada Open Business 1",
        normalized_name="Canada Open Business 1",
        other_names="Canada Open Biz 1",
        normalized_address="1 Maple Rd",
        other_addresses="Unit 1, 1 Maple Rd",
        city="Toronto",
        region="Ontario",
        postal_code="M5V 2T6",
        country="CA",
    )
    canada_open_businesses_2 = CanadaOpenBusiness(
        corporate_id="CA2",
        business_number="BN2",
        current_name="Canada Open Business 2",
        sanitized_name="Canada Open Business 2",
        normalized_name="Canada Open Business 2",
        other_names="Canada Open Biz 2",
        normalized_address="2 Maple Rd",
        other_addresses="Unit 2, 2 Maple Rd",
        city="Toronto",
        region="Ontario",
        postal_code="M5V 2T7",
        country="CA",
    )

    npi_business_1 = NPIBusiness(
        npi="NPI1",
        first_name="John",
        last_name="Doe",
        address="123 Health St",
        city="Health City",
        state="CA",
        zip="90001",
    )
    npi_business_2 = NPIBusiness(
        npi="NPI2",
        first_name="Jane",
        last_name="Smith",
        address="456 Wellness Ave",
        city="Wellness City",
        state="NY",
        zip="10001",
    )

    comparison_business = ComparisonBusiness(
        worth=[worth_businesses_1, worth_businesses_2],
        equifax=[equifax_businesses_1, equifax_businesses_2],
        zoominfo=[zoominfo_businesses_1, zoominfo_businesses_2],
        open_corporate=[open_corporate_businesses_1, open_corporate_businesses_2],
        canada_open=[canada_open_businesses_1, canada_open_businesses_2],
        npi=[npi_business_1, npi_business_2],
    )
    expected_matches = {
        (worth_businesses_1, equifax_businesses_1): {},
        (worth_businesses_1, equifax_businesses_2): {},
        (worth_businesses_1, zoominfo_businesses_1): {},
        (worth_businesses_1, zoominfo_businesses_2): {},
        (worth_businesses_1, open_corporate_businesses_1): {},
        (worth_businesses_1, open_corporate_businesses_2): {},
        (worth_businesses_2, equifax_businesses_1): {},
        (worth_businesses_2, equifax_businesses_2): {},
        (worth_businesses_2, zoominfo_businesses_1): {},
        (worth_businesses_2, zoominfo_businesses_2): {},
        (worth_businesses_2, open_corporate_businesses_1): {},
        (worth_businesses_2, open_corporate_businesses_2): {},
        (worth_businesses_1, canada_open_businesses_1): {},
        (worth_businesses_1, canada_open_businesses_2): {},
        (worth_businesses_2, canada_open_businesses_1): {},
        (worth_businesses_2, canada_open_businesses_2): {},
        (worth_businesses_1, npi_business_1): {},
        (worth_businesses_1, npi_business_2): {},
        (worth_businesses_2, npi_business_1): {},
        (worth_businesses_2, npi_business_2): {},
    }
    matches = comparison_business.potential_matches()
    assert matches == expected_matches


def test_to_normalized_business():
    worth_business = WorthBusiness(
        business_id="123",
        name="Test Business",
        address="123 Main St",
        state="CA",
        zip="12345",
        city="Los Angeles",
        country="US",
    )
    normalized_business = worth_business.to_normalized_business()
    assert normalized_business.business_id == "123"
    assert normalized_business.name == "TEST BUSINESS"
    assert normalized_business.address == "123 MAIN STREET"
    assert normalized_business.canonical_name == "TEST BUSINESS"
    assert normalized_business.state_code == "CA"
    assert normalized_business.zip3 == "123"
    assert normalized_business.street_number == 123
    assert normalized_business.street_name == "MAIN ST"
    assert normalized_business.short_name == "TESTBUSINESS"


@pytest.mark.parametrize(
    "worth_businesses, expected_us, expected_uk, expected_ca",
    [
        [
            [
                WorthBusiness(
                    business_id="456",
                    name="UK Business",
                    address="789 High St",
                    state="London",
                    zip="SW1A 1AA",
                    city="London",
                    country="GB",
                )
            ],
            False,
            True,
            False,
        ],
        [
            [
                WorthBusiness(
                    business_id="789",
                    name="Canadian Business",
                    address="101 Queen St",
                    state="Ontario",
                    zip="M5H 2N2",
                    city="Toronto",
                    country="CA",
                )
            ],
            False,
            False,
            True,
        ],
        [
            [
                WorthBusiness(
                    business_id="101",
                    name="US Business",
                    address="123 Main St",
                    state="California",
                    zip="90210",
                    city="Beverly Hills",
                    country="US",
                )
            ],
            True,
            False,
            False,
        ],
    ],
)
def test_worth_business_list_contains_uk_businesses(
    worth_businesses, expected_us, expected_uk, expected_ca
):
    business_list = WorthBusinessList(worth_businesses)
    assert business_list.contains_us_businesses() == expected_us
    assert business_list.contains_uk_businesses() == expected_uk
    assert business_list.contains_ca_businesses() == expected_ca


def test_worth_business_list_source(worth_businesses):
    business_list = WorthBusinessList(worth_businesses)
    assert business_list.source == "worthai"


def test_simple_comparison_business(worth_businesses):
    business_1, business_2 = worth_businesses
    simple_comparison = SimpleComparisonBusiness(worth=business_1, other=business_2)
    assert simple_comparison.worth == business_1
    assert simple_comparison.other == business_2
    assert simple_comparison.potential_matches() == {(business_1, business_2): {}}
