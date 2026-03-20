from typing import Any

from pydantic import RootModel

from datapooler.models import BaseDataPoolerModel


class Firmographics(RootModel[dict[str, list[Any]]]):
    """Type-safe container for firmographics data from different sources."""

    def __getitem__(self, key: str) -> list[Any]:
        return self.root[key]

    def __setitem__(self, key: str, value: list[Any]) -> None:
        self.root[key] = value

    def __contains__(self, key: str) -> bool:
        return key in self.root

    def items(self):
        return self.root.items()

    def keys(self):
        return self.root.keys()

    def values(self):
        return self.root.values()


class FirmographicsResult(BaseDataPoolerModel):
    event: str = "firmographics_event"
    business_id: str
    match_id: str
    prediction: float
    firmographics: Firmographics
    source: str
