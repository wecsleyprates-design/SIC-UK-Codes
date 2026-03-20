from datapooler.models.integrations import rutter


def test_balance_sheet(rutter_balance_sheet_data):
    bl = rutter.BalanceSheetList.model_validate_json(rutter_balance_sheet_data)

    # test if model is accessible via index
    assert bl[0] is not None

    # test if model is accessible via iteration
    assert len(bl) > 0


def test_business_info(rutter_business_info_data):
    bi = rutter.BusinessInfo.model_validate_json(rutter_business_info_data)

    assert bi.id is not None
    assert bi.legal_name is not None
    assert bi.platform_id is not None
    assert bi.currency_code is not None
    assert bi.name is not None
    assert len(bi.addresses) > 0
    assert bi.additional_fields == {}


def test_cash_flow(rutter_cash_flow_data):
    cf = rutter.CashFlowList.model_validate_json(rutter_cash_flow_data)

    # test if model is accessible via index
    assert cf[0] is not None

    # test if model is accessible via iteration
    assert len(cf) > 0


def test_income_statement(rutter_income_statement_data):
    is_ = rutter.IncomeStatementList.model_validate_json(rutter_income_statement_data)

    # test if model is accessible via index
    assert is_[0] is not None

    # test if model is accessible via iteration
    assert len(is_) > 0
