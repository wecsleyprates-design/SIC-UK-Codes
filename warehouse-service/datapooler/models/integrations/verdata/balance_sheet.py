import datetime
from typing import Any, Dict, List, Optional

from pydantic import Field

from datapooler.models import BaseDataPoolerModel


class BalanceSheet(BaseDataPoolerModel):
    id: Optional[str] = Field(None, alias="id")
    currency_code: Optional[str] = None
    start_date: Optional[datetime.datetime] = None
    end_date: Optional[datetime.datetime] = None
    total_liabilities: Optional[str] = None
    total_assets: Optional[str] = None
    total_equity: Optional[str] = None
    assets: Optional[Dict[str, Any]] = None
    liabilities: Optional[Dict[str, Any]] = None
    equity: Optional[Dict[str, Any]] = None
    platform_data: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None


class Connection(BaseDataPoolerModel):
    id: Optional[str] = Field(None, alias="id")
    org_id: Optional[str] = Field(None, alias="orgId")
    platform: Optional[str] = None


class BalanceSheets(BaseDataPoolerModel):
    connection: Optional[Connection] = None
    balance_sheets: Optional[List[BalanceSheet]] = None
