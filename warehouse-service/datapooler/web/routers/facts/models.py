from pydantic import BaseModel, Field


class GatherFactsRequest(BaseModel):
    facts_required: list[str] = Field(..., description="List of facts to gather")
