from datapooler.models.integrations import plaid


def test_plaid_asset_report(plaid_assests_report_data):
    ar = plaid.AssetReport.model_validate_json(plaid_assests_report_data)

    assert ar is not None
    assert ar.asset_report_id is not None
