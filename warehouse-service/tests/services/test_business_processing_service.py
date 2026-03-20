import pytest

from datapooler.models import businesses
from datapooler.services.business import BusinessProcessingService


@pytest.fixture
def mock_business():
    return businesses.WorthBusiness(
        business_id="123",
        name="Some Business Name",
        address="123 Main St, Some City, Alabama 12345",
        state="ST",
        zip="12345",
        city="Some City",
        country="USA",
    )


@pytest.fixture
def service(mock_business):
    return BusinessProcessingService(mock_business)


def test_prepare_address():
    address = "123 Main St Apt 4B, Some City"
    assert (
        BusinessProcessingService.prepare_address(address)
        == "123 MAIN STREET APARTMENT 4B, SOME CITY"
    )


def test_street_name(service):
    assert service.street_name == "MAIN ST"


def test_street_number(service):
    assert service.street_number == 123


def test_sanitize_name(service):
    assert service.sanitize_name("some business name") == "SOME BUSINESS NAME"
    assert service.sanitize_name("some co, l.l.c.") == "SOME CO LLC"
    assert service.sanitize_name("l’somé  business") == "L’SOME BUSINESS"
    assert service.sanitize_name("l'somé  business") == "L’SOME BUSINESS"
    assert service.sanitize_name("ÁÀÂÆÇÈÊËÍÎÏÓÔŒÚÙÛÜŸÑ") == "AAAACEEEIIIOOOUUUUYN"


def test_replace_accents(service):
    assert service._replace_accents_diacritics("ÁÀÂÆÇÈÊËÍÎÏÓÔŒÚÙÛÜŸÑ") == "AAAÆCEEEIIIOOŒUUUUYN"


def test_replace_french_chars(service):
    assert service._replace_french_characters("ÆŒ'") == "AO’"


def test_remove_excess_whitespace(service):
    assert service._remove_excess_whitespace(" extra    spaces        ") == "extra spaces"
    assert service._remove_excess_whitespace("   extra      spaces    ") == "extra spaces"


def test_replace_special_characters(service):
    assert service._replace_special_characters("Morgan & Morgan C.O.") == "M  AND  M CO"
    assert service._replace_special_characters("MORGAN & MORGAN C.O.") == "MORGAN  AND  MORGAN CO"
    assert service._replace_special_characters("L’H/R-H") == "L H R H"
    assert service._replace_special_characters("!@#$%^*()_=+12345") == "12345"


def test_canonical_name(service):
    assert service.canonize_name("SOME BUSINESS NAME") == "SOME BUSINESS NAME"
    assert service.canonize_name("SOME CO LLC") == "SOME"
    assert service.canonize_name("L’SOME BUSINESS") == "SOME BUSINESS"
    assert service.canonize_name("L L BEAN LTD") == "L L BEAN"
    assert service.canonize_name("THE UMBRELLA CORP") == "UMBRELLA"


def test_strip_prefix(service):
    PREFIXES = ["THE", "LOS", "AN", "L’"]
    assert service._strip_prefix("THE GAP LLC", PREFIXES) == "GAP LLC"
    assert service._strip_prefix("L’ GAP LLC", PREFIXES) == "GAP LLC"
    assert service._strip_prefix("LOS GAP LLC", PREFIXES) == "GAP LLC"
    assert service._strip_prefix("AN GAP LLC", PREFIXES) == "GAP LLC"
    assert service._strip_prefix("ANTHROPOLOGIE", PREFIXES) == "ANTHROPOLOGIE"


def test_strip_suffix(service):
    SUFFIXES = [
        "PLLC",
        "LLC",
        "CO",
        "PROFESSIONAL LIMITED LIABILITY COMPANY",
        "LIMITED LIABILITY COMPANY",
    ]
    assert service._strip_suffix("THE GAP LLC", SUFFIXES) == "THE GAP"
    assert service._strip_suffix("THE GAP PLLC", SUFFIXES) == "THE GAP"
    assert service._strip_suffix("THE GAP CO LLC", SUFFIXES) == "THE GAP CO"
    assert service._strip_suffix("GAP PROFESSIONAL LIMITED LIABILITY COMPANY", SUFFIXES) == "GAP"
    assert service._strip_suffix("THE GAP LIMITED LIABILITY COMPANY", SUFFIXES) == "THE GAP"


def test_fill_zip():
    assert BusinessProcessingService.fill_zip("123") == "00123"
    assert BusinessProcessingService.fill_zip("123-1234") == "00123-1234"
    assert BusinessProcessingService.fill_zip("12345") == "12345"
    assert BusinessProcessingService.fill_zip("12345-1234") == "12345-1234"
    assert BusinessProcessingService.fill_zip("A0A 0A0") == "A0A 0A0"
    assert BusinessProcessingService.fill_zip("A0A0A0") == "A0A0A0"


def test_normalize_zip():
    assert BusinessProcessingService.normalize_zip("12345") == "12345"
    assert BusinessProcessingService.normalize_zip("12345-1234") == "12345"
    assert BusinessProcessingService.normalize_zip("A0A 0A0") == "A0A0A0"
    assert BusinessProcessingService.normalize_zip("A0A0A0") == "A0A0A0"
    assert BusinessProcessingService.normalize_zip("A0A0A0X") == "A0A0A0"


def test_zip3():
    assert BusinessProcessingService.zip3("A10BBB") == "A10"
    assert BusinessProcessingService.zip3("12345") == "123"
    assert BusinessProcessingService.zip3("") is None


@pytest.mark.parametrize(
    "business, outcome",
    [
        (
            businesses.WorthBusiness(
                business_id="123",
                name="Some Business Name",
                address="123 Main St, Some City, Alabama 12345",
                state="AL",
                zip="12345",
                city="Some City",
                country="US",
            ),
            "AL",
        ),
        (
            businesses.WorthBusiness(
                business_id="456",
                name="Another Business",
                address="456 Elm St, Another City, California 67890",
                state="California",
                zip="67890",
                city="Another City",
                country="US",
            ),
            "CA",
        ),
        (
            businesses.WorthBusiness(
                business_id="789",
                name="UK Business",
                address="789 High St, London, SW1A 1AA",
                state="London",
                zip="SW1A 1AA",
                city="London",
                country="GB",
            ),
            "SW",
        ),
        (
            businesses.WorthBusiness(
                business_id="101",
                name="Canadian Business",
                address="101 Queen St, Toronto, ON M5H 2N2",
                state="Ontario",
                zip="M5H 2N2",
                city="Toronto",
                country="CA",
            ),
            "ON",
        ),
        (
            businesses.WorthBusiness(
                business_id="102",
                name="Irish Business",
                address="102 O'Connell St, Dublin, D02 F123",
                state="Dublin",
                zip="D02 F123",
                city="Dublin",
                country="Ireland",
            ),
            "D02",
        ),
    ],
)
def test_region_abbreviation(business, outcome):
    assert BusinessProcessingService(business).region_abbreviation() == outcome


def test_normalize_address(service):
    assert service.normalize_address() == "123 MAIN STREET, SOME CITY, AL 12345"


def test_shingify(service):
    assert service.shingify("name", k=2) == {
        "SO",
        "OM",
        "ME",
        "E ",
        " B",
        "BU",
        "US",
        "SI",
        "IN",
        "NE",
        "ES",
        "SS",
        "S ",
        " N",
        "NA",
        "AM",
    }
    assert service.shingify("name", by_word=True) == {"SOME", "BUSINESS", "NAME"}
    assert service.shingify("name", k=10) == {
        "SOME BUSIN",
        "OME BUSINE",
        "ME BUSINES",
        "E BUSINESS",
        " BUSINESS ",
        "BUSINESS N",
        "USINESS NA",
        "SINESS NAM",
        "INESS NAME",
    }


def test_short_name(service):
    assert service.short_name == "BUSINESSNAME"


def test_business_name_shingles(service):
    shingles = service.business.business_name_shingles
    assert "k1" in shingles
    assert "k2" in shingles
    assert "k3" in shingles
    assert "k4" in shingles
    assert "by_word" in shingles


def test_street_name_shingles(service):
    shingles = service.business.street_name_shingles
    assert "k1" in shingles
    assert "k2" in shingles
    assert "k3" in shingles
    assert "k4" in shingles


def test_short_name_shingles(service):
    shingles = service.business.short_name_shingles
    assert "k1" in shingles
    assert "k2" in shingles
    assert "k3" in shingles
    assert "k4" in shingles


def test_normalize_uk_postal_code():
    assert BusinessProcessingService.normalize_zip("SW1A 1AA") == "SW1A1AA"
    assert BusinessProcessingService.normalize_zip("sw1a 1aa") == "SW1A1AA"
    assert BusinessProcessingService.normalize_zip("EC1A 1BB") == "EC1A1BB"


@pytest.mark.parametrize(
    "business, abbreviation",
    [
        (
            businesses.WorthBusiness(
                business_id="123",
                name="UK Business",
                address="789 High St, London, SW1A 1AA",
                state="London",
                zip="SW1A 1AA",
                city="London",
                country="GB",
            ),
            "SW",
        ),
        (
            businesses.WorthBusiness(
                business_id="456",
                name="Another UK Business",
                address="456 Elm St, Manchester, M1 1AA",
                state="Manchester",
                zip="M1 1AA",
                city="Manchester",
                country="GB",
            ),
            "M",
        ),
        (
            businesses.WorthBusiness(
                business_id="101",
                name="Canadian Business",
                address="101 Queen St, Toronto, ON M5H 2N2",
                state="Ontario",
                zip="MAH 2N2",
                city="Toronto",
                country="GB",
            ),
            "MA",
        ),
        (
            businesses.WorthBusiness(
                business_id="789",
                name="US Business",
                address="123 Main St, Los Angeles, CA 90001",
                state="California",
                zip="90001",
                city="Los Angeles",
                country="GB",
            ),
            None,
        ),
    ],
)
def test_uk_region_abbreviation(business, abbreviation):
    service = BusinessProcessingService(business)
    assert service.region_abbreviation() == abbreviation


def test_is_valid_uk_postal_code():
    assert BusinessProcessingService.is_valid_uk_postal_code("SW1A 1AA") is True
    assert BusinessProcessingService.is_valid_uk_postal_code("EC1A 1BB") is True
    assert BusinessProcessingService.is_valid_uk_postal_code("INVALID") is False
    assert BusinessProcessingService.is_valid_uk_postal_code("12345") is False


@pytest.mark.parametrize(
    "country, expected_code",
    [
        ("US", "US"),
        ("GB", "GB"),
        ("CA", "CA"),
        ("United States", "US"),
        ("United Kingdom", "GB"),
        ("Canada", "CA"),
        ("XX", "XX"),  # Unsupported country
        ("Unknown Country", None),  # Not in supported countries
        ("Ireland", "IE"),
        ("Republic of Ireland", "IE"),
        ("Wales", "GB"),
        ("Great Britain", "GB"),
    ],
)
def test_country_code(country, expected_code):
    assert BusinessProcessingService.country_code(country) == expected_code


def test_normalize_zip_when_none():
    # This should return an empty string when zip is None

    assert BusinessProcessingService.normalize_zip(None) == ""
