import pytest

from datapooler.models import businesses
from datapooler.services.extra_verification import (
    ExtraVerificationInfo,
    ExtraVerificationService,
)


class TestExtraVerificationService:
    worth_business = businesses.WorthBusiness(
        business_id="worth_123",
        name="Test Business",
        address="123 Test St",
        city="Testville",
        state="TS",
        zip="12345",
        country="US",
        extra=businesses.ExtraInfo(
            first_name="John",
            last_name="Doe",
            npi="1234567890",
            canada_open_corporate_id="COC123",
            canada_open_business_number="BN123456789",
        ),
    )

    @pytest.mark.parametrize(
        "integration_business, expected_name_match, expected_npi_match",
        [
            (
                businesses.NPIBusiness(
                    name="Test Business",
                    authorized_official_first_name="John",
                    authorized_official_last_name="Doe",
                    npi="1234567890",
                ),
                True,
                True,
            ),
            (
                businesses.NPIBusiness(
                    name="Different Business",
                    authorized_official_first_name="Jane",
                    authorized_official_last_name="Smith",
                    npi="0987654321",
                ),
                False,
                False,
            ),
        ],
    )
    def test_npi_verification(self, integration_business, expected_name_match, expected_npi_match):
        service = ExtraVerificationService(self.worth_business, integration_business)
        result: ExtraVerificationInfo = service.verify()

        assert result.name_match == expected_name_match
        assert result.npi_match == expected_npi_match

        # Don't expect Canada Open fields to be set in this case, and they shouldn't
        # be False because that would indicate a failed match rather than absence of data.
        assert result.canada_open_corporate_id_match is None
        assert result.canada_open_business_number_match is None

    @pytest.mark.parametrize(
        "integration_business, expected_corporate_id_match, expected_business_number_match",
        [
            (
                businesses.CanadaOpenBusiness(
                    name="Test Business",
                    corporate_id="COC123",
                    business_number="BN123456789",
                ),
                True,
                True,
            ),
            (
                businesses.CanadaOpenBusiness(
                    name="Test Business",
                    corporate_id="WRONG_ID",
                    business_number="WRONG_NUMBER",
                ),
                False,
                False,
            ),
        ],
    )
    def test_canada_open_verification(
        self, integration_business, expected_corporate_id_match, expected_business_number_match
    ):
        service = ExtraVerificationService(self.worth_business, integration_business)
        result: ExtraVerificationInfo = service.verify()

        # Don't expect NPI fields to be set in this case, and they shouldn't
        # be False because that would indicate a failed match rather than absence of data.
        assert result.name_match is None
        assert result.npi_match is None

        assert result.canada_open_corporate_id_match == expected_corporate_id_match
        assert result.canada_open_business_number_match == expected_business_number_match
