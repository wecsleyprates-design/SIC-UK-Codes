import logging
from typing import Any

from datapooler.adapters import queues
from datapooler.models import businesses
from datapooler.services import firmographics

logger = logging.getLogger(__name__)


@queues.TaskQueue.task(serializer="gzip-orjson", acks_late=True, reject_on_worker_lost=True)
def generate_firmographics_task(
    business_id: str,
    match_id: str,
    prediction: float,
    business: dict[str, Any],
    integration: str,
) -> tuple[str, bool, str]:
    logger.debug(
        f"Generating firmographics for business ID: {business_id}, integration: {integration}"
    )
    firmographics_service = firmographics.FirmographicsService(
        business_id=business_id,
        match_id=match_id,
        prediction=prediction,
        businesses=[businesses.business_model_selector(integration, business)],
        integration=integration,
    )

    firmographics_result = firmographics_service.get_firmographics()
    firmographics_service.publish(firmographics_result)

    if firmographics_result.firmographics is None:
        logger.debug(
            f"No firmographics data found for business ID: {business_id}, integration: {integration}"  # noqa: E501
        )
        return business_id, False, integration

    return business_id, True, integration
