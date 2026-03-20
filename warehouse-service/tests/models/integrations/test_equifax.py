from datapooler.models.integrations import equifax


def test_judgements_and_liens(equifax_judgements_liens_data):
    judgements_liens = equifax.JudgementsLiens.model_validate_json(equifax_judgements_liens_data)

    assert judgements_liens.efx_id is not None
