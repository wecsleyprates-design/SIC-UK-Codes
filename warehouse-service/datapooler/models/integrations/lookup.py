from typing import Union

from datapooler.models.integrations import equifax, middesk, plaid, rutter, verdata

type AnyIntegrationModel = Union[
    rutter.BalanceSheetList,
    rutter.BusinessInfo,
    rutter.CashFlowList,
    rutter.IncomeStatementList,
    middesk.BusinessEntityVerification,
    equifax.JudgementsLiens,
    verdata.PublicRecord,
    plaid.AssetReport,
]

type AnyIterableIntegrationModel = Union[
    rutter.BalanceSheetList,
    rutter.CashFlowList,
    rutter.IncomeStatementList,
]

any_integration_model = (
    rutter.BalanceSheetList,
    rutter.BusinessInfo,
    rutter.CashFlowList,
    rutter.IncomeStatementList,
    middesk.BusinessEntityVerification,
    equifax.JudgementsLiens,
    verdata.PublicRecord,
    plaid.AssetReport,
)

any_iterable_integration_model = (
    rutter.BalanceSheetList,
    rutter.CashFlowList,
    rutter.IncomeStatementList,
)


def is_any_integration_model(obj: AnyIntegrationModel) -> bool:
    return isinstance(obj, any_integration_model)


def is_iterable_integration_model(obj: AnyIntegrationModel) -> bool:
    return isinstance(obj, any_iterable_integration_model)


INTEGRATION_MODEL_MAP = {
    "accounting": {"rutter": ["balancesheet", "business_info", "cashflow", "incomestatement"]},
    "business_entity_verification": {"MIDDESK": ["business_entity_verification"]},
    "credit_bureau": {"EQUIFAX": ["judgementsLiens"]},
    "public_records": {"verdata": ["public_records"]},
}


def model_lookup(category: str, integration: str, name: str) -> AnyIntegrationModel:
    match category:
        case "accounting":
            match integration:
                case "rutter":
                    match name:
                        case "balancesheet":
                            return rutter.BalanceSheetList
                        case "business_info":
                            return rutter.BusinessInfo
                        case "cashflow":
                            return rutter.CashFlowList
                        case "incomestatement":
                            return rutter.IncomeStatementList
        case "business_entity_verification":
            match integration:
                case "MIDDESK":
                    match name:
                        case "business_entity_verification":
                            return middesk.BusinessEntityVerification
        case "credit_bureau":
            match integration:
                case "EQUIFAX":
                    match name:
                        case "judgementsLiens":
                            return equifax.JudgementsLiens
        case "public_records":
            match integration:
                case "verdata":
                    match name:
                        case "public_records":
                            return verdata.PublicRecord
