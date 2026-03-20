import datetime
from typing import Any, Optional

from pydantic import Field, field_validator

from datapooler.models import BaseDataPoolerModel


class Seller(BaseDataPoolerModel):
    name: Optional[str] = None
    name_dba: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip5: Optional[str] = None
    zip4: Optional[str] = None
    dpc: Optional[str] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None
    domain_name: Optional[str] = None
    ein: Optional[str] = None
    sic_code: Optional[str] = None


class MatchScore(BaseDataPoolerModel):
    score: Optional[float] = None
    name_score: Optional[float] = None
    addr_score: Optional[float] = None
    phone_score: Optional[float] = None
    ein_score: Optional[float] = None
    domain_score: Optional[float] = None


class ScorecardScore(BaseDataPoolerModel):
    score: Optional[str] = None
    total: Optional[str] = None


class ThirdPartyDataItem(BaseDataPoolerModel):
    bus_liens_summary_001: Optional[str] = None
    bus_liens_summary_002: Optional[str] = None
    bus_liens_summary_003: Optional[str] = None
    bus_liens_summary_004: Optional[str] = None
    bus_judgement_summary_001: Optional[str] = None
    bus_judgement_summary_002: Optional[str] = None
    bus_judgement_summary_003: Optional[str] = None
    bus_judgement_summary_004: Optional[str] = None
    bus_judgement_summary_005: Optional[str] = None
    bus_bankruptcy_summary_001: Optional[str] = None
    bus_bankruptcy_summary_002: Optional[str] = None
    bus_bankruptcy_summary_003: Optional[str] = None
    bus_bankruptcy_summary_004: Optional[str] = None
    bus_bankruptcy_summary_005: Optional[str] = None
    bus_bankruptcy_summary_006: Optional[str] = None


class Merchant(BaseDataPoolerModel):
    id: Optional[str] = Field(None, alias="id")
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    name: Optional[str] = None
    name_dba: Optional[str] = None
    store_id: Optional[str] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None
    domain_name: Optional[str] = None
    addr1: Optional[str] = None
    addr2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip5: Optional[str] = None
    zip4: Optional[str] = None
    dpc: Optional[str] = None
    ein: Optional[str] = None
    sic_code: Optional[str] = None
    addr_key: Optional[str] = None
    mak: Optional[str] = None
    created_by_lender_id: Optional[str] = None
    muid: Optional[str] = None


class NextBestMatch(BaseDataPoolerModel):
    merchant: Optional[Merchant] = None
    desc: Optional[str] = None
    score: Optional[float] = None
    brecs: Optional[int] = None
    hits: Optional[int] = None
    alg_class: Optional[str] = None
    name_score: Optional[float] = None
    addr_score: Optional[float] = None
    phone_score: Optional[float] = None
    ein_score: Optional[float] = None
    domain_score: Optional[float] = None


class SecretaryOfStateMerchant(BaseDataPoolerModel):
    name: Optional[str] = None
    filing_date: Optional[str] = None
    entity_type: Optional[dict[str, Any]] = Field(default_factory=dict)
    status: Optional[str] = None
    filing_state: Optional[str] = None
    inactive_date: Optional[str] = None
    sos_id: Optional[str] = None
    ein: Optional[str] = None
    industry: Optional[str] = None
    phone: Optional[str] = None
    url: Optional[str] = None
    tax_payer_number: Optional[str] = None
    state_of_formation: Optional[str] = None
    status_date: Optional[str] = None
    physical_addr1: Optional[str] = None
    physical_addr2: Optional[str] = None
    physical_city: Optional[str] = None
    physical_state: Optional[str] = None
    physical_zip5: Optional[str] = None
    physical_zip4: Optional[str] = None
    physical_dpc: Optional[str] = None
    physical_addr_key: Optional[str] = None
    mailing_addr1: Optional[str] = None
    mailing_addr2: Optional[str] = None
    mailing_city: Optional[str] = None
    mailing_state: Optional[str] = None
    mailing_zip5: Optional[str] = None
    mailing_zip4: Optional[str] = None
    mailing_dpc: Optional[str] = None
    mailing_addr_key: Optional[str] = None
    email: Optional[str] = None
    merchant: Optional[Any] = None
    lender_merchant: Optional[Any] = None

    @field_validator("entity_type", mode="before")
    def validate_entity_type(cls, v: dict[str, Any | None]) -> dict[str, Any] | None:
        return v if v and isinstance(v, dict) else None


class SecretaryOfState(BaseDataPoolerModel):
    merchant: Optional[SecretaryOfStateMerchant] = None
    principals: Optional[list[Any]] = None


class BljSummary(BaseDataPoolerModel):
    id: Optional[str] = Field(None, alias="id")
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    merchant: Optional[Any] = None
    business_token: Optional[str] = None
    lien_debtor_count: Optional[int] = None
    lien_holder_count: Optional[int] = None
    judgement_debtor_count: Optional[int] = None
    judgement_creditor_count: Optional[int] = None
    bankruptcy_subject_count: Optional[int] = None
    bankruptcy_creditor_count: Optional[int] = None
    lender_merchant: Optional[Any] = None


class Blj(BaseDataPoolerModel):
    summary: Optional[BljSummary] = None
    liens: Optional[list[Any]] = None
    judgements: Optional[list[Any]] = None
    bankruptcies: Optional[list[Any]] = None
    corp_filing: Optional[list[Any]] = None
    ucc: Optional[list[Any]] = None
    principal: Optional[list[Any]] = None


class PublicRecord(BaseDataPoolerModel):
    business_id: Optional[str] = None
    seller_id: Optional[str] = None
    dashboard_url: Optional[str] = None
    seller: Optional[Seller] = None
    match_score: Optional[MatchScore] = None
    principals: Optional[list[Any]] = None
    furnished_sources: Optional[list[Any]] = None
    public_sources: Optional[list[Any]] = None
    third_party_sources: Optional[list[Any]] = None
    regulatory_complaint_details: Optional[list[Any]] = None
    feature_store: Optional[list[dict[str, Any]]] = None
    scores: Optional[list[Any]] = None
    vrisk: Optional[list[Any]] = None
    scorecard_score: Optional[ScorecardScore] = None
    third_party_data: Optional[list[ThirdPartyDataItem]] = None
    parents: Optional[list[Any]] = None
    children: Optional[list[Any]] = None
    siblings: Optional[list[Any]] = None
    related_sellers: Optional[list[Any]] = None
    flagged_related_sellers: Optional[list[Any]] = None
    total_inquiry_count: Optional[int] = None
    inquiry_history: Optional[list[Any]] = None
    secretary_of_state: Optional[SecretaryOfState] = None
    blj: Optional[Blj] = None
    next_best_matches: Optional[list[NextBestMatch]] = None
