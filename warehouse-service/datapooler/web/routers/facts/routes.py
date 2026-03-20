from fastapi import APIRouter, HTTPException

from datapooler.models.fact import Fact
from datapooler.services import facts
from datapooler.web.routers.facts import models

router = APIRouter(prefix="/facts", tags=["facts"])


@router.get("/{business_id}", response_model=list[Fact])
async def get_facts(business_id: str) -> list[Fact]:
    try:
        fact_service = facts.FactService()
        facts_list = await fact_service.get(business_id)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting facts for {business_id} with {str(e)}"
        )
    return facts_list


@router.post("/{business_id}", response_model=list[Fact])
async def gather_facts(request: models.GatherFactsRequest, business_id: str) -> list[Fact]:
    try:
        fact_service = facts.FactService()
        gathered_facts = await fact_service.gather(business_id, request.facts_required)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error gathering facts for {business_id} with {str(e)}"
        )
    return gathered_facts
