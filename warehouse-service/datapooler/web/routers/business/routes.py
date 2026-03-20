from fastapi import APIRouter, HTTPException

from datapooler import config
from datapooler.models import businesses
from datapooler.services.case_details import (
    CaseDetails,
    CaseDetailsService,
    CaseType,
    CustomerCaseDetails,
)
from datapooler.services.zipcodes import ZipCodeService
from datapooler.web.routers.business import models

router = APIRouter(prefix="/business", tags=["business"])


@router.post("/normalize", response_model=list[businesses.NormalizedBusiness])
async def normalise_business(
    request: models.NormaliseRequest,
) -> list[businesses.NormalizedBusiness]:
    """
    Normalize business names and addresses.
    """

    worth_businesses = businesses.WorthBusiness.from_request(request.model_dump())

    return [wb.to_normalized_business() for wb in worth_businesses]


@router.post("/zipcode", response_model=models.ZipCodeResponse)
async def get_zipcode(
    request: models.ZipCodeRequest,
) -> models.ZipCodeResponse:
    """
    Retrieve a ZipCode by its code and country.
    """
    zipcode = await ZipCodeService().fetch(request.zipcode, request.country)

    return models.ZipCodeResponse(zipcode=zipcode, country=request.country)


@router.get("/cases/case/{case_id}", response_model=CaseDetails)
def get_case_details(case_id: str) -> CaseDetails:
    """
    Retrieve case details for a given case ID.
    """
    if not config.is_production:
        raise HTTPException(status_code=403, detail="Access denied in non-production environments")

    case_details = CaseDetailsService().get_case_details(case_id, CaseType.CASE)

    if not case_details:
        raise HTTPException(status_code=404, detail="Case details not found")

    return case_details


@router.get("/cases/customer/{customer_id}", response_model=list[CustomerCaseDetails])
def get_customer_case_details(customer_id: str) -> list[CustomerCaseDetails]:
    """
    Retrieve customer case details for a given customer ID.
    """
    if not config.is_production:
        raise HTTPException(status_code=403, detail="Access denied in non-production environments")

    customer_case_details = CaseDetailsService().get_case_details(customer_id, CaseType.CUSTOMER)

    if not customer_case_details:
        raise HTTPException(status_code=404, detail="Customer case details not found")

    return customer_case_details
