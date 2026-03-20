import pytest

from datapooler.models import businesses
from datapooler.services import similarity


@pytest.fixture
def comparison_business(
    worth_businesses, equifax_businesses, open_corporate_businesses, zoominfo_businesses
):
    return businesses.ComparisonBusiness(
        worth=[*worth_businesses],
        equifax=[*equifax_businesses],
        open_corporate=[*open_corporate_businesses],
        zoominfo=[*zoominfo_businesses],
    )


@pytest.fixture
def simple_comparison_business(worth_businesses):
    business_1, business_2 = worth_businesses
    return businesses.SimpleComparisonBusiness(worth=business_1, other=business_2)


@pytest.fixture
def comparison_businesses_w_features(comparison_business):
    service = similarity.SimilarityFeatureService(comparison_business)
    service.set_features()

    return service.potential_matches


@pytest.fixture
def model_service():
    return similarity.SimilarityModelService()


def test_similarity_model_service_init(model_service):
    assert model_service


def test_similarity_model_service_predict_one(model_service, worth_businesses):
    business_1, business_2 = worth_businesses
    result = model_service.predict_one(business_1, business_2)

    assert isinstance(result, similarity.SimilarityResult)
    assert result.prediction >= 0.0 and result.prediction <= 1.0
    assert business_2.name == result.integration_business["name"]
    assert result.extra_verification.name_match is None
    assert result.extra_verification.npi_match is None
