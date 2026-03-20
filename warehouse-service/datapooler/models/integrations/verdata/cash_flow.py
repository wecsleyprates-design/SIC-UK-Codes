import datetime
from typing import List, Optional

from pydantic import Field

from datapooler.models import BaseDataPoolerModel


class CashFlow(BaseDataPoolerModel):
    id: Optional[str] = Field(None, alias="id")
    currency_code: Optional[str] = None
    start_date: Optional[datetime.datetime] = None
    end_date: Optional[datetime.datetime] = None
    ending_balance: Optional[str] = None
    starting_balance: Optional[float] = None
    total_financing: Optional[str] = None
    total_operating: Optional[str] = None
    total_investing: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None


class Connection(BaseDataPoolerModel):
    id: Optional[str] = Field(None, alias="id")
    org_id: Optional[str] = Field(None, alias="orgId")
    platform: Optional[str] = None


class CashFlows(BaseDataPoolerModel):
    connection: Optional[Connection] = None
    cash_flows: Optional[List[CashFlow]] = None
