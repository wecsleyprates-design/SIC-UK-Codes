import datetime
import hashlib
from decimal import Decimal
from enum import StrEnum
from typing import Optional

from pydantic import BaseModel, Field

from datapooler.adapters.sessions import WarehouseSessions


class CaseDetails(BaseModel):
    case_business_id: Optional[str]
    case_id: Optional[str]
    submission_date: Optional[datetime.datetime]
    invitation_date: Optional[datetime.datetime]
    invited_by: Optional[str]
    legal_name: Optional[str] = Field(max_length=400)
    dba_name: Optional[str] = Field(max_length=1020)
    mcc: Optional[int]
    risk_level: Optional[str]
    transaction_size: Optional[Decimal]
    monthly_volume: Optional[str]
    annual_volume: Optional[str]
    application_status: Optional[str]
    analyst_name: Optional[str]
    worth_score: Optional[Decimal]
    last_decision_date: Optional[datetime.datetime]
    onboarding_date_time: Optional[datetime.datetime]
    auto_approval: Optional[bool]
    mid: Optional[str]
    application_reason_code: Optional[str]
    collected_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(tz=datetime.timezone.utc)
    )


class CustomerCaseDetails(BaseModel):

    business_id: Optional[str]
    case_id: Optional[str]
    submission_date: Optional[datetime.datetime]
    invitation_date: Optional[datetime.datetime]
    invited_by: Optional[str]
    business_legal_name: Optional[str]
    dba_name: Optional[str]
    mcc: Optional[int]
    mid: Optional[str]
    risk_level: Optional[str]
    transaction_size: Optional[Decimal]
    monthly_volume: Optional[str]
    annual_volume: Optional[str]
    application_status: Optional[str]
    application_reason_code: Optional[str]
    analyst_name: Optional[str]
    worth_score: Optional[Decimal]
    last_decision_date: Optional[datetime.datetime]
    onboarding_date_time: Optional[datetime.datetime]
    auto_approval: Optional[bool]

    collected_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(tz=datetime.timezone.utc)
    )


class CaseType(StrEnum):
    CASE = "case"
    CUSTOMER = "customer"


class CaseDetailsService:
    def __init__(self):
        self.sessions = WarehouseSessions

    def get_case_details(
        self, id: str, query_type: CaseType
    ) -> CaseDetails | list[CustomerCaseDetails] | None:
        """
        Retrieves case details based on the provided ID and type.
        """
        match query_type:
            case CaseType.CASE:
                return self._case_gather(id)
            case CaseType.CUSTOMER:
                return self._customer_case_gather(id)
            case _:
                raise ValueError(f"Unsupported case type: {query_type}")

    def _case_gather(self, case_id: str) -> CaseDetails | None:
        """
        Gathers case details for a given case ID.
        """

        hashed_case_id = hashlib.sha256(case_id.encode("utf-8")).hexdigest()
        cursor_name = f"case_cursor_{hashed_case_id}"

        with self.sessions.get_session() as session:
            session.execute(
                f"CALL public.gather_case_details({case_id!r}, {cursor_name!r});",
            )

            res = session.execute(f"FETCH ALL FROM {cursor_name};").first()

            return CaseDetails.model_validate(res, from_attributes=True) if res else None

    def _customer_case_gather(self, customer_id: str) -> list[CustomerCaseDetails] | None:
        """
        Gathers customer case details for a given case ID.
        """

        hashed_customer_id = hashlib.sha256(customer_id.encode("utf-8")).hexdigest()
        cursor_name = f"customer_case_cursor_{hashed_customer_id}"

        with self.sessions.get_session() as session:
            session.execute(
                f"CALL public.gather_customer_case_details({customer_id!r}, {cursor_name!r});",
            )

            res = session.execute(f"FETCH ALL FROM {cursor_name};").all()

            return (
                [CustomerCaseDetails.model_validate(case, from_attributes=True) for case in res]
                if res
                else None
            )
