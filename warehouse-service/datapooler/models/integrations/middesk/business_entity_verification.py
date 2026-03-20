import datetime
from typing import Any, Optional

from pydantic import Field, field_validator

from datapooler.models import BaseDataPoolerModel


class Requester(BaseDataPoolerModel):
    id: Optional[str] = Field(None, alias="id")
    type: Optional[str] = None
    name: Optional[str] = None
    requested_at: Optional[datetime.datetime] = None


class Task(BaseDataPoolerModel):
    category: Optional[str] = None
    key: Optional[str] = None
    label: Optional[str] = None
    message: Optional[str] = None
    name: Optional[str] = None
    status: Optional[str] = None
    sub_label: Optional[str] = None
    sources: Optional[list[Any]] = None


class Settings(BaseDataPoolerModel):
    receives_agent_emails: Optional[bool] = None


class Assignee(BaseDataPoolerModel):
    object: Optional[str] = None
    id: Optional[str] = Field(None, alias="id")
    name: Optional[str] = None
    email: Optional[str] = None
    roles: Optional[list[str]] = None
    image_url: Optional[str] = None
    last_login_at: Optional[datetime.datetime] = None
    settings: Optional[Settings] = None


class Review(BaseDataPoolerModel):
    object: Optional[str] = None
    id: Optional[str] = Field(None, alias="id")
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None
    tasks: Optional[list[Task]] = None
    assignee: Optional[Assignee] = None


class Tin(BaseDataPoolerModel):
    name: Optional[str] = None
    mismatch: Optional[bool] = None
    unknown: Optional[bool] = None
    verified: Optional[bool] = None
    error: Optional[str] = None
    updated_at: Optional[datetime.datetime] = None
    issued: Optional[bool] = None
    verified_by: Optional[str] = None
    business_id: Optional[str] = None
    tin: Optional[str] = None


class Agency(BaseDataPoolerModel):
    abbr: Optional[str] = None
    name: Optional[str] = None
    org: Optional[str] = None


class WatchlistSource(BaseDataPoolerModel):
    object: Optional[str] = None
    agency: Optional[str] = None
    agency_abbr: Optional[str] = None
    organization: Optional[str] = None
    title: Optional[str] = None
    abbr: Optional[str] = None
    results: Optional[list[Any]] = None


class Watchlist(BaseDataPoolerModel):
    object: Optional[str] = None
    id: Optional[str] = Field(None, alias="id")
    hit_count: Optional[int] = None
    agencies: Optional[list[Agency]] = None
    lists: Optional[list[WatchlistSource]] = None
    people: Optional[list[Any]] = None


class Metadata(BaseDataPoolerModel):
    url: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    website: Optional[dict[Any, Any]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    categories: Optional[list[str]] = None
    full_address: Optional[str] = None
    phone_number: Optional[str] = None


class Source(BaseDataPoolerModel):
    id: Optional[str] = Field(None, alias="id")
    type: Optional[str] = None
    metadata: Optional[Metadata] = None


class Name(BaseDataPoolerModel):
    object: Optional[str] = None
    id: Optional[str] = Field(None, alias="id")
    name: Optional[str] = None
    submitted: Optional[bool] = None
    type: Optional[str] = None
    business_id: Optional[str] = None
    sources: Optional[list[Source]] = None


class Address(BaseDataPoolerModel):
    object: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    full_address: Optional[str] = None
    submitted: Optional[bool] = None
    id: Optional[str] = Field(None, alias="id")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    property_type: Optional[str] = None
    deliverable: Optional[bool] = None
    deliverability_analysis: Optional[str] = None
    street_view_available: Optional[bool] = None
    labels: Optional[list[Any]] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    registered_agent_name: Optional[str] = None
    cmra: Optional[bool] = None
    business_id: Optional[str] = None
    sources: Optional[list[Source]] = None


class ProfileMetadata(BaseDataPoolerModel):
    full_address: Optional[str] = None
    name: Optional[str] = None
    website: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone_number: Optional[str] = None
    categories: Optional[list[str]] = None


class Profile(BaseDataPoolerModel):
    object: Optional[str] = None
    id: Optional[str] = Field(None, alias="id")
    type: Optional[str] = None
    external_id: Optional[str] = None
    url: Optional[str] = None
    metadata: Optional[ProfileMetadata] = None


class OrderRequester(BaseDataPoolerModel):
    name: Optional[str] = None
    type: Optional[str] = None


class Order(BaseDataPoolerModel):
    object: Optional[str] = None
    id: Optional[str] = Field(None, alias="id")
    business_id: Optional[str] = None
    completed_at: Optional[datetime.datetime] = None
    created_at: Optional[datetime.datetime] = None
    product: Optional[str] = None
    package: Optional[str] = None
    requester: Optional[OrderRequester] = None
    status: Optional[str] = None
    subproducts: Optional[list[Any]] = None
    updated_at: Optional[datetime.datetime] = None


class SubmittedAddress(BaseDataPoolerModel):
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    address_line1: Optional[str] = None


class SubmittedAttributes(BaseDataPoolerModel):
    object: Optional[str] = None
    name: Optional[str] = None
    entity_type: Optional[Any] = None
    addresses: Optional[list[SubmittedAddress]] = None
    orders: Optional[list[Any]] = None
    people: Optional[list[Any]] = None
    phone_numbers: Optional[list[str]] = None
    tags: Optional[list[str]] = None
    external_id: Optional[str] = None
    unique_external_id: Optional[str] = None
    tin: Optional[str] = None
    website: Optional[str] = None
    assignee_id: Optional[str] = None
    formation: Optional[dict[Any, Any]] = None
    names: Optional[list[str]] = None

    @field_validator("tin", mode="before")
    def validate_tin(cls, v: str | dict[Any, Any]) -> str:
        if v is None or isinstance(v, str):
            return v

        if isinstance(v, dict):
            return v.get("tin")


class BusinessEntityVerification(BaseDataPoolerModel):
    business_id: Optional[str] = Field(None, alias="unique_external_id")
    object: Optional[str] = None
    id: Optional[str] = Field(None, alias="id")
    external_id: Optional[str] = None
    name: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    status: Optional[str] = None
    tags: Optional[list[Any]] = None
    requester: Optional[Requester] = None
    assignee_id: Optional[str] = None
    review: Optional[Review] = None
    tin: Optional[Tin] = None
    business_batch_id: Optional[str] = None
    formation: Optional[dict[Any, Any]] = None
    website: Optional[str] = None
    watchlist: Optional[Watchlist] = None
    names: Optional[list[Name]] = None
    addresses: Optional[list[Address]] = None
    people: Optional[list[Any]] = None
    phone_numbers: Optional[list[Any]] = None
    profiles: Optional[list[Profile]] = None
    registrations: Optional[list[Any]] = None
    orders: Optional[list[Order]] = None
    industry_classification: Optional[str] = None
    fmcsa_registrations: Optional[list[Any]] = None
    actions: Optional[list[Any]] = None
    policy_results: Optional[list[Any]] = None
    submitted: Optional[SubmittedAttributes] = None
