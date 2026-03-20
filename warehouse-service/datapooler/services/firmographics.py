"""
Firmographic Data Enrichment Service.

Retrieves and publishes firmographic data (company demographics, financial info,
credit scores, etc.) for matched business entities.

Workflow:
1. Receives matched integration businesses from entity matching
2. Queries integration repositories for detailed firmographic data
3. Packages data into FirmographicsResult
4. Publishes to Kafka for downstream consumption

Supported integrations:
- Equifax: Credit scores, payment behavior, risk ratings
- ZoomInfo: Employee counts, revenue, industry data
- OpenCorporate: Company registration, officer data
- Canada Open: Canadian business registry information
"""

import logging

from datapooler import config
from datapooler.adapters.messages import KafkaMessageSender
from datapooler.adapters.redshift.repository.match_repository import (
    _get_repository_class,
)
from datapooler.models import businesses, firmographics


class FirmographicsService:
    """
    Service for retrieving and publishing firmographic data.

    Coordinates between match results and integration data repositories
    to fetch detailed company information for matched entities.
    """

    def __init__(
        self,
        business_id: str,
        match_id: str,
        businesses: list[businesses.IntegrationBusiness],
        integration: str,
        prediction: float,
    ):
        self.business_id = business_id
        self.match_id = match_id
        self.integration = integration
        self.businesses = businesses
        self.prediction = prediction
        self._repository = _get_repository_class(self.integration)
        self._logger = logging.getLogger(__name__)

    def get_firmographics(self) -> firmographics.FirmographicsResult:
        """
        Retrieve firmographic data for matched businesses.

        Queries the appropriate integration repository for detailed
        company information and packages it into a result object.

        Returns:
            FirmographicsResult with enriched company data

        Raises:
            ValueError: If business list is empty or no firmographics found
        """
        if not self.businesses:
            raise ValueError("Business list is empty")

        # Fetch firmographics from the repository
        firmographics_data = self._repository.get_firmographics(self.businesses)

        if not firmographics_data:
            raise ValueError(f"No firmographics found for business ID: {self.business_id}")

        return firmographics.FirmographicsResult(
            business_id=self.business_id,
            match_id=self.match_id,
            prediction=self.prediction,
            firmographics=firmographics_data,
            source=self.integration,
        )

    def publish(self, firmographics_result: firmographics.FirmographicsResult) -> bool:
        """
        Publish firmographics result to Kafka.

        Sends enriched firmographic data to the entity matching topic
        for consumption by downstream services.

        Args:
            firmographics_result: Enriched firmographic data to publish

        Returns:
            True if published successfully, False otherwise
        """
        try:
            with KafkaMessageSender.connect(topic=config.entity_matching_topic) as sender:
                sender.send(key=firmographics_result.business_id, message=firmographics_result)
            return True
        except Exception as e:
            self._logger.error(f"Failed to publish firmographics result: {e}")
            return False
