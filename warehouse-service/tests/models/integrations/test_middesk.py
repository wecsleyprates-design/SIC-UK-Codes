from datapooler.models.integrations import middesk


def test_middesk_base_data_pooler_model(middesk_business_entity_verification_data):
    bev_model = middesk.BusinessEntityVerification.model_validate_json(
        middesk_business_entity_verification_data
    )

    assert bev_model.business_id is not None
    assert bev_model.tin is not None

    # Sometimes the payload can have tin in a dict, this checks that its been properly extracted.
    assert bev_model.tin.tin is not None
