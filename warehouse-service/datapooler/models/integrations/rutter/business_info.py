import datetime
from typing import Any, Optional

from pydantic import Field, field_validator

from datapooler.models import BaseDataPoolerModel


class BusinessInfo(BaseDataPoolerModel):
    business_id: Optional[str] = None
    id: Optional[str] = Field(None, alias="id")
    legal_name: Optional[str] = None
    platform_id: Optional[str] = None
    currency_code: Optional[str] = None
    name: Optional[str] = None
    addresses: Optional[list[str]] = Field(default_factory=list)
    additional_fields: Optional[dict[Any, Any]] = Field(default_factory=dict)
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    last_synced_at: Optional[datetime.datetime] = None

    @field_validator("created_at", "updated_at", mode="before")
    def validate_dates(cls, v: str) -> datetime.datetime | None:
        datetime.datetime.fromisoformat(v) if v else None
