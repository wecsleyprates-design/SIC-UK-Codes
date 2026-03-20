from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from datapooler.models.businesses import BusinessAddress, ExtraInfo, WorthBusiness


class BaseMatchModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class MatchRequest(BaseMatchModel):
    business_id: str
    names: list[str]
    addresses: list[BusinessAddress]
    extra: ExtraInfo = Field(default_factory=ExtraInfo)
    source: Optional[str] = None


class MatchResponse(BaseMatchModel):
    business_id: str
    match_id: str
    status: str
    names: Optional[list[str]] = Field(default_factory=list)
    addresses: Optional[list[BusinessAddress]] = Field(default_factory=list)


class MatchReturn(BaseMatchModel):
    match_id: str
    business_id: str
    source: str
    match: Optional[dict[str, Any]] = Field(default_factory=dict)
    prediction: float


class MatchesResponse(BaseModel):
    matches: Optional[list[MatchReturn]] = Field(default_factory=list)


class ConfidenceComparisonRequest(BaseModel):
    business: WorthBusiness
    integration_business: WorthBusiness
