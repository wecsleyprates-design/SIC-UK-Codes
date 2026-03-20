import datetime
from typing import Any, Iterator, Optional

from pydantic import Field, RootModel

from datapooler.models import BaseDataPoolerModel


class AccountItem(BaseDataPoolerModel):
    account_id: Optional[str] = None
    name: Optional[str] = None
    value: Optional[str] = None
    items: Optional[list[Any]] = None


class Income(BaseDataPoolerModel):
    name: Optional[str] = None
    account_id: Optional[str] = None
    value: Optional[str] = None
    items: Optional[list[AccountItem]] = None


class OtherIncome(BaseDataPoolerModel):
    name: Optional[str] = None
    account_id: Optional[str] = None
    value: Optional[str] = None
    items: Optional[list[AccountItem]] = None


class Expenses(BaseDataPoolerModel):
    name: Optional[str] = None
    account_id: Optional[str] = None
    value: Optional[str] = None
    items: Optional[list[AccountItem]] = None


class OtherExpenses(BaseDataPoolerModel):
    name: Optional[str] = None
    account_id: Optional[str] = None
    value: Optional[str] = None
    items: Optional[list[AccountItem]] = None


class CostOfSales(BaseDataPoolerModel):
    name: Optional[str] = None
    account_id: Optional[str] = None
    value: Optional[str] = None
    items: Optional[list[AccountItem]] = None


class CashFlow(BaseDataPoolerModel):
    business_id: Optional[str] = None
    id: Optional[str] = Field(None, alias="id")
    accounting_standard: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    currency_code: Optional[str] = None
    income: Optional[Income] = None
    other_income: Optional[OtherIncome] = None
    expenses: Optional[Expenses] = None
    other_expenses: Optional[OtherExpenses] = None
    cost_of_sales: Optional[CostOfSales] = None
    net_operating_income: Optional[str] = None
    gross_profit: Optional[str] = None
    net_income: Optional[str] = None
    total_income: Optional[str] = None
    total_expenses: Optional[str] = None
    total_cost_of_sales: Optional[str] = None
    total_other_expenses: Optional[str] = None
    total_other_income: Optional[str] = None
    platform_data: Optional[dict[Any, Any]] = None


class CashFlowList(RootModel):
    root: list[CashFlow]

    def __iter__(self) -> Iterator[CashFlow]:
        return iter(self.root)

    def __getitem__(self, i: int) -> CashFlow:
        return self.root[i]

    def __len__(self) -> int:
        return len(self.root)
