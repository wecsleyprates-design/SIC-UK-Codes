import datetime
from typing import Any, Iterator, Optional

from pydantic import Field, RootModel

from datapooler.models import BaseDataPoolerModel


class AccountItem(BaseDataPoolerModel):
    name: Optional[str] = None
    value: Optional[str] = None
    items: Optional[list[Any]] = None
    account_id: Optional[str] = None


class Assets(BaseDataPoolerModel):
    name: Optional[str] = None
    value: Optional[str] = None
    items: Optional[list[AccountItem]] = None
    account_id: Optional[str] = None


class Liabilities(BaseDataPoolerModel):
    name: Optional[str] = None
    value: Optional[str] = None
    items: Optional[list[AccountItem]] = None
    account_id: Optional[str] = None


class Equity(BaseDataPoolerModel):
    name: Optional[str] = None
    value: Optional[str] = None
    items: Optional[list[AccountItem]] = None
    account_id: Optional[str] = None


class BalanceSheet(BaseDataPoolerModel):
    business_id: Optional[str] = None
    id: Optional[str] = Field(None, alias="id")
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    currency_code: Optional[str] = None
    assets: Optional[Assets] = None
    liabilities: Optional[Liabilities] = None
    equity: Optional[Equity] = None
    total_assets: Optional[float] = None
    total_liabilities: Optional[float] = None
    total_equity: Optional[float] = None
    platform_data: dict[Any, Any] = None


class BalanceSheetList(RootModel):
    root: list[BalanceSheet]

    def __iter__(self) -> Iterator[BalanceSheet]:
        return iter(self.root)

    def __getitem__(self, i: int) -> BalanceSheet:
        return self.root[i]

    def __len__(self) -> int:
        return len(self.root)
