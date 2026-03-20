from datetime import datetime
from typing import Any, Iterator, Optional

from pydantic import RootModel

from datapooler.models import BaseDataPoolerModel


class AccountItem(BaseDataPoolerModel):
    account_id: Optional[str] = None
    name: Optional[str] = None
    value: Optional[Any] = None
    items: Optional[list[Any]] = None


class Income(BaseDataPoolerModel):
    name: Optional[str] = None
    account_id: Optional[str] = None
    value: Optional[Any] = None
    items: Optional[list[AccountItem]] = None


class OtherIncome(BaseDataPoolerModel):
    name: Optional[str] = None
    account_id: Optional[str] = None
    value: Optional[Any] = None
    items: Optional[list[AccountItem]] = None


class Expenses(BaseDataPoolerModel):
    name: Optional[str] = None
    account_id: Optional[str] = None
    value: Optional[Any] = None
    items: Optional[list[AccountItem]] = None


class OtherExpenses(BaseDataPoolerModel):
    name: Optional[str] = None
    account_id: Optional[str] = None
    value: Optional[Any] = None
    items: Optional[list[AccountItem]] = None


class CostOfSales(BaseDataPoolerModel):
    name: Optional[str] = None
    account_id: Optional[str] = None
    value: Optional[Any] = None
    items: Optional[list[AccountItem]] = None


class IncomeStatement(BaseDataPoolerModel):
    business_id: Optional[str] = None
    id: Optional[str] = None
    accounting_standard: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    currency_code: Optional[str] = None
    income: Optional[Income] = None
    other_income: Optional[OtherIncome] = None
    expenses: Optional[Expenses] = None
    other_expenses: Optional[OtherExpenses] = None
    cost_of_sales: Optional[CostOfSales] = None
    net_operating_income: Optional[Any] = None
    gross_profit: Optional[Any] = None
    net_income: Optional[Any] = None
    total_income: Optional[Any] = None
    total_expenses: Optional[Any] = None
    total_cost_of_sales: Optional[Any] = None
    total_other_expenses: Optional[Any] = None
    total_other_income: Optional[Any] = None
    platform_data: Optional[dict[Any, Any]] = None


class IncomeStatementList(RootModel):
    root: list[IncomeStatement]

    def __iter__(self) -> Iterator[IncomeStatement]:
        return iter(self.root)

    def __getitem__(self, i: int) -> IncomeStatement:
        return self.root[i]

    def __len__(self) -> int:
        return len(self.root)
