import pytest

from datapooler.models import businesses
from datapooler.services import similarity


@pytest.fixture
def comparison_business(
    worth_businesses,
    equifax_businesses,
    open_corporate_businesses,
    zoominfo_businesses,
    canada_open_businesses,
):
    return businesses.ComparisonBusiness(
        worth=[*worth_businesses],
        equifax=[*equifax_businesses],
        open_corporate=[*open_corporate_businesses],
        zoominfo=[*zoominfo_businesses],
        canada_open=[*canada_open_businesses],
    )


@pytest.fixture
def comparison_business_perfect_match():
    return businesses.ComparisonBusiness(
        worth=[
            businesses.WorthBusiness(
                business_id="123",
                name="Some Business Name",
                address="123 Main St, Some City, Alabama 12345",
                state="ST",
                zip="12345",
                city="Some City",
                country="US",
            )
        ],
        equifax=[
            businesses.EquifaxBusiness(
                efx_id="123",
                name="Some Business Name",
                legal_name="Some Business Name",
                address="123 Main St, Some City, Alabama 12345",
                state="ST",
                zip="12345",
                city="Some City",
                contct="Some Contact",
                ceoname="Some CEO",
            )
        ],
        open_corporate=[
            businesses.OpenCorporateBusiness(
                company_number="123",
                name="Some Business Name",
                name_2="Some Business Name",
                address="421 Apple St, Some City, Alabama 12345",
                address_2="123 Main St, Some City, Alabama 12345",
                state="ST",
                zip="12345",
                city="Apple City",
                jurisdiction_code="123",
            )
        ],
        zoominfo=[
            businesses.ZoomInfoBusiness(
                company_id="123",
                location_id="123",
                es_location_id="123",
                name="Some Business Name",
                address="123 Main St, Some City, Alabama 12345",
                address_2="123 Main St, Some City, Alabama 12345",
                state="ST",
                zip="54321",
                city="Some City",
            )
        ],
        canada_open=[
            businesses.CanadaOpenBusiness(
                id="CA2",
                business_number="BN654321",
                current_name="Another Canada Biz",
                sanitized_name="Another Canada Biz",
                normalized_name="Another Canada Biz",
                other_names="Another Biz",
                normalized_address="456 Oak Ave",
                other_addresses="Suite 3, 456 Oak Ave",
                city="Montreal",
                region="Quebec",
                postal_code="H2X 1Y4",
                country="CA",
            )
        ],
    )


def test_similarity_feature_service_init(comparison_business):
    service = similarity.SimilarityFeatureService(comparison_business)
    assert service.businesses == comparison_business
    assert service.potential_matches == comparison_business.potential_matches()


@pytest.mark.parametrize(
    ["attribute", "outcome"],
    [
        ("match_normalized_zip", True),
        ("match_city", True),
        ("match_street_number", True),
        ("match_address", True),
    ],
)
def test_set_perfect_match_equifax(attribute, outcome, comparison_business_perfect_match):
    service = similarity.SimilarityFeatureService(comparison_business_perfect_match)
    service._set_perfect_match(
        comparison_business_perfect_match.worth[0],
        comparison_business_perfect_match.equifax[0],
    )
    assert (
        service.potential_matches[
            (
                comparison_business_perfect_match.worth[0],
                comparison_business_perfect_match.equifax[0],
            )
        ][attribute]
        is outcome
    )


@pytest.mark.parametrize(
    ["attribute", "outcome"],
    [
        ("match_normalized_zip", True),
        ("match_city", False),
        ("match_street_number", False),
        ("match_address", False),
    ],
)
def test_set_perfect_match_oc(attribute, outcome, comparison_business_perfect_match):
    service = similarity.SimilarityFeatureService(comparison_business_perfect_match)
    service._set_perfect_match(
        comparison_business_perfect_match.worth[0],
        comparison_business_perfect_match.open_corporate[0],
    )
    assert (
        service.potential_matches[
            (
                comparison_business_perfect_match.worth[0],
                comparison_business_perfect_match.open_corporate[0],
            )
        ][attribute]
        is outcome
    )


@pytest.mark.parametrize(
    ["attribute", "outcome"],
    [
        ("match_normalized_zip", False),
        ("match_city", True),
        ("match_street_number", True),
        ("match_address", True),
    ],
)
def test_set_perfect_match_zoominfo(attribute, outcome, comparison_business_perfect_match):
    service = similarity.SimilarityFeatureService(comparison_business_perfect_match)
    service._set_perfect_match(
        comparison_business_perfect_match.worth[0],
        comparison_business_perfect_match.zoominfo[0],
    )
    assert (
        service.potential_matches[
            (
                comparison_business_perfect_match.worth[0],
                comparison_business_perfect_match.zoominfo[0],
            )
        ][attribute]
        is outcome
    )


def test_set_block_matches(comparison_business_perfect_match):
    service = similarity.SimilarityFeatureService(comparison_business_perfect_match)
    service._set_block_matches(
        comparison_business_perfect_match.worth[0],
        comparison_business_perfect_match.equifax[0],
    )
    expected = (
        int(comparison_business_perfect_match.worth[0].street_number) // 100
        == int(comparison_business_perfect_match.equifax[0].street_number) // 100
    )
    assert (
        service.potential_matches[
            (
                comparison_business_perfect_match.worth[0],
                comparison_business_perfect_match.equifax[0],
            )
        ]["match_street_block"]
        == expected
    )


def test_set_short_name_match(comparison_business_perfect_match):
    service = similarity.SimilarityFeatureService(comparison_business_perfect_match)
    service._set_short_name_match(
        comparison_business_perfect_match.worth[0],
        comparison_business_perfect_match.equifax[0],
    )

    assert (
        service.potential_matches[
            (
                comparison_business_perfect_match.worth[0],
                comparison_business_perfect_match.equifax[0],
            )
        ]["match_short_name"]
        is True
    )


def test_set_numerical_distance(comparison_business_perfect_match):
    service = similarity.SimilarityFeatureService(comparison_business_perfect_match)
    service._set_numerical_distance(
        comparison_business_perfect_match.worth[0],
        comparison_business_perfect_match.equifax[0],
    )
    expected = abs(
        int(comparison_business_perfect_match.worth[0].street_number)
        - int(comparison_business_perfect_match.equifax[0].street_number)
    )
    assert (
        service.potential_matches[
            (
                comparison_business_perfect_match.worth[0],
                comparison_business_perfect_match.equifax[0],
            )
        ]["distance_street_number"]
        == expected
    )


def test_set_jac_similarity(comparison_business_perfect_match):
    service = similarity.SimilarityFeatureService(comparison_business_perfect_match)
    service._set_jac_similarity(
        comparison_business_perfect_match.worth[0],
        comparison_business_perfect_match.equifax[0],
    )

    for attr, (sim_name, norm_name) in similarity.JACCARD_SIMILARITY_ATTRIBUTES.items():
        worth_shingle = getattr(comparison_business_perfect_match.worth[0], f"{attr}_shingles")
        equifax_shingle = getattr(comparison_business_perfect_match.equifax[0], f"{attr}_shingles")

        for k in range(1, 5):
            expected_sim, expected_norm = similarity.SimilarityFeatureService(
                comparison_business_perfect_match
            ).calculate_jac_similarity(worth_shingle[f"k{k}"], equifax_shingle[f"k{k}"])
            assert (
                service.potential_matches[
                    (
                        comparison_business_perfect_match.worth[0],
                        comparison_business_perfect_match.equifax[0],
                    )
                ][f"{sim_name}_k{k}"]
                == expected_sim
            )
            assert (
                service.potential_matches[
                    (
                        comparison_business_perfect_match.worth[0],
                        comparison_business_perfect_match.equifax[0],
                    )
                ][f"{norm_name}_k{k}"]
                == expected_norm
            )


# NOTE: This test is important to enure all features are set on all business pairs.
@pytest.mark.parametrize("feature_name", similarity.SIMILARITY_FEATURES)
def test_set_features(feature_name, comparison_business):

    service = similarity.SimilarityFeatureService(comparison_business)

    assert service._been_set is False

    service.set_features()

    assert (
        feature_name
        in service.potential_matches[
            comparison_business.worth[0], comparison_business.equifax[0]
        ].keys()
    )
    assert (
        service.potential_matches[comparison_business.worth[0], comparison_business.equifax[0]][
            feature_name
        ]
        is not None
    )

    assert (
        feature_name
        in service.potential_matches[
            comparison_business.worth[0], comparison_business.open_corporate[0]
        ].keys()
    )
    assert (
        service.potential_matches[
            comparison_business.worth[0], comparison_business.open_corporate[0]
        ][feature_name]
        is not None
    )

    assert (
        feature_name
        in service.potential_matches[
            comparison_business.worth[0], comparison_business.zoominfo[0]
        ].keys()
    )
    assert (
        service.potential_matches[comparison_business.worth[0], comparison_business.zoominfo[0]][
            feature_name
        ]
        is not None
    )

    assert (
        feature_name
        in service.potential_matches[
            comparison_business.worth[0], comparison_business.canada_open[0]
        ].keys()
    )
    assert (
        service.potential_matches[comparison_business.worth[0], comparison_business.canada_open[0]][
            feature_name
        ]
        is not None
    )
    assert service._been_set is True


def test_set_features_full_payload_matches(comparison_business):

    service = similarity.SimilarityFeatureService(comparison_business)

    assert service._been_set is False

    service.set_features()

    for worth_business in comparison_business.worth:
        for equifax_business in comparison_business.equifax:
            for feature_name in similarity.SIMILARITY_FEATURES:
                assert (
                    feature_name
                    in service.potential_matches[worth_business, equifax_business].keys()
                )
                assert (
                    service.potential_matches[worth_business, equifax_business][feature_name]
                    is not None
                )

    assert service.potential_matches[worth_business, equifax_business] == {
        "match_normalized_zip": False,
        "match_city": False,
        "match_street_number": True,
        "match_address": False,
        "match_street_block": True,
        "match_short_name": False,
        "distance_street_number": 0,
        "similarity_jaccard_word": 0.5,
        "sim_norm_jac_word": 0.6666666666666666,
        "similarity_jaccard_k1": 0.47058823529411764,
        "sim_norm_jac_k1": 0.6666666666666666,
        "similarity_jaccard_k2": 0.45454545454545453,
        "sim_norm_jac_k2": 0.6666666666666666,
        "similarity_jaccard_k3": 0.42857142857142855,
        "sim_norm_jac_k3": 0.6428571428571429,
        "similarity_jaccard_k4": 0.4,
        "sim_norm_jac_k4": 0.6153846153846154,
        "similarity_street_name_k1": 0.4444444444444444,
        "sim_norm_street_name_k1": 0.6666666666666666,
        "similarity_street_name_k2": 0.2222222222222222,
        "sim_norm_street_name_k2": 0.4,
        "similarity_street_name_k3": 0.125,
        "sim_norm_street_name_k3": 0.25,
        "similarity_street_name_k4": 0.0,
        "sim_norm_street_name_k4": 0.0,
        "similarity_short_name_k1": 0.4375,
        "sim_norm_short_name_k1": 0.6363636363636364,
        "similarity_short_name_k2": 0.4,
        "sim_norm_short_name_k2": 0.6153846153846154,
        "similarity_short_name_k3": 0.3684210526315789,
        "sim_norm_short_name_k3": 0.5833333333333334,
        "similarity_short_name_k4": 0.3333333333333333,
        "sim_norm_short_name_k4": 0.5454545454545454,
    }
