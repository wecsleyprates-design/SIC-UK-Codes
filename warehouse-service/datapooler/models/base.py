import datetime

from pydantic import BaseModel, ConfigDict, Field


class BaseDataPoolerModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True, validate_assignment=True, extra="ignore", coerce_numbers_to_str=True
    )

    collected_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
