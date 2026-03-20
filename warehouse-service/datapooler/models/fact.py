import datetime
from typing import Any, Iterable

from pydantic import Field

from datapooler.adapters.db.models import FactDb
from datapooler.models import BaseDataPoolerModel


class Fact(BaseDataPoolerModel):
    business_id: str
    name: str
    value: dict[Any, Any] = Field(default_factory=dict)
    received_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(tz=datetime.timezone.utc),
        description="The time at which the fact was received",
    )
    created_at: datetime.datetime | None = None
    updated_at: datetime.datetime | None = None

    @classmethod
    def from_db(cls, factdb: FactDb | Iterable[FactDb]) -> list["Fact"]:
        if isinstance(factdb, FactDb):
            return cls(
                business_id=factdb.business_id,
                name=factdb.name,
                value=factdb.value,
                recieved_at=factdb.received_at,
                created_at=factdb.created_at,
                updated_at=factdb.updated_at,
            )
        else:
            return [
                cls(
                    business_id=fact.business_id,
                    name=fact.name,
                    value=fact.value,
                    recieved_at=fact.received_at,
                    created_at=fact.created_at,
                    updated_at=fact.updated_at,
                )
                for fact in factdb
            ]


class FactEnvelope(BaseDataPoolerModel):
    scope: str
    business_id: str = Field(str, alias="id")
    data: dict[str, Any]
    calculated_at: datetime.datetime

    def __iter__(self):
        for name, data in self.data.items():
            if not data:
                continue
            if isinstance(data, dict):
                yield Fact(
                    business_id=self.business_id,
                    name=name,
                    value=data,
                    received_at=self.calculated_at,
                )
            if isinstance(data, str):
                yield Fact(
                    business_id=self.business_id,
                    name=name,
                    value={"value": data},
                    received_at=self.calculated_at,
                )
            if not data:
                yield Fact(
                    business_id=self.business_id,
                    name=name,
                    value={},
                    received_at=self.calculated_at,
                )
            continue

    def to_fact_list(self) -> list[Fact]:
        return list(self)
