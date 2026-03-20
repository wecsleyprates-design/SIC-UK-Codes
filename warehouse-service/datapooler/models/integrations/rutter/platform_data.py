from typing import Any, Optional

from datapooler.models import BaseDataPoolerModel


class Cell(BaseDataPoolerModel):
    Value: Optional[str] = None
    Attributes: Optional[list[dict[str, str]]] = None


class RowItem(BaseDataPoolerModel):
    Cells: Optional[list[Cell]] = None
    RowType: Optional[str] = None


class Row(BaseDataPoolerModel):
    Cells: Optional[list[Cell]] = None
    Rows: Optional[list[RowItem]] = None
    Title: Optional[str] = None
    RowType: Optional[str] = None


class PlatformData(BaseDataPoolerModel):
    Rows: Optional[list[Row]] = None
    Fields: Optional[list[Any]] = None
    toDate: Optional[str] = None
    ReportID: Optional[str] = None
    fromDate: Optional[str] = None
    ReportDate: Optional[str] = None
    ReportName: Optional[str] = None
    ReportType: Optional[str] = None
    ReportTitles: Optional[list[str]] = None
    UpdatedDateUTC: Optional[list[Any]] = None
