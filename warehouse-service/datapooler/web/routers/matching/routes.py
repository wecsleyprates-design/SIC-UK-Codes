from typing import Annotated

from fastapi import APIRouter, HTTPException

from datapooler import tasks
from datapooler.services import match, similarity
from datapooler.web.routers.matching.models import (
    ConfidenceComparisonRequest,
    MatchesResponse,
    MatchRequest,
    MatchResponse,
)

router = APIRouter(prefix="/matching", tags=["matching"])


# Loads the model at startup
similarity_model_service = similarity.SimilarityModelService()


@router.post("/match", response_model=MatchResponse)
async def generate_matches(request: MatchRequest) -> MatchResponse:
    reused, match_request = match.MatchService.ensure_match_request_with_publish(
        request.business_id, request.names, request.addresses, request.extra
    )

    # If we found a pre-existing match request with results that matches the incoming request,
    # we can return it immediately without re-running the matching process
    if reused:
        return MatchResponse(
            business_id=request.business_id,
            match_id=match_request.match_id,
            status=match_request.status,
            names=match_request.names,
            addresses=match_request.addresses,
        )

    try:
        for integration in match.IntegrationEnum:
            tasks.generate_matches_task.delay(
                match_request.match_id, request.model_dump(), integration.value
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creating tasks for {match_request.match_id} with {e.name}",
        )

    return MatchResponse(
        business_id=request.business_id,
        match_id=match_request.match_id,
        status=match_request.status,
        names=match_request.names,
        addresses=match_request.addresses,
    )


@router.get("/results/{match_id}", response_model=MatchesResponse)
async def get_match_results(
    match_id: str,
    integration: Annotated[str | None, f"One of {', '.join(match.IntegrationEnum)}"] = None,
) -> MatchesResponse:
    try:
        matches = match.MatchService.get_results(match_id, integration=integration)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting matches for {match_id} with {e.name}"
        )
    return MatchesResponse().model_validate(matches, from_attributes=True)


@router.get("/request/{match_id}", response_model=MatchResponse)
def get_match_request(match_id: str) -> MatchResponse:
    match_request = match.MatchService.get_request(match_id)
    return MatchResponse.model_validate(match_request, from_attributes=True)


@router.post("/confidence", response_model=similarity.SimilarityResult)
def post_confidence_comparison(request: ConfidenceComparisonRequest) -> similarity.SimilarityResult:
    confidence_result = similarity_model_service.predict_one(
        request.business, request.integration_business
    )

    return confidence_result
