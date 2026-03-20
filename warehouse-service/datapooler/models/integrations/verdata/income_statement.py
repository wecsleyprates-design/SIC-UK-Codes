import datetime
from typing import List, Optional

from pydantic import Field

from datapooler.models import BaseDataPoolerModel


class IncomeStatement(BaseDataPoolerModel):
    id: Optional[str] = Field(None, alias="id")
    currency_code: Optional[str] = None
    start_date: Optional[datetime.datetime] = None
    end_date: Optional[datetime.datetime] = None
    gross_profit: Optional[float] = None
    net_income: Optional[float] = None
    total_cost_of_sales: Optional[float] = None
    total_expenses: Optional[str] = None
    total_income: Optional[str] = None
    net_operating_income: Optional[float] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None


class Connection(BaseDataPoolerModel):
    id: Optional[str] = Field(None, alias="id")
    org_id: Optional[str] = Field(None, alias="orgId")
    platform: Optional[str] = None


class IncomeStatements(BaseDataPoolerModel):
    connection: Optional[Connection] = None
    income_statements: Optional[List[IncomeStatement]] = None
