import pytest

from datapooler.adapters import sessions
from datapooler.adapters.db import models
from datapooler.models import businesses
from datapooler.services import match
from datapooler.web.routers.matching import models as matching_models


@pytest.fixture
def seed_request_with_results(seed_request):
    """Fixture that creates a seed request with match results from multiple sources."""
    # Create match results in the database
    match_result_1 = models.MatchResultDb(
        match_id=seed_request,
        business_id="business_id",
        source="equifax",
        match={"name": "Test Business 1", "address": "123 Test St"},
        prediction=0.85,
    )
    match_result_2 = models.MatchResultDb(
        match_id=seed_request,
        business_id="business_id",
        source="equifax",
        match={"name": "Test Business 2", "address": "456 Test Ave"},
        prediction=0.75,
    )
    match_result_3 = models.MatchResultDb(
        match_id=seed_request,
        business_id="business_id",
        source="zoominfo",
        match={"name": "Test Business 3", "address": "789 Test Blvd"},
        prediction=0.90,
    )

    with sessions.TransactionalSessions.get_session() as session:
        session.add_all([match_result_1, match_result_2, match_result_3])
        session.commit()

    return seed_request


def test_create_request_payload(start_matching_request):
    """Test MatchService create_request_payload method."""
    match_request = match.MatchService.create_request(
        business_id="123",
        names=["name1", "name2"],
        addresses=[
            businesses.BusinessAddress(
                address="123 Main St",
                city="Los Angeles",
                state="CA",
                zip="12345",
                country="US",
            )
        ],
        extra=businesses.ExtraInfo(npi="1234567890", first_name="John", last_name="Doe"),
    )

    assert match_request.created_at is not None
    assert match_request.updated_at is not None
    assert match_request.match_id is not None
    assert match_request.business_id == "123"
    assert match_request.names == ["name1", "name2"]
    assert match_request.addresses == [
        {
            "address": "123 Main St",
            "city": "Los Angeles",
            "state": "CA",
            "zip": "12345",
            "country": "US",
        }
    ]
    assert match_request.status == "pending"


def test_get_request(seed_request):
    """Test MatchService get_request method."""
    match_request = match.MatchService.get_request(match_id=seed_request)
    assert match_request.match_id == seed_request
    assert match_request.names == ["name1", "name2"]
    assert match_request.addresses == [
        {
            "address": "123 Main St",
            "city": "Los Angeles",
            "state": "CA",
            "zip": "12345",
            "country": "US",
        }
    ]
    assert match_request.status == "pending"

    validated_request = matching_models.MatchResponse.model_validate(
        match_request, from_attributes=True
    )
    assert validated_request.match_id == seed_request
    assert validated_request.names == ["name1", "name2"]
    assert validated_request.addresses[0].model_dump() == {
        "address": "123 Main St",
        "city": "Los Angeles",
        "state": "CA",
        "zip": "12345",
        "country": "US",
    }
    assert validated_request.status == "pending"


@pytest.mark.parametrize("persist", [True, False])
def test_match_service_equifax(seed_request, mock_equifax_repository, worth_businesses, persist):
    """Test MatchService with different repository mocks."""
    match_service = match.MatchService(
        match_id=seed_request, businesses=[*worth_businesses], integration="equifax"
    )
    assert len(match_service.create_matches(persist=persist, firmographics=False).matches) == 3
    assert match_service._persisted_db is persist
    assert match_service._persisted_kafka is persist
    assert match_service.get_request(match_id=seed_request).status == "completed"


@pytest.mark.parametrize("persist", [True, False])
def test_match_service_canada_open(
    seed_request, mock_canada_open_repository, worth_businesses, persist
):
    """Test MatchService with CanadaOpenBusiness repository mocks."""
    match_service = match.MatchService(
        match_id=seed_request,
        businesses=[*worth_businesses],
        integration="canada_open",
    )
    assert len(match_service.create_matches(persist=persist, firmographics=False).matches) == 3
    assert match_service._persisted_db is persist
    assert match_service._persisted_kafka is persist
    assert match_service.get_request(match_id=seed_request).status == "completed"


@pytest.mark.parametrize("persist", [True, False])
def test_match_service_zoominfo(seed_request, mock_zoominfo_repository, worth_businesses, persist):
    """Test MatchService with different repository mocks."""
    match_service = match.MatchService(
        match_id=seed_request, businesses=[*worth_businesses], integration="zoominfo"
    )
    assert len(match_service.create_matches(persist=persist, firmographics=False).matches) == 3
    assert match_service._persisted_db is persist
    assert match_service._persisted_kafka is persist
    assert match_service.get_request(match_id=seed_request).status == "completed"


@pytest.mark.parametrize("persist", [True, False])
def test_match_service_open_corporate(
    seed_request, mock_open_corporate_repository, worth_businesses, persist
):
    """Test MatchService with different repository mocks."""
    match_service = match.MatchService(
        match_id=seed_request, businesses=[*worth_businesses], integration="open_corporate"
    )
    assert len(match_service.create_matches(persist=persist, firmographics=False).matches) == 3
    assert match_service._persisted_db is persist
    assert match_service._persisted_kafka is persist
    assert match_service.get_request(match_id=seed_request).status == "completed"


@pytest.mark.parametrize("integration", [None, "equifax"])
def test_match_service_get_results(integration):
    # First create a match request due to foreign key constraint
    with sessions.TransactionalSessions.get_session() as session:
        match_request = models.MatchRequestDb(
            match_id="123",
            business_id="123",
            status="pending",
            names=["Test Business"],
            addresses=[
                {
                    "address": "123 Main St",
                    "city": "LA",
                    "state": "CA",
                    "zip": "12345",
                    "country": "US",
                }
            ],
        )
        session.add(match_request)
        session.commit()

    match_result_1 = models.MatchResultDb(
        match_id="123",
        business_id="123",
        source="equifax",
        match={"key": "value"},
        prediction=0.5,
    )

    match_result_2 = models.MatchResultDb(
        match_id="123",
        business_id="123",
        source="zoominfo",
        match={"key": "value"},
        prediction=0.5,
    )

    with sessions.TransactionalSessions.get_session() as session:
        session.add_all([match_result_1, match_result_2])
        session.commit()

    match_result = match.MatchService.get_results(match_id="123", integration=integration)

    assert len(match_result["matches"]) == 1 if integration else 2


@pytest.mark.parametrize(
    "integration, businesses, outcome",
    [
        (
            "equifax",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="123",
                        name="Business 1",
                        address="123 Main St",
                        state="CA",
                        zip="90001",
                        city="Los Angeles",
                        country="US",
                    )
                ]
            ),
            False,
        ),
        (
            "zoominfo",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="124",
                        name="Business 2",
                        address="124 Main St",
                        state="CA",
                        zip="90002",
                        city="Los Angeles",
                        country="US",
                    )
                ]
            ),
            False,
        ),
        (
            "open_corporate",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="125",
                        name="Business 3",
                        address="125 Main St",
                        state="CA",
                        zip="90003",
                        city="Los Angeles",
                        country="US",
                    )
                ]
            ),
            False,
        ),
        (
            "canada_open",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="126",
                        name="Business 4",
                        address="126 Main St",
                        state="CA",
                        zip="90004",
                        city="Los Angeles",
                        country="US",
                    )
                ]
            ),
            True,
        ),
        (
            "equifax",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="123",
                        name="Business 1",
                        address="123 Main St",
                        state="CA",
                        zip="90001",
                        city="Los Angeles",
                        country="GB",
                    )
                ]
            ),
            True,
        ),
        (
            "zoominfo",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="124",
                        name="Business 2",
                        address="124 Main St",
                        state="CA",
                        zip="90002",
                        city="Los Angeles",
                        country="GB",
                    )
                ]
            ),
            False,
        ),
        (
            "open_corporate",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="125",
                        name="Business 3",
                        address="125 Main St",
                        state="CA",
                        zip="90003",
                        city="Los Angeles",
                        country="GB",
                    )
                ]
            ),
            False,
        ),
        (
            "canada_open",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="126",
                        name="Business 4",
                        address="126 Main St",
                        state="CA",
                        zip="90004",
                        city="Los Angeles",
                        country="GB",
                    )
                ]
            ),
            True,
        ),
        (
            "open_corporate",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="127",
                        name="Business 5",
                        address="127 Main St",
                        state="CA",
                        zip="90005",
                        city="Los Angeles",
                        country="GB",
                    )
                ]
            ),
            False,
        ),
        # Canandian Businesses
        (
            "equifax",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="128",
                        name="Canadian Business",
                        address="128 Main St",
                        state="Ontario",
                        zip="M5H 2N2",
                        city="Toronto",
                        country="CA",
                    )
                ]
            ),
            True,
        ),
        (
            "zoominfo",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="129",
                        name="Canadian Business 2",
                        address="129 Main St",
                        state="Ontario",
                        zip="M5H 2N2",
                        city="Toronto",
                        country="CA",
                    )
                ]
            ),
            False,
        ),
        (
            "open_corporate",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="130",
                        name="Canadian Business 3",
                        address="130 Main St",
                        state="Ontario",
                        zip="M5H 2N2",
                        city="Toronto",
                        country="CA",
                    )
                ]
            ),
            False,
        ),
        (
            "canada_open",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="131",
                        name="Canadian Business 4",
                        address="131 Main St",
                        state="Ontario",
                        zip="M5H 2N2",
                        city="Toronto",
                        country="CA",
                    )
                ]
            ),
            False,
        ),
        (
            "equifax",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="132",
                        name="Irish Business",
                        address="132 Main St",
                        state="Dublin",
                        zip="D02 F345",
                        city="Dublin",
                        country="IE",
                    )
                ]
            ),
            True,
        ),
        (
            "zoominfo",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="133",
                        name="Irish Business 2",
                        address="133 Main St",
                        state="Dublin",
                        zip="D02 F345",
                        city="Dublin",
                        country="IE",
                    )
                ]
            ),
            False,
        ),
        (
            "open_corporate",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="134",
                        name="Irish Business 3",
                        address="134 Main St",
                        state="Dublin",
                        zip="D02 F345",
                        city="Dublin",
                        country="IE",
                    )
                ]
            ),
            False,
        ),
        (
            "canada_open",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="135",
                        name="Irish Business 4",
                        address="135 Main St",
                        state="Dublin",
                        zip="D02 F345",
                        city="Dublin",
                        country="IE",
                    )
                ]
            ),
            True,
        ),
        (
            "npi",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="136",
                        name="NPI Business",
                        address="136 Main St",
                        state="CA",
                        zip="90006",
                        city="Los Angeles",
                        country="US",
                        extra=businesses.ExtraInfo(
                            first_name="John",
                            last_name="Doe",
                            npi="1234567890",
                        ),
                    )
                ]
            ),
            False,
        ),
        (
            "npi",
            businesses.WorthBusinessList(
                [
                    businesses.WorthBusiness(
                        business_id="138",
                        name="NPI Business 3",
                        address="138 Main St",
                        state="CA",
                        zip="90008",
                        city="Los Angeles",
                        country="CA",
                        extra=businesses.ExtraInfo(
                            first_name="John",
                            last_name=None,
                            npi="1234567890",
                        ),
                    )
                ]
            ),
            True,
        ),
    ],
)
def test_abort_matching_integration(integration, businesses, outcome):
    assert (
        match.MatchService.abort_matching_integration(
            businesses=businesses, integration=integration
        )
        is outcome
    )


def test_match_result_from_db_models(seed_request_with_results):
    """Test MatchResult.from_db_models method."""
    # Get the match request with results loaded
    with sessions.TransactionalSessions.get_session() as session:
        from sqlalchemy.orm import selectinload

        match_request = (
            session.query(models.MatchRequestDb)
            .filter_by(match_id=seed_request_with_results)
            .options(selectinload(models.MatchRequestDb.match_results))
            .one()
        )

        # Convert to domain objects
        results = match.MatchResult.from_db_models(match_request=match_request)

    # Verify results are grouped by source
    assert len(results) == 2  # Two sources: equifax and zoominfo

    # Find equifax and zoominfo results
    equifax_result = next(r for r in results if r.source == "equifax")
    zoominfo_result = next(r for r in results if r.source == "zoominfo")

    # Verify equifax results
    assert equifax_result.match_id == seed_request_with_results
    assert equifax_result.business_id == "business_id"
    assert len(equifax_result.matches) == 2
    assert equifax_result.matches[0].prediction in [0.85, 0.75]
    assert equifax_result.matches[1].prediction in [0.85, 0.75]

    # Verify zoominfo results
    assert zoominfo_result.match_id == seed_request_with_results
    assert zoominfo_result.business_id == "business_id"
    assert len(zoominfo_result.matches) == 1
    assert zoominfo_result.matches[0].prediction == 0.90


def test_get_requests_with_results_latest_only(seed_request):
    """Test get_requests_with_results with latest_only=True."""
    # Add match results to the request
    match_result = models.MatchResultDb(
        match_id=seed_request,
        business_id="business_id",
        source="equifax",
        match={"name": "Test Business"},
        prediction=0.85,
    )

    with sessions.TransactionalSessions.get_session() as session:
        session.add(match_result)
        # Update status to completed
        match_request = session.query(models.MatchRequestDb).filter_by(match_id=seed_request).one()
        match_request.status = "completed"
        session.commit()

    # Get requests with results
    results = match.MatchService.get_requests_with_results(
        business_id="business_id", latest_only=True
    )

    assert results is not None
    assert len(results) == 1

    request, match_results = next(iter(results.items()))
    assert request.match_id == seed_request
    assert len(match_results) == 1
    assert match_results[0].source == "equifax"


def test_get_requests_with_results_multiple_requests():
    """Test get_requests_with_results with multiple requests."""
    # Create multiple match requests
    with sessions.TransactionalSessions.get_session() as session:
        request1 = models.MatchRequestDb(
            match_id="match_1",
            business_id="business_id",
            status="completed",
            names=["Business 1"],
            addresses=[
                {
                    "address": "123 Main St",
                    "city": "LA",
                    "state": "CA",
                    "zip": "12345",
                    "country": "US",
                }
            ],
        )
        request2 = models.MatchRequestDb(
            match_id="match_2",
            business_id="business_id",
            status="completed",
            names=["Business 2"],
            addresses=[
                {
                    "address": "456 Oak St",
                    "city": "LA",
                    "state": "CA",
                    "zip": "12346",
                    "country": "US",
                }
            ],
        )
        session.add_all([request1, request2])
        session.commit()

        # Add match results
        result1 = models.MatchResultDb(
            match_id="match_1",
            business_id="business_id",
            source="equifax",
            match={"name": "Business 1"},
            prediction=0.80,
        )
        result2 = models.MatchResultDb(
            match_id="match_2",
            business_id="business_id",
            source="zoominfo",
            match={"name": "Business 2"},
            prediction=0.90,
        )
        session.add_all([result1, result2])
        session.commit()

    # Get all requests
    results = match.MatchService.get_requests_with_results(
        business_id="business_id", latest_only=False
    )

    assert results is not None
    assert len(results) == 2


def test_get_requests_with_results_no_results():
    """Test get_requests_with_results when no completed requests exist."""
    results = match.MatchService.get_requests_with_results(
        business_id="nonexistent_business", latest_only=True
    )

    assert results is None


def test_get_requests_with_results_order_by_updated_at():
    """Test get_requests_with_results with order_by updated_at."""
    import datetime

    with sessions.TransactionalSessions.get_session() as session:
        request1 = models.MatchRequestDb(
            match_id="match_1",
            business_id="business_id",
            status="completed",
            names=["Business 1"],
            addresses=[
                {
                    "address": "123 Main St",
                    "city": "LA",
                    "state": "CA",
                    "zip": "12345",
                    "country": "US",
                }
            ],
        )
        session.add(request1)
        session.commit()

        # Update the request to set updated_at
        request1.updated_at = datetime.datetime.now(datetime.timezone.utc)
        session.commit()

        # Add match result
        result1 = models.MatchResultDb(
            match_id="match_1",
            business_id="business_id",
            source="equifax",
            match={"name": "Business 1"},
            prediction=0.80,
        )
        session.add(result1)
        session.commit()

    results = match.MatchService.get_requests_with_results(
        business_id="business_id", latest_only=True, order_by="updated_at"
    )

    assert results is not None


def test_get_requests_with_results_invalid_order_by():
    """Test get_requests_with_results with invalid order_by parameter."""
    with pytest.raises(ValueError, match="order_by must be 'created_at' or 'updated_at'"):
        match.MatchService.get_requests_with_results(
            business_id="business_id", order_by="invalid_column"
        )


def test_ensure_match_request_with_publish_no_existing():
    """Test ensure_match_request_with_publish when no existing request exists."""
    reused, match_request = match.MatchService.ensure_match_request_with_publish(
        business_id="new_business",
        names=["New Business"],
        addresses=[
            businesses.BusinessAddress(
                address="123 New St",
                city="Los Angeles",
                state="CA",
                zip="12345",
                country="US",
            )
        ],
        extra=businesses.ExtraInfo(npi="1234567890"),
    )

    assert reused is False
    assert match_request is not None
    assert match_request.business_id == "new_business"
    assert match_request.names == ["New Business"]


def test_ensure_match_request_with_publish_with_matching_existing(
    seed_request, mock_kafka_messaging
):
    # First update the seed request to have extra field and complete it
    with sessions.TransactionalSessions.get_session() as session:
        request = session.query(models.MatchRequestDb).filter_by(match_id=seed_request).one()
        request.status = "completed"
        request.extra = {"first_name": None, "last_name": None}

        # Add a match result
        result = models.MatchResultDb(
            match_id=seed_request,
            business_id="business_id",
            source="equifax",
            match={"name": "Test Business"},
            prediction=0.85,
        )
        session.add(result)
        session.commit()

    reused, match_request = match.MatchService.ensure_match_request_with_publish(
        business_id="business_id",
        names=["name1", "name2"],
        addresses=[
            businesses.BusinessAddress(
                address="123 Main St",
                city="Los Angeles",
                state="CA",
                zip="12345",
                country="US",
            )
        ],
        extra=businesses.ExtraInfo(),
    )
    # Confirmed if names, addresses, and extra match the existing request, we reuse it
    assert reused is True
    assert match_request is not None
    assert match_request.business_id == "business_id"


def test_ensure_match_request_with_publish_with_different_params(seed_request):
    """Test ensure_match_request_with_publish when existing request has different params."""
    # Complete the existing request
    with sessions.TransactionalSessions.get_session() as session:
        request = session.query(models.MatchRequestDb).filter_by(match_id=seed_request).one()
        request.status = "completed"
        session.commit()

    # Try to create a request with different parameters
    reused, match_request = match.MatchService.ensure_match_request_with_publish(
        business_id="business_id",
        names=["Different Name"],  # Different name
        addresses=[
            businesses.BusinessAddress(
                address="123 Main St",
                city="Los Angeles",
                state="CA",
                zip="12345",
                country="US",
            )
        ],
        extra=businesses.ExtraInfo(),
    )

    assert reused is False
    assert match_request.match_id != seed_request


def test_publish_results():
    """Test publish_results static method."""
    match_result = match.MatchResult(
        match_id="test_match_id",
        business_id="test_business_id",
        matches=[],
        source="equifax",
    )

    # Should not raise any exceptions
    match.MatchService.publish_results(match_result)


def test_business_address_from_list():
    """Test BusinessAddress.from_list class method."""
    addresses_data = [
        {
            "address": "123 Main St",
            "city": "Los Angeles",
            "state": "CA",
            "zip": "12345",
            "country": "US",
        },
        {
            "address": "456 Oak Ave",
            "city": "San Francisco",
            "state": "CA",
            "zip": "94102",
            "country": "US",
        },
    ]

    addresses = businesses.BusinessAddress.from_list(addresses_data)

    assert len(addresses) == 2
    assert isinstance(addresses[0], businesses.BusinessAddress)
    assert addresses[0].address == "123 Main St"
    assert addresses[0].city == "Los Angeles"
    assert isinstance(addresses[1], businesses.BusinessAddress)
    assert addresses[1].address == "456 Oak Ave"


def test_business_address_from_list_invalid():
    """Test BusinessAddress.from_list with invalid data."""
    invalid_data = [
        {
            "address": "123 Main St",
            # Missing required fields
        }
    ]

    with pytest.raises(Exception):  # Pydantic will raise validation error
        businesses.BusinessAddress.from_list(invalid_data)
