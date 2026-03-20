from typing import Any, Optional

from pydantic import Field

from datapooler.models import BaseDataPoolerModel


class ProviderBusinessAddress(BaseDataPoolerModel):
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country_code: Optional[str] = None
    telephone_number: Optional[str] = None
    fax_number: Optional[str] = None


class NPIRecord(BaseDataPoolerModel):
    npi: str
    replacement_npi: Optional[str] = Field(None, alias="replacement npi")

    employer_identification_number: Optional[str] = Field(
        None, alias="employer identification number"
    )
    entity_type_code: Optional[str] = Field(None, alias="entity type code")
    healthcare_provider_taxonomy_code: Optional[str] = Field(None)
    is_sole_proprietor: bool = Field(None, alias="is sole proprietor")
    last_update_date: Optional[str] = Field(None, alias="last update date")
    npi_deactivation_date: Optional[str] = Field(None, alias="npi deactivation date")
    npi_reactivation_date: Optional[str] = Field(None, alias="npi reactivation date")
    npi_deactivation_reason_code: Optional[str] = Field(None, alias="npi deactivation reason code")
    provider_organization_name: Optional[str] = Field(None, alias="provider organization name")
    provider_gender_code: Optional[str] = Field(None, alias="provider_gender_code")
    provider_first_name: Optional[str] = Field(None, alias="provider first name")
    provider_last_name: Optional[str] = Field(None, alias="provider last name")
    provider_middle_name: Optional[str] = Field(None, alias="provider middle name")
    provider_credential_text: Optional[str] = Field(None, alias="provider credential text")
    provider_business_address: ProviderBusinessAddress = Field(
        default_factory=lambda: ProviderBusinessAddress(), alias="provider business address"
    )
    metadata: dict[str, Any] = Field(default_factory=dict)
