"""
Kafka consumer for entity matching requests.

Consumes match requests published by integration-service (behind the
DEVOPS_110_ENTITY_MATCHING_API_TO_KAFKA feature flag) and triggers the same
Celery-based matching pipeline that the HTTP POST /matching/match endpoint uses.
"""

import logging
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from datapooler import config, tasks
from datapooler.adapters import messages
from datapooler.models.businesses import BusinessAddress, ExtraInfo
from datapooler.services.match import IntegrationEnum, MatchService


class MatchRequestMessage(BaseModel):
    """
    Pydantic model for incoming Kafka match request messages.

    Mirrors the MatchRequest model from the HTTP endpoint. The Kafka message
    also contains an 'event' field which is ignored via extra="ignore".
    """

    model_config = ConfigDict(extra="ignore")

    business_id: str
    names: list[str]
    addresses: list[BusinessAddress]
    extra: ExtraInfo = Field(default_factory=ExtraInfo)
    source: Optional[str] = None


class MatchRequestConsumerService:
    """Consumes entity matching requests from Kafka and dispatches Celery tasks."""

    def __init__(self):
        self._logger = logging.getLogger(__name__)

    def consume(self) -> None:
        consumer = messages.Consumer(
            topic=config.entity_matching_request_topic,
            _model=MatchRequestMessage,
            max_workers=5,
        )

        self._logger.info("Starting match request consumer...")
        self._logger.info(f"Listening to topic: {config.entity_matching_request_topic}")

        consumer.consume_concurrent(self._handle_request)

    def _handle_request(self, request: MatchRequestMessage) -> None:
        try:
            self._logger.info(f"Processing match request for business_id={request.business_id}")

            reused, match_request = MatchService.ensure_match_request_with_publish(
                request.business_id, request.names, request.addresses, request.extra
            )

            if reused:
                self._logger.info(
                    f"Reused existing match request {match_request.match_id} "
                    f"for business_id={request.business_id}"
                )
                return

            for integration in IntegrationEnum:
                tasks.generate_matches_task.delay(
                    match_request.match_id, request.model_dump(), integration.value
                )

            self._logger.info(
                f"Dispatched matching tasks for match_id={match_request.match_id}, "
                f"business_id={request.business_id}"
            )

        except Exception:
            self._logger.exception(
                f"Error processing match request for business_id={request.business_id}"
            )
            raise
