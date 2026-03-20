from datapooler.models.integrations import verdata


def test_public_records(verdata_public_records_data):
    public_record = verdata.PublicRecord.model_validate_json(verdata_public_records_data)

    assert public_record.seller_id is not None
