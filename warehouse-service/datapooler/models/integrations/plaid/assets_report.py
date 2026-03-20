from datetime import datetime
from typing import List, Optional

from datapooler.models import BaseDataPoolerModel


class AddressData(BaseDataPoolerModel):
    city: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    region: Optional[str] = None
    street: Optional[str] = None


class Address(BaseDataPoolerModel):
    data: Optional[AddressData] = None
    primary: Optional[bool] = None


class Email(BaseDataPoolerModel):
    data: Optional[str] = None
    primary: Optional[bool] = None
    type: Optional[str] = None


class PhoneNumber(BaseDataPoolerModel):
    data: Optional[str] = None
    primary: Optional[bool] = None
    type: Optional[str] = None


class Owner(BaseDataPoolerModel):
    addresses: Optional[List[Address]] = None
    emails: Optional[List[Email]] = None
    names: Optional[List[str]] = None
    phone_numbers: Optional[List[PhoneNumber]] = None


class Balance(BaseDataPoolerModel):
    available: Optional[float] = None
    current: Optional[float] = None
    iso_currency_code: Optional[str] = None
    limit: Optional[float] = None
    margin_loan_amount: Optional[float] = None
    unofficial_currency_code: Optional[str] = None


class HistoricalBalance(BaseDataPoolerModel):
    current: Optional[float] = None
    date: Optional[datetime] = None
    iso_currency_code: Optional[str] = None
    unofficial_currency_code: Optional[str] = None


class Location(BaseDataPoolerModel):
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    postal_code: Optional[str] = None
    region: Optional[str] = None
    store_number: Optional[str] = None


class PaymentMeta(BaseDataPoolerModel):
    by_order_of: Optional[str] = None
    payee: Optional[str] = None
    payer: Optional[str] = None
    payment_method: Optional[str] = None
    payment_processor: Optional[str] = None
    ppd_id: Optional[str] = None
    reason: Optional[str] = None
    reference_number: Optional[str] = None


class Transaction(BaseDataPoolerModel):
    account_id: Optional[str] = None
    account_owner: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[List[str]] = None
    category_id: Optional[str] = None
    check_number: Optional[str] = None
    credit_category: Optional[dict] = None
    date: Optional[datetime] = None
    date_transacted: Optional[datetime] = None
    iso_currency_code: Optional[str] = None
    location: Optional[Location] = None
    merchant_name: Optional[str] = None
    name: Optional[str] = None
    original_description: Optional[str] = None
    payment_meta: Optional[PaymentMeta] = None
    pending: Optional[bool] = None
    pending_transaction_id: Optional[str] = None
    transaction_id: Optional[str] = None
    transaction_type: Optional[str] = None
    unofficial_currency_code: Optional[str] = None


class Account(BaseDataPoolerModel):
    account_id: Optional[str] = None
    balances: Optional[Balance] = None
    days_available: Optional[int] = None
    historical_balances: Optional[List[HistoricalBalance]] = None
    mask: Optional[str] = None
    name: Optional[str] = None
    official_name: Optional[str] = None
    owners: Optional[List[Owner]] = None
    ownership_type: Optional[str] = None
    subtype: Optional[str] = None
    transactions: Optional[List[Transaction]] = None


class Item(BaseDataPoolerModel):
    accounts: Optional[List[Account]] = None


class AssetReport(BaseDataPoolerModel):
    business_id: Optional[str] = None
    asset_report_id: Optional[str] = None
    environment: Optional[str] = None
    client_report_id: Optional[str] = None
    date_generated: Optional[datetime] = None
    days_requested: Optional[int] = None
    items: Optional[List[Item]] = None
    report_type: Optional[str] = None
    webhook_code: Optional[str] = None
    webhook_type: Optional[str] = None
