from typing import Optional

from pydantic import BaseModel, Field

from datapooler.models import zipcodes
from datapooler.models.businesses import BusinessAddress, ExtraInfo


class NormaliseRequest(BaseModel):
    business_id: str
    names: list[str]
    addresses: list[BusinessAddress]
    extra: Optional[ExtraInfo] = Field(default_factory=ExtraInfo)


class ZipCodeRequest(BaseModel):
    zipcode: str
    country: str


class ZipCodeResponse(BaseModel):
    zipcode: zipcodes.USZipCode | zipcodes.CAZipCode | None
    country: str
