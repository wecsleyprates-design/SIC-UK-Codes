from pydantic import Field

from datapooler.models.base import BaseModel


class USZipCode(BaseModel):
    """
    Model representing a US Zip Code.
    """

    zip_code: str = Field(..., description="5-digit US Zip Code")
    city: str = Field(..., description="City associated with the Zip Code")
    county: str | None = Field(None, description="County associated with the Zip Code")
    state: str = Field(..., description="2-letter state abbreviation")
    county_fips: int | None = Field(None, description="County FIPS code")
    state_fips: int | None = Field(None, description="State FIPS code")
    timezone: int | None = Field(None, description="Timezone offset in hours")
    daylight_savings: bool | None = Field(
        None, description="Indicates if Daylight Savings is observed"
    )
    latitude: float = Field(..., description="Latitude of the Zip Code location")
    longitude: float = Field(..., description="Longitude of the Zip Code location")


class CAZipCode(BaseModel):
    """
    Model representing a Canadian Postal Code.
    """

    postal_code: str = Field(..., description="Canadian Postal Code")
    city: str = Field(..., description="City associated with the Postal Code")
    province_abbr: str = Field(..., description="2-letter province abbreviation")
    timezone: int | None = Field(None, description="Timezone offset in hours")
    latitude: float = Field(..., description="Latitude of the Postal Code location")
    longitude: float = Field(..., description="Longitude of the Postal Code location")
