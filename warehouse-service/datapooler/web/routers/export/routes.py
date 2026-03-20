from fastapi import APIRouter, HTTPException

from datapooler import config, tasks
from datapooler.services.export import ExportResponseModel, ExportService

router = APIRouter(prefix="/export", tags=["export"])


@router.post("/{customer_id}/customer-file", response_model=ExportResponseModel)
async def export_customer_file(customer_id: str) -> ExportResponseModel:
    if not config.is_production:
        raise HTTPException(
            status_code=403,
            detail="Exporting customer files is not allowed in non-production environments.",
        )

    try:
        export_service = ExportService()
        export_response = await export_service.create_request(customer_id)
        # Trigger the background task to perform the export
        tasks.perform_export_customer_file_task.delay(customer_id, export_response.export_id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creating export request for Customer ID: {customer_id} with {str(e)}",
        )

    return export_response
