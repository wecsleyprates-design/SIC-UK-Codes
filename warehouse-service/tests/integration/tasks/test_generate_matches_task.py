import pytest

from datapooler import tasks
from datapooler.models.businesses import BusinessAddress
from datapooler.web.routers.matching.models import MatchRequest


@pytest.fixture
def match_request_data():
    return MatchRequest(
        business_id="business_id",
        names=["business1", "business2"],
        addresses=[
            BusinessAddress(
                address="123 Main St", city="Los Angeles", state="CA", zip="12345", country="US"
            ),
            BusinessAddress(
                address="456 Main St", city="Los Angeles", state="CA", zip="12345", country="US"
            ),
        ],
    )


@pytest.fixture
def match_request_data_ca():
    return MatchRequest(
        business_id="business_id",
        names=["business1", "business2"],
        addresses=[
            BusinessAddress(
                address="123 Main St", city="Toronto", state="Ontario", zip="A1B 2C3", country="CA"
            ),
            BusinessAddress(
                address="456 Main St", city="Toronto", state="Ontario", zip="A1B 2C3", country="CA"
            ),
        ],
    )


@pytest.fixture
def match_request_data_uk():
    return MatchRequest(
        business_id="business_id",
        names=["business1", "business2"],
        addresses=[
            BusinessAddress(
                address="123 High St", city="London", state="England", zip="SW1A 1AA", country="GB"
            ),
            BusinessAddress(
                address="456 High St", city="London", state="England", zip="SW1A 1AA", country="GB"
            ),
        ],
    )


@pytest.mark.parametrize("integration", ["equifax", "open_corporate", "zoominfo", "canada_open"])
def test_generate_matches_task(
    seed_request,
    match_request_data,
    mock_equifax_repository,
    mock_zoominfo_repository,
    mock_open_corporate_repository,
    mock_canada_open_repository,
    integration,
):
    matches, outcome = tasks.generate_matches_task.run(
        match_id=seed_request,
        request=match_request_data.model_dump(),
        integration=integration,
        persist=True,
        firmographics=False,
    )

    if integration in ["equifax", "zoominfo", "open_corporate"]:
        assert outcome
        assert matches == 3

    else:
        assert outcome is False
        assert matches is None


@pytest.mark.parametrize("integration", ["equifax", "open_corporate", "zoominfo", "canada_open"])
def test_generate_matches_task_ca(
    seed_request_ca,
    match_request_data_ca,
    mock_equifax_repository,
    mock_zoominfo_repository,
    mock_open_corporate_repository,
    mock_canada_open_repository,
    integration,
):
    matches, outcome = tasks.generate_matches_task.run(
        match_id=seed_request_ca,
        request=match_request_data_ca.model_dump(),
        integration=integration,
        persist=True,
        firmographics=False,
    )

    if integration in ["zoominfo", "open_corporate", "canada_open"]:
        assert outcome
        assert matches == 3

    else:
        assert outcome is False
        assert matches is None


@pytest.mark.parametrize("integration", ["equifax", "open_corporate", "zoominfo", "canada_open"])
def test_generate_matches_task_uk(
    seed_request_uk,
    match_request_data_uk,
    mock_equifax_repository,
    mock_zoominfo_repository,
    mock_open_corporate_repository,
    mock_canada_open_repository,
    integration,
):
    matches, outcome = tasks.generate_matches_task.run(
        match_id=seed_request_uk,
        request=match_request_data_uk.model_dump(),
        integration=integration,
        persist=True,
        firmographics=False,
    )

    if integration in ["zoominfo", "open_corporate"]:
        assert outcome
        assert matches == 3

    else:
        assert outcome is False
        assert matches is None
