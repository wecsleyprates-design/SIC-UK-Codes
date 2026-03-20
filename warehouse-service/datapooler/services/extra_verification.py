from pydantic import BaseModel

from datapooler.models import businesses
from datapooler.services.npi import NPIMatchService


class ExtraVerificationInfo(BaseModel):
    """
    Holds extra verification information for a similarity match.
    This can include various checks depending on the type of integration business.
    As the implementation grows we can add various other verification checks here, and
    should probably split it out into a separate module.

    Note: All fields are optional and default to None if not provided.
    This is because for integrations we don't support we won't know
    whether the verification is passed or failed so we leave it as None.
    """

    name_match: bool | None = None
    npi_match: bool | None = None
    canada_open_corporate_id_match: bool | None = None
    canada_open_business_number_match: bool | None = None
    equifax_id_match: bool | None = None


class ExtraVerificationService:
    def __init__(
        self,
        worth_business: businesses.WorthBusiness,
        integration_business: businesses.IntegrationBusiness,
    ):
        self.worth_business = worth_business
        self.integration_business = integration_business
        self.extra_info = ExtraVerificationInfo()

    def verify(self) -> ExtraVerificationInfo:
        # Perform extra verification based on the type of integration business.
        # Using structural pattern matching for clarity and extensibility.
        match self.integration_business:
            case businesses.NPIBusiness():
                return self.npi_verification()
            case businesses.CanadaOpenBusiness():
                return self.canada_open_verification()
            case _:
                return self.extra_info

    def canada_open_verification(self) -> ExtraVerificationInfo:
        if (
            self.worth_business.extra.canada_open_corporate_id
            and self.integration_business.corporate_id
        ):
            self.extra_info.canada_open_corporate_id_match = (
                self.worth_business.extra.canada_open_corporate_id
                == self.integration_business.corporate_id
            )

        if (
            self.worth_business.extra.canada_open_business_number
            and self.integration_business.business_number
        ):
            self.extra_info.canada_open_business_number_match = (
                self.worth_business.extra.canada_open_business_number
                == self.integration_business.business_number
            )

        return self.extra_info

    def npi_verification(self) -> ExtraVerificationInfo:
        """
        Perform extra verification for NPI businesses.
        """
        name_match_service = NPIMatchService(self.worth_business, self.integration_business)
        self.extra_info.name_match = name_match_service.is_name_match()
        self.extra_info.npi_match = name_match_service.is_npi_match()
        return self.extra_info
