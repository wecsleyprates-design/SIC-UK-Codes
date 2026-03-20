from fastapi import APIRouter, HTTPException

from datapooler.adapters.redshift.repository.npi_repository import NPIRepository
from datapooler.models import npi

router = APIRouter(prefix="/npi", tags=["npi"])


@router.get("/{npi}", response_model=npi.NPIRecord)
async def get_npi_record(npi: int) -> npi.NPIRecord:
    """
    Get NPI record by NPI number.
    """
    try:
        npi_record = NPIRepository().get(npi)
        return npi_record
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting NPI record for {npi} with {str(e)}"
        )
