from itertools import product
from typing import Annotated, Any, Optional
from uuid import uuid4

from pydantic import (
    BaseModel,
    Field,
    RootModel,
    StringConstraints,
    TypeAdapter,
    computed_field,
    field_validator,
)

from datapooler.models import BaseDataPoolerModel
from datapooler.services.business import BusinessProcessingService

EXCLUDE_FIELDS = [
    "business_name_shingles",
    "street_name_shingles",
    "short_name_shingles",
]

AddressStr = Annotated[
    str | None,
    StringConstraints(
        strip_whitespace=True,
        to_upper=True,
    ),
]

NameStr = Annotated[
    str | None,
    StringConstraints(
        strip_whitespace=True,
        to_upper=True,
    ),
]

MODEL_DUMP_EXCLUSIONS = ["business_name_shingles", "street_name_shingles", "short_name_shingles"]


class BusinessAddress(BaseModel, frozen=True):
    address: str
    state: Optional[str] = Field(None)
    zip: str
    city: str
    country: str

    @classmethod
    def from_list(cls, data: list[dict[str, Any]]) -> list["BusinessAddress"]:
        # Validates the whole list and returns list[BusinessAddress]
        return TypeAdapter(list[cls]).validate_python(data)


class ExtraInfo(BaseModel, frozen=True):
    first_name: NameStr = None
    last_name: NameStr = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    title: Optional[str] = None
    npi: Optional[str] = None
    canada_open_corporate_id: Optional[str] = None
    canada_open_business_number: Optional[str] = None


class WorthBusiness(BaseDataPoolerModel, frozen=True):
    business_id: str
    name: str = Field(default_factory=list)
    address: AddressStr
    state: AddressStr | None = Field(None)
    zip: AddressStr
    city: AddressStr
    country: AddressStr
    extra: ExtraInfo = Field(default_factory=ExtraInfo)
    source: str = "worthai"

    @field_validator("zip", mode="before")
    def validate_zip(cls, v: str) -> str | None:
        """
        Validates the input ZIP code by:
        - Ensuring that alpha-numeric zips are uppercase, and fill to be at least 7 characters long.
        - Ensuring that the primary part of only numeric ZIP codes are at least 5 digits long.

        Args:
            zip_code (str): The ZIP code to validate.

        Returns:
            str: The validated ZIP code.
        """

        if not v:
            return None

        return BusinessProcessingService.fill_zip(v)

    @computed_field
    @property
    def country_code(self) -> str | None:
        return BusinessProcessingService.country_code(self.country)

    @computed_field
    @property
    def normalized_zip(self) -> str | None:
        return BusinessProcessingService.normalize_zip(self.zip)

    @computed_field
    @property
    def normalized_address(self) -> str | None:
        return BusinessProcessingService.prepare_address(self.address)

    @computed_field
    @property
    def state_code(self) -> str | None:
        return BusinessProcessingService(self).region_abbreviation()

    @computed_field
    @property
    def zip3(self) -> str | None:
        return BusinessProcessingService.zip3(self.zip)

    @computed_field
    @property
    def street_number(self) -> int | None:
        if not self.address:
            return None

        return BusinessProcessingService(self).street_number

    @computed_field
    @property
    def street_name(self) -> str | None:
        if not self.address:
            return None

        return BusinessProcessingService(self).street_name

    @field_validator("name", mode="before")
    def clean_name(cls, v: str, values: list[str]) -> str:
        """
        Cleans the input string by:
        - Converting it to uppercase.
        - Removes accents and diacritics.
        - Handles special characters.
        - Removes non alpha-numeric characters.
        - Trimming excess whitespace.
        """

        if not v:
            return v

        return BusinessProcessingService(cls).sanitize_name(v)

    @computed_field
    @property
    def canonical_name(self) -> str:
        return BusinessProcessingService(self).canonize_name(self.name)

    @computed_field
    @property
    def short_name(self) -> str:
        return BusinessProcessingService(self).short_name

    @computed_field
    @property
    def business_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify(attr="name", k=1),
            "k2": BusinessProcessingService(self).shingify(attr="name", k=2),
            "k3": BusinessProcessingService(self).shingify(attr="name", k=3),
            "k4": BusinessProcessingService(self).shingify(attr="name", k=4),
            "by_word": BusinessProcessingService(self).shingify("name", by_word=True),
        }

    @computed_field
    @property
    def street_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify("street_name", k=1),
            "k2": BusinessProcessingService(self).shingify("street_name", k=2),
            "k3": BusinessProcessingService(self).shingify("street_name", k=3),
            "k4": BusinessProcessingService(self).shingify("street_name", k=4),
        }

    @computed_field
    @property
    def short_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify("short_name", k=1),
            "k2": BusinessProcessingService(self).shingify("short_name", k=2),
            "k3": BusinessProcessingService(self).shingify("short_name", k=3),
            "k4": BusinessProcessingService(self).shingify("short_name", k=4),
        }

    @classmethod
    def from_request(cls, request: dict[str, str | list[str]]) -> "WorthBusinessList":

        return WorthBusinessList(
            cls(
                business_id=request["business_id"],
                name=name,
                address=address["address"],
                state=address["state"],
                zip=address["zip"],
                city=address["city"],
                country=address.get("country"),
                extra=ExtraInfo(
                    npi=request.get("extra", {}).get("npi"),
                    first_name=request.get("extra", {}).get("first_name"),
                    last_name=request.get("extra", {}).get("last_name"),
                    email=request.get("extra", {}).get("email"),
                    phone=request.get("extra", {}).get("phone"),
                    website=request.get("extra", {}).get("website"),
                    title=request.get("extra", {}).get("title"),
                    canada_open_business_number=request.get("extra", {}).get(
                        "canada_open_business_number"
                    ),
                    canada_open_corporate_id=request.get("extra", {}).get(
                        "canada_open_corporate_id"
                    ),
                ),
            )
            for name, address in product(request["names"], request["addresses"])
        )

    def to_normalized_business(self) -> "NormalizedBusiness":
        return NormalizedBusiness(
            business_id=self.business_id,
            name=self.name,
            canonical_name=getattr(
                self, "canonical_name", None
            ),  # TODO: Update this once implemented
            address=self.normalized_address,
            state=self.state_code,
            city=self.city,
            country=self.country,
            state_code=self.state_code,
            zip=self.normalized_zip,
            zip3=self.zip3,
            street_number=self.street_number,
            street_name=self.street_name,
            short_name=self.short_name,
        )


# These models don't need to use constr because the values are pre-processed in redshift
class EquifaxBusiness(BaseDataPoolerModel, frozen=True):
    efx_id: str
    name: str = Field(alias="efx_eng_companyname")
    legal_name: str | None = Field(None, alias="efx_legal_name")
    address: AddressStr = Field(alias="efx_eng_address")
    city: AddressStr | None = Field(None, alias="efx_eng_city")
    state: AddressStr | None = Field(None, alias="efx_eng_state")
    zip: AddressStr | None = Field(None, alias="efx_eng_zipcode")
    contct: str | None = Field(None, alias="efx_contct")
    ceoname: str | None = Field(None, alias="efx_ceoname")
    country_code: str | None = Field("US")
    source: str = "equifax"

    @field_validator("name", "legal_name", mode="before")
    def clean_name(cls, v: str, values: list[str]) -> str:
        """
        Cleans the input string by:
        - Converting it to uppercase.
        - Removes accents and diacritics.
        - Handles special characters.
        - Removes non alpha-numeric characters.
        - Trimming excess whitespace.
        """

        if not v:
            return v

        return BusinessProcessingService(cls).sanitize_name(v)

    @computed_field
    @property
    def canonical_name(self) -> str:
        return BusinessProcessingService(self).canonize_name(self.name)

    @computed_field
    @property
    def normalized_zip(self) -> str | None:
        return BusinessProcessingService.normalize_zip(self.zip)

    @computed_field
    @property
    def zip3(self) -> str | None:
        return BusinessProcessingService.zip3(self.zip)

    @computed_field
    @property
    def state_code(self) -> str | None:
        return BusinessProcessingService(self).region_abbreviation()

    @computed_field
    @property
    def normalized_address(self) -> str | None:
        return BusinessProcessingService.prepare_address(self.address)

    @computed_field
    @property
    def street_number(self) -> int | None:
        if not self.address:
            return None

        return BusinessProcessingService(self).street_number

    @computed_field
    @property
    def street_name(self) -> str | None:
        if not self.address:
            return None

        return BusinessProcessingService(self).street_name

    @computed_field
    @property
    def short_name(self) -> str:
        return BusinessProcessingService(self).short_name

    @computed_field
    @property
    def business_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify(attr="canonical_name", k=1),
            "k2": BusinessProcessingService(self).shingify(attr="canonical_name", k=2),
            "k3": BusinessProcessingService(self).shingify(attr="canonical_name", k=3),
            "k4": BusinessProcessingService(self).shingify(attr="canonical_name", k=4),
            "by_word": BusinessProcessingService(self).shingify("canonical_name", by_word=True),
        }

    @computed_field
    @property
    def street_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify("street_name", k=1),
            "k2": BusinessProcessingService(self).shingify("street_name", k=2),
            "k3": BusinessProcessingService(self).shingify("street_name", k=3),
            "k4": BusinessProcessingService(self).shingify("street_name", k=4),
        }

    @computed_field
    @property
    def short_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify("short_name", k=1),
            "k2": BusinessProcessingService(self).shingify("short_name", k=2),
            "k3": BusinessProcessingService(self).shingify("short_name", k=3),
            "k4": BusinessProcessingService(self).shingify("short_name", k=4),
        }


class ZoomInfoBusiness(BaseDataPoolerModel, frozen=True):
    company_id: str = Field(alias="zi_c_company_id")
    location_id: str = Field(alias="zi_c_location_id")
    es_location_id: str = Field(alias="zi_es_location_id")
    name: str = Field(alias="zi_eng_companyname")
    address: AddressStr = Field(alias="zi_eng_address")
    address_2: AddressStr | None = Field(None, alias="zi_eng_dba")
    city: AddressStr = Field(alias="zi_eng_city")
    state: AddressStr = Field(alias="zi_eng_state")
    zip: AddressStr = Field(alias="zi_eng_zipcode")
    country_code: str | None = Field(default=None, alias=["zi_eng_country", "country_code"])
    source: str = "zoominfo"

    @field_validator("name", mode="before")
    def clean_name(cls, v: str, values: list[str]) -> str:
        """
        Cleans the input string by:
        - Converting it to uppercase.
        - Removes accents and diacritics.
        - Handles special characters.
        - Removes non alpha-numeric characters.
        - Trimming excess whitespace.
        """

        if not v:
            return v

        return BusinessProcessingService(cls).sanitize_name(v)

    @computed_field
    @property
    def canonical_name(self) -> str:
        return BusinessProcessingService(self).canonize_name(self.name)

    @computed_field
    @property
    def normalized_zip(self) -> str | None:
        return BusinessProcessingService.normalize_zip(self.zip)

    @computed_field
    @property
    def zip3(self) -> str | None:
        return BusinessProcessingService.zip3(self.zip)

    @computed_field
    @property
    def state_code(self) -> str | None:
        return BusinessProcessingService(self).region_abbreviation()

    @computed_field
    @property
    def normalized_address(self) -> str | None:
        return BusinessProcessingService.prepare_address(self.address)

    @computed_field
    @property
    def normalized_address_2(self) -> str | None:
        if not self.address_2:
            return

        return BusinessProcessingService.prepare_address(self.address_2)

    @computed_field
    @property
    def street_number(self) -> int | None:
        if not self.address:
            return None

        return BusinessProcessingService(self).street_number

    @computed_field
    @property
    def street_name(self) -> str | None:
        if not self.address:
            return None

        return BusinessProcessingService(self).street_name

    @computed_field
    @property
    def short_name(self) -> str:
        return BusinessProcessingService(self).short_name

    @computed_field
    @property
    def business_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify(attr="canonical_name", k=1),
            "k2": BusinessProcessingService(self).shingify(attr="canonical_name", k=2),
            "k3": BusinessProcessingService(self).shingify(attr="canonical_name", k=3),
            "k4": BusinessProcessingService(self).shingify(attr="canonical_name", k=4),
            "by_word": BusinessProcessingService(self).shingify("canonical_name", by_word=True),
        }

    @computed_field
    @property
    def street_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify("street_name", k=1),
            "k2": BusinessProcessingService(self).shingify("street_name", k=2),
            "k3": BusinessProcessingService(self).shingify("street_name", k=3),
            "k4": BusinessProcessingService(self).shingify("street_name", k=4),
        }

    @computed_field
    @property
    def short_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify("short_name", k=1),
            "k2": BusinessProcessingService(self).shingify("short_name", k=2),
            "k3": BusinessProcessingService(self).shingify("short_name", k=3),
            "k4": BusinessProcessingService(self).shingify("short_name", k=4),
        }


class OpenCorporateBusiness(BaseDataPoolerModel, frozen=True):
    company_uuid: str = Field(default_factory=lambda: str(uuid4()))
    company_number: str
    name: str = Field(alias="normalised_name")
    name_2: str | None = Field(None, alias="alternative_name")
    address: AddressStr | None = Field(None, alias="street_address_normalized")
    address_2: AddressStr | None = Field(None, alias="dba_normalized")
    state: AddressStr | None = Field(None, alias="region")
    city: AddressStr | None = Field(None, alias="locality")
    zip: AddressStr | None = Field(None, alias="postal_code")
    country: str | None = Field(None, alias="country_code")
    jurisdiction_code: str | None = Field(None, alias="jurisdiction_code")
    source: str = "open_corporate"

    @field_validator("name", "name_2", mode="before")
    def clean_name(cls, v: str, values: list[str]) -> str:
        """
        Cleans the input string by:
        - Converting it to uppercase.
        - Removes accents and diacritics.
        - Handles special characters.
        - Removes non alpha-numeric characters.
        - Trimming excess whitespace.
        """

        if not v:
            return v

        return BusinessProcessingService(cls).sanitize_name(v)

    @computed_field
    @property
    def country_code(self) -> str:
        if self.country:
            return self.country.upper()

        if self.jurisdiction_code:
            return self.jurisdiction_code[:2].upper()

    @computed_field
    @property
    def canonical_name(self) -> str:
        return BusinessProcessingService(self).canonize_name(self.name)

    @computed_field
    @property
    def normalized_zip(self) -> str | None:
        return BusinessProcessingService.normalize_zip(self.zip)

    @computed_field
    @property
    def zip3(self) -> str | None:
        return BusinessProcessingService.zip3(self.zip)

    @computed_field
    @property
    def state_code(self) -> str | None:
        return BusinessProcessingService(self).region_abbreviation()

    @computed_field
    @property
    def normalized_address(self) -> str | None:
        return BusinessProcessingService.prepare_address(self.address)

    @computed_field
    @property
    def street_number(self) -> int | None:
        if not self.address:
            return None

        return BusinessProcessingService(self).street_number

    @computed_field
    @property
    def street_name(self) -> str | None:
        if not self.address:
            return None

        return BusinessProcessingService(self).street_name

    @computed_field
    @property
    def short_name(self) -> str:
        return BusinessProcessingService(self).short_name

    @computed_field
    @property
    def business_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify(attr="canonical_name", k=1),
            "k2": BusinessProcessingService(self).shingify(attr="canonical_name", k=2),
            "k3": BusinessProcessingService(self).shingify(attr="canonical_name", k=3),
            "k4": BusinessProcessingService(self).shingify(attr="canonical_name", k=4),
            "by_word": BusinessProcessingService(self).shingify("canonical_name", by_word=True),
        }

    @computed_field
    @property
    def street_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify("street_name", k=1),
            "k2": BusinessProcessingService(self).shingify("street_name", k=2),
            "k3": BusinessProcessingService(self).shingify("street_name", k=3),
            "k4": BusinessProcessingService(self).shingify("street_name", k=4),
        }

    @computed_field
    @property
    def short_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify("short_name", k=1),
            "k2": BusinessProcessingService(self).shingify("short_name", k=2),
            "k3": BusinessProcessingService(self).shingify("short_name", k=3),
            "k4": BusinessProcessingService(self).shingify("short_name", k=4),
        }


class CanadaOpenBusiness(BaseDataPoolerModel, frozen=True):
    corporate_id: str = Field(None, alias="id")
    business_number: str | None = Field(None, alias="business_number")
    name: str | None = Field(None, alias="current_name")
    sanitized_name: str | None = Field(None, alias="sanitized_name")
    normalized_name: str | None = Field(None, alias="normalized_name")
    other_names: str | None = Field(None, alias="other_names")
    address: AddressStr | None = Field(None, alias="normalized_address")
    other_addresses: AddressStr | None = Field(None, alias="other_addresses")
    city: AddressStr | None = Field(None, alias="city")
    region: AddressStr | None = Field(None, alias="region")
    zip: AddressStr | None = Field(None, alias="postal_code")
    country: AddressStr | None = Field(None, alias="country")
    source: str = "canada_open"

    @field_validator("name", "sanitized_name", "other_names", mode="before")
    def clean_name(cls, v: str, values: list[str]) -> str:
        """
        Cleans the input string by:
        - Converting it to uppercase.
        - Removes accents and diacritics.
        - Handles special characters.
        - Removes non alpha-numeric characters.
        - Trimming excess whitespace.
        """

        if not v:
            return v

        return BusinessProcessingService(cls).sanitize_name(v)

    @computed_field
    @property
    def country_code(self) -> str:
        """
        Returns the country code for Canada.
        """
        return "CA"

    @property
    def state(self) -> str | None:
        # This allows   compatibility with the existing field name within
        # the feature generation and ml matching code.
        return self.region

    @computed_field
    @property
    def canonical_name(self) -> str:
        return BusinessProcessingService(self).canonize_name(self.name)

    @computed_field
    @property
    def normalized_zip(self) -> str | None:
        return BusinessProcessingService.normalize_zip(self.zip)

    @computed_field
    @property
    def zip3(self) -> str | None:
        return BusinessProcessingService.zip3(self.zip)

    @computed_field
    @property
    def state_code(self) -> str | None:
        # Provinces in Canada are often referred to by their full name, so we need to handle that
        return BusinessProcessingService(self).region_abbreviation()

    @computed_field
    @property
    def normalized_address(self) -> str | None:
        return BusinessProcessingService.prepare_address(self.address)

    @computed_field
    @property
    def street_number(self) -> int | None:
        if not self.address:
            return None

        return BusinessProcessingService(self).street_number

    @computed_field
    @property
    def street_name(self) -> str | None:
        if not self.address:
            return None

        return BusinessProcessingService(self).street_name

    @computed_field
    @property
    def short_name(self) -> str:
        return BusinessProcessingService(self).short_name

    @computed_field
    @property
    def business_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify(attr="canonical_name", k=1),
            "k2": BusinessProcessingService(self).shingify(attr="canonical_name", k=2),
            "k3": BusinessProcessingService(self).shingify(attr="canonical_name", k=3),
            "k4": BusinessProcessingService(self).shingify(attr="canonical_name", k=4),
            "by_word": BusinessProcessingService(self).shingify("canonical_name", by_word=True),
        }

    @computed_field
    @property
    def street_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify("street_name", k=1),
            "k2": BusinessProcessingService(self).shingify("street_name", k=2),
            "k3": BusinessProcessingService(self).shingify("street_name", k=3),
            "k4": BusinessProcessingService(self).shingify("street_name", k=4),
        }

    @computed_field
    @property
    def short_name_shingles(self) -> dict[str, set[str]]:
        return {
            "k1": BusinessProcessingService(self).shingify("short_name", k=1),
            "k2": BusinessProcessingService(self).shingify("short_name", k=2),
            "k3": BusinessProcessingService(self).shingify("short_name", k=3),
            "k4": BusinessProcessingService(self).shingify("short_name", k=4),
        }


class NPIBusiness(BaseDataPoolerModel, frozen=True):
    npi: str | None = Field(None, alias="npi")
    name: str | None = Field(None, alias="provider organization name (legal business name)")
    other_name: str | None = Field(None, alias="provider other organization name")
    address: AddressStr | None = Field(
        None, alias="provider first line business practice location address"
    )
    city: AddressStr | None = Field(
        None, alias="provider business practice location address city name"
    )
    state: AddressStr | None = Field(
        None, alias="provider business practice location address state name"
    )
    zip: AddressStr | None = Field(
        None, alias="provider business practice location address postal code"
    )
    country: AddressStr = Field(
        "US", alias="provider business practice location address country code (if outside u.s.)"
    )
    practice_phone_number: str | None = Field(
        None, alias="provider business practice location address telephone number"
    )
    practice_fax_number: str | None = Field(
        None, alias="provider business practice location address fax number"
    )
    authorized_official_first_name: NameStr = Field(None, alias="provider first name")
    authorized_official_last_name: NameStr = Field(None, alias="provider last name (legal name)")
    authorized_official_middle_name: NameStr | None = Field(None, alias="provider middle name")
    authorized_official_telephone_number: str | None = Field(
        None, alias="provider telephone number"
    )
    provider_license_number: str | None = Field(None, alias="provider license number_1")
    authorized_official_credential_text: str | None = Field(None, alias="provider credential text")
    replacement_npi: str | None = Field(None, alias="replacement npi")
    employer_identification_number: str | None = Field(
        None, alias="employer identification number (ein)"
    )
    entity_type_code: str | None = Field(None, alias="entity type code")
    healthcare_provider_taxonomy_code_1: str | None = Field(
        None, alias="healthcare provider taxonomy code_1"
    )
    is_sole_proprietor: str | None = Field(None, alias="is sole proprietor")
    last_update_date: str | None = Field(None, alias="last update date")
    npi_deactivation_date: str | None = Field(None, alias="npi deactivation date")
    npi_reactivation_date: str | None = Field(None, alias="npi reactivation date")
    npi_deactivation_reason_code: str | None = Field(None, alias="npi deactivation reason code")
    row: dict[str, Any] = Field(default_factory=dict)
    source: str = "npi"

    def __hash__(self) -> int:
        return hash(tuple([self.npi, self.name, self.address, self.city, self.state, self.zip]))

    @field_validator("name", mode="before")
    def clean_name(cls, v: str, values: list[str]) -> str:
        """
        Cleans the input string by:
        - Converting it to uppercase.
        - Removes accents and diacritics.
        - Handles special characters.
        - Removes non alpha-numeric characters.
        - Trimming excess whitespace.
        """

        if not v:
            return v

        return BusinessProcessingService(cls).sanitize_name(v)

    @computed_field
    @property
    def first_name(self) -> str | None:
        return self.authorized_official_first_name

    @computed_field
    @property
    def last_name(self) -> str | None:
        return self.authorized_official_last_name

    @computed_field
    @property
    def full_name(self) -> str | None:
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name or self.last_name

    @computed_field
    @property
    def canonical_name(self) -> str | None:
        if not self.name:
            return None
        return BusinessProcessingService(self).canonize_name(self.name)

    @computed_field
    @property
    def country_code(self) -> str | None:
        return self.country.upper() if self.country else "US"

    @computed_field
    @property
    def normalized_zip(self) -> str | None:
        return BusinessProcessingService.normalize_zip(self.zip)

    @computed_field
    @property
    def zip3(self) -> str | None:
        return BusinessProcessingService.zip3(self.zip)

    @computed_field
    @property
    def state_code(self) -> str | None:
        return BusinessProcessingService(self).region_abbreviation()

    @computed_field
    @property
    def normalized_address(self) -> str | None:
        return BusinessProcessingService.prepare_address(self.address)

    @computed_field
    @property
    def street_number(self) -> int | None:
        if not self.address:
            return None
        return BusinessProcessingService(self).street_number

    @computed_field
    @property
    def street_name(self) -> str | None:
        if not self.address:
            return None
        return BusinessProcessingService(self).street_name

    @computed_field
    @property
    def short_name(self) -> str | None:
        if not self.name:
            return None
        return BusinessProcessingService(self).short_name

    @computed_field
    @property
    def business_name_shingles(self) -> dict[str, set[str]]:
        if not self.name:
            return {}
        return {
            "k1": BusinessProcessingService(self).shingify(attr="canonical_name", k=1),
            "k2": BusinessProcessingService(self).shingify(attr="canonical_name", k=2),
            "k3": BusinessProcessingService(self).shingify(attr="canonical_name", k=3),
            "k4": BusinessProcessingService(self).shingify(attr="canonical_name", k=4),
            "by_word": BusinessProcessingService(self).shingify("canonical_name", by_word=True),
        }

    @computed_field
    @property
    def street_name_shingles(self) -> dict[str, set[str]]:
        if not self.address:
            return {}
        return {
            "k1": BusinessProcessingService(self).shingify("street_name", k=1),
            "k2": BusinessProcessingService(self).shingify("street_name", k=2),
            "k3": BusinessProcessingService(self).shingify("street_name", k=3),
            "k4": BusinessProcessingService(self).shingify("street_name", k=4),
        }

    @computed_field
    @property
    def short_name_shingles(self) -> dict[str, set[str]]:
        if not self.name:
            return {}
        return {
            "k1": BusinessProcessingService(self).shingify("short_name", k=1),
            "k2": BusinessProcessingService(self).shingify("short_name", k=2),
            "k3": BusinessProcessingService(self).shingify("short_name", k=3),
            "k4": BusinessProcessingService(self).shingify("short_name", k=4),
        }


IntegrationBusiness = Annotated[
    EquifaxBusiness | ZoomInfoBusiness | OpenCorporateBusiness | CanadaOpenBusiness | NPIBusiness,
    "Any of the integration business models: EquifaxBusiness, ZoomInfoBusiness, OpenCorporateBusiness, CanadaOpenBusiness, or NPIBusiness",  # noqa
]

PotentialMatches = Annotated[
    dict[
        tuple[WorthBusiness, IntegrationBusiness],
        dict[Any, Any],
    ],
    "A dictionary of potential matches between Worth and Integration businesses",
]


class ComparisonBusiness(BaseModel):
    worth: list[WorthBusiness] = Field(default_factory=list)
    equifax: list[EquifaxBusiness] = Field(default_factory=list)
    zoominfo: list[ZoomInfoBusiness] = Field(default_factory=list)
    open_corporate: list[OpenCorporateBusiness] = Field(default_factory=list)
    canada_open: list[CanadaOpenBusiness] = Field(default_factory=list)
    npi: list[NPIBusiness] = Field(default_factory=list)

    def integration_businesses(self) -> list[IntegrationBusiness]:
        """Get all integration businesses from all sources dynamically."""
        return [
            business
            for field_name, _ in ComparisonBusiness.model_fields.items()
            if field_name != "worth"
            for business in getattr(self, field_name, [])
        ]

    def potential_matches(self) -> PotentialMatches:
        return {
            (worth_business, integration_business): {}
            for worth_business, integration_business in product(
                self.worth, self.integration_businesses()
            )
        }


class SimpleComparisonBusiness(BaseDataPoolerModel):
    worth: WorthBusiness
    other: WorthBusiness | IntegrationBusiness

    def potential_matches(self) -> PotentialMatches:
        return {(self.worth, self.other): {}}


class NormalizedBusiness(BaseDataPoolerModel):
    business_id: str
    name: str
    canonical_name: Optional[str] = None
    address: str
    state: str
    city: str
    country: Optional[str] = None
    state_code: Optional[str] = None
    zip: Optional[str] = None
    zip3: Optional[str] = None
    street_number: Optional[int] = None
    street_name: Optional[str] = None
    short_name: Optional[str] = None


class WorthBusinessList(RootModel):
    root: list[WorthBusiness]

    def __iter__(self):
        """
        Allows iteration over the list of WorthBusiness objects.
        """

        return iter(self.root)

    def __len__(self):
        """
        Returns the length of the list of WorthBusiness objects.
        """

        return len(self.root)

    def __getitem__(self, index: int) -> WorthBusiness:
        """
        Allows indexing into the list of WorthBusiness objects.
        """

        return self.root[index]

    def __contains__(self, item: WorthBusiness) -> bool:
        """
        Checks if a WorthBusiness object is in the list.
        """

        return item in self.root

    def contains_uk_businesses(self) -> bool:
        """
        Returns True if the list contains any UK businesses, False otherwise.
        """

        return self._check_code("GB")

    def contains_ca_businesses(self) -> bool:
        """
        Returns True if the list contains any Canadian businesses, False otherwise.
        """

        return self._check_code("CA")

    def contains_us_businesses(self) -> bool:
        """
        Returns True if the list contains any US businesses, False otherwise.
        """

        return self._check_code("US")

    def contains_ie_businesses(self) -> bool:
        """
        Returns True if the list contains any Irish businesses, False otherwise.
        """

        return self._check_code("IE")

    def _check_code(self, code: str) -> bool:
        """
        Checks if the list contains any businesses with the specified country code.
        """

        for business in self:
            if business.country_code == code:
                return True
        return False

    @computed_field
    @property
    def business_id(self) -> str:
        """
        Returns the business ID of the first business in the list.
        Raises an IndexError if the list is empty.
        """

        if not self.root:
            raise IndexError("The WorthBusinessList is empty.")

        return self.root[0].business_id

    @computed_field
    @property
    def source(self) -> str:
        if not self.root:
            raise IndexError("The WorthBusinessList is empty.")

        return self.root[0].source


def business_model_selector(integration: str, data: dict[str, Any]) -> IntegrationBusiness:
    """
    Selects the appropriate business model based on the integration type.
    """
    match integration:
        case "equifax":
            return EquifaxBusiness.model_validate(data)
        case "zoominfo":
            return ZoomInfoBusiness.model_validate(data)
        case "open_corporate":
            return OpenCorporateBusiness.model_validate(data)
        case "canada_open":
            return CanadaOpenBusiness.model_validate(data)
        case "npi":
            return NPIBusiness.model_validate(data)
        case _:
            raise ValueError(f"Unknown integration type: {integration}")
