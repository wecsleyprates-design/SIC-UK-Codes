"""
Business Entity Matching Service.

This module provides ML-powered entity matching between Worth business records
and various integration data sources (Equifax, ZoomInfo, OpenCorporate, etc.).

The matching pipeline:
1. Retrieve candidate matches from integration repositories (Redshift)
2. Generate similarity features for each candidate pair
3. Use XGBoost model to predict match probability
4. Return top N matches ranked by prediction score
5. Optionally persist results to database and Kafka
6. Trigger firmographics enrichment for matched entities
"""

import datetime
import heapq
import logging
import uuid
from enum import StrEnum

from pydantic import BaseModel, Field
from sqlalchemy.orm import selectinload

from datapooler import config, tasks
from datapooler.adapters import messages, sessions
from datapooler.adapters.db import models
from datapooler.adapters.redshift.repository import match_repository
from datapooler.models import businesses
from datapooler.services import similarity

# Supported integration sources for entity matching
IntegrationEnum = StrEnum(
    "IntegrationEnum",
    {
        "equifax": "equifax",
        "zoominfo": "zoominfo",
        "open_corporate": "open_corporate",
        "canada_open": "canada_open",
        "npi": "npi",
    },
)

logger = logging.getLogger(__name__)


class MatchResult(BaseModel):
    """
    Domain model representing the result of an entity matching operation.

    Contains the top N matched entities from a specific integration source,
    ranked by ML prediction score.
    """

    event: str = "entity_matching_event"
    match_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    matches: list[similarity.SimilarityResult] = Field(default_factory=list)
    source: str
    matched_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    def to_db_models(self) -> list[models.MatchResultDb]:
        """
        Convert this MatchResult to database model instances.

        Returns:
            List of MatchResultDb instances ready for persistence
        """
        match_results_db = []

        for match in self.matches:
            match_result_db = models.MatchResultDb(
                match_id=self.match_id,
                business_id=self.business_id,
                source=self.source,
                match=match.integration_business,
                prediction=match.prediction,
            )

            match_results_db.append(match_result_db)

        return match_results_db

    @classmethod
    def from_db_models(
        cls,
        *,
        match_request: models.MatchRequestDb,
    ) -> list["MatchResult"]:
        """
        Convert database models back to MatchResult domain objects.

        Groups match results by integration source.

        Args:
            match_request: MatchRequestDb with match_results relationship loaded

        Returns:
            List of MatchResult objects, one per integration source
        """
        from collections import defaultdict

        grouped: dict[str, list[similarity.SimilarityResult]] = defaultdict(list)

        for row in match_request.match_results:
            grouped[row.source].append(
                similarity.SimilarityResult(
                    integration_business=row.match,
                    prediction=row.prediction,
                )
            )

        return [
            cls(
                match_id=match_request.match_id,
                business_id=match_request.business_id,
                source=source,
                matches=matches,
                matched_at=match_request.updated_at or match_request.created_at,
            )
            for source, matches in grouped.items()
        ]


class MatchService:
    """
    Service for performing ML-powered entity matching.

    This service coordinates the entire matching pipeline:
    - Fetching candidate matches from integration repositories
    - Computing similarity features
    - Running ML prediction
    - Persisting results
    - Triggering downstream processes (firmographics)
    """

    def __init__(
        self,
        match_id: str,
        businesses: businesses.WorthBusinessList,
        integration: str,
    ):
        """
        Initialize the MatchService for a specific matching request.

        Args:
            match_id: Unique identifier for this match request
            businesses: List of Worth business entities to match
            integration: Target integration source (e.g., 'equifax', 'zoominfo')

        Raises:
            ValueError: If businesses list is empty or contains multiple business_ids
        """
        if not businesses:
            raise ValueError("Business list is empty")

        # All businesses in the list must belong to the same Worth business entity
        self.match_id = match_id
        self.integration = integration
        self.businesses = businesses

        if len(business_ids := {business.business_id for business in businesses}) != 1:
            logger.error(f"Businesses must have the same business_id, got {business_ids}")

            raise ValueError("Businesses must have the same business_id")

        self.business_id = business_ids.pop()

        # Internal configuration
        self._max_matches = config.max_matches_returned
        self._candidates = {"worth": self.businesses}
        self._repository = match_repository._get_repository_class(self.integration)
        self._transactional_sessions = sessions.TransactionalSessions
        self._feature_service: similarity.SimilarityFeatureService = (
            similarity.SimilarityFeatureService(self._get_candidates())
        )
        self._model_service: similarity.SimilarityModelService = similarity.SimilarityModelService()
        self._persisted_kafka = False
        self._persisted_db = False

    def _get_candidates(self) -> businesses.ComparisonBusiness:
        """
        Retrieve candidate matches from the integration repository.

        Queries Redshift for potential matches based on geographic proximity
        and basic business attributes.

        Returns:
            ComparisonBusiness containing Worth businesses and integration candidates
        """
        self._candidates[self.integration] = self._repository.get_matches(self.businesses)

        if not self._candidates[self.integration]:
            logger.debug(
                f"No match candidates found for business {self.business_id} - {self.integration}"
            )

        return businesses.ComparisonBusiness(**self._candidates)

    def create_matches(
        self,
        n: int | None = None,
        persist: bool = False,
        update_request: bool = True,
        firmographics: bool = True,
    ) -> MatchResult | None:
        """
        Execute the complete matching pipeline.

        This is the main entry point for entity matching. It:
        1. Computes similarity features for all candidate pairs
        2. Runs ML model to predict match probabilities
        3. Selects top N matches
        4. Optionally persists results to database and Kafka
        5. Optionally triggers firmographics enrichment

        Args:
            n: Number of top matches to return (default: max_matches_returned from config)
            persist: If True, save results to database and publish to Kafka
            update_request: If True, update match request status
            firmographics: If True, trigger firmographics enrichment for matches

        Returns:
            MatchResult with top N matches, or None if no candidates found

        Raises:
            Exception: Re-raises any exception after updating request status to 'failed'
        """
        try:
            if self._feature_service.no_candidates:
                results = None
            else:
                self._feature_service.set_features()
                similarity_results = self._model_service.predict(
                    pairs=self._feature_service.pairs(), features=self._feature_service.features
                )
                results = MatchResult(
                    match_id=self.match_id,
                    business_id=self.business_id,
                    matches=heapq.nlargest(
                        n or self._max_matches, similarity_results, key=lambda x: x.prediction
                    ),
                    source=self.integration,
                )

            # Persist results to database and Kafka if requested
            if persist and results:
                self.persist(results)

            if persist and not results:
                # Persist empty result to Kafka for audit trail
                empty_result = MatchResult(
                    match_id=self.match_id,
                    business_id=self.business_id,
                    matches=[],
                    source=self.integration,
                )
                self.persist(empty_result, db=False)

            if update_request:
                self.set_status(self.match_id, "completed")

        except Exception as e:
            logger.exception(f"Error generating matches for {self.match_id}")
            if update_request:
                self.set_status(self.match_id, "failed")
            raise e

        # Trigger firmographics enrichment for matched entities
        if firmographics and results:
            self.start_firmographics_generation(results)

        return results

    @staticmethod
    def publish_early_abort(
        match_id: str, businesses: businesses.WorthBusinessList, integration: IntegrationEnum
    ) -> bool:
        """
        Publish an early abort message to Kafka when matching is skipped.

        Used when match request is abandoned before completion (e.g., invalid input,
        business rules exclude matching).

        Args:
            match_id: Match request identifier
            businesses: Worth business entities
            integration: Target integration source

        Returns:
            True if message was successfully published
        """
        with messages.KafkaMessageSender.connect(topic=config.entity_matching_topic) as sender:
            sender.send(
                key=businesses.business_id,
                message=MatchResult(
                    match_id=match_id,
                    business_id=businesses.business_id,
                    matches=[],
                    source=integration,
                ),
            )
        return MatchService.get_request(match_id)

    def start_firmographics_generation(self, results: MatchResult) -> bool:
        """Starts the firmographics generation task for the best match found."""
        try:
            # If there is a match, select the best match which is the first one in the list
            integration_business = businesses.business_model_selector(
                self.integration, results.matches[0].integration_business
            )
            prediction = results.matches[0].prediction

            tasks.generate_firmographics_task.delay(
                self.business_id,
                self.match_id,
                prediction,
                integration_business.model_dump(exclude=businesses.MODEL_DUMP_EXCLUSIONS),
                self.integration,
            )
            logger.debug(
                f"Started firmographics generation for {self.business_id} in {self.integration}"
            )
        except Exception as e:
            logger.error(f"Failed to start firmographics generation for {self.business_id}: {e}")
            return False

        return True

    def persist(self, match_result: MatchResult, kafka: bool = True, db: bool = True) -> None:
        if kafka:
            self._persist_kafka(match_result=match_result)
        if db:
            self._persist_db(match_result=match_result)

        return

    @staticmethod
    def publish_results(match_results: MatchResult | list[MatchResult]) -> None:
        if isinstance(match_results, MatchResult):
            match_results = [match_results]

        with messages.KafkaMessageSender.connect(topic=config.entity_matching_topic) as sender:
            for result in match_results:
                sender.send(key=result.business_id, message=result)
        return

    def _persist_kafka(self, match_result: MatchResult) -> None:
        with messages.KafkaMessageSender.connect(topic=config.entity_matching_topic) as sender:
            sender.send(key=match_result.business_id, message=match_result)
        self._persisted_kafka = True
        return

    def _persist_db(self, match_result: MatchResult) -> None:
        with self._transactional_sessions.get_session() as session:
            db_models = match_result.to_db_models()
            session.add_all(db_models)
            session.commit()

        self._persisted_db = True
        return

    @staticmethod
    def set_status(match_id: str, status: str) -> None:
        with sessions.TransactionalSessions.get_session() as session:
            match_request = session.query(models.MatchRequestDb).filter_by(match_id=match_id).one()
            match_request.status = status
            session.commit()

        return

    @staticmethod
    def get_results(match_id: str, integration: str = None) -> dict[str, list[MatchResult]]:
        with sessions.TransactionalSessions.get_session() as session:
            base_query = session.query(models.MatchResultDb).filter_by(match_id=match_id)

            if integration:
                base_query = base_query.filter_by(source=integration)

            return {"matches": base_query.all()}

    @staticmethod
    def create_request(
        business_id: str,
        names: list[str],
        addresses: list[businesses.BusinessAddress],
        extra: businesses.ExtraInfo,
    ) -> models.MatchResultDb:
        match_request_db = models.MatchRequestDb(
            match_id=str(uuid.uuid4()),
            business_id=business_id,
            status="pending",
            names=names,
            addresses=[address.model_dump(exclude="collected_at") for address in addresses],
            extra=extra.model_dump(mode="json"),
        )

        with sessions.TransactionalSessions.get_session() as session:
            session.add(match_request_db)
            session.commit()

        return match_request_db

    @staticmethod
    def get_request(match_id: str) -> models.MatchRequestDb:
        with sessions.TransactionalSessions.get_session() as session:
            return session.query(models.MatchRequestDb).filter_by(match_id=match_id).one()

    # TODO: This method should be added to a repository class, but for now it is here for simplicity
    # It is used to get the match requests and their results for a business.
    @staticmethod
    def get_requests_with_results(
        business_id: str,
        *,
        latest_only: bool = True,
        order_by: str = "created_at",
        descending: bool = True,
    ) -> dict[models.MatchRequestDb, list[MatchResult]] | None:
        with sessions.TransactionalSessions.get_session() as session:
            if order_by not in {"created_at", "updated_at"}:
                raise ValueError("order_by must be 'created_at' or 'updated_at'")

            order_col = getattr(models.MatchRequestDb, order_by)

            query = (
                session.query(models.MatchRequestDb)
                .filter(
                    models.MatchRequestDb.business_id == business_id,
                    models.MatchRequestDb.status == "completed",
                )
                .options(selectinload(models.MatchRequestDb.match_results))
            )

            if descending:
                query = query.order_by(order_col.desc(), models.MatchRequestDb.id.desc())
            else:
                query = query.order_by(order_col.asc(), models.MatchRequestDb.id.asc())

            requests = [query.first()] if latest_only else query.all()
            requests = [r for r in requests if r is not None]

            if not requests:
                return None

            return {
                request: MatchResult.from_db_models(match_request=request) for request in requests
            }

    @staticmethod
    def ensure_match_request_with_publish(
        business_id: str,
        names: list[str],
        addresses: list[businesses.BusinessAddress],
        extra: businesses.ExtraInfo,
    ) -> tuple[bool, models.MatchRequestDb]:
        pre_existing = MatchService.get_requests_with_results(
            business_id=business_id, latest_only=True
        )

        if not pre_existing:
            return False, MatchService.create_request(
                business_id=business_id, names=names, addresses=addresses, extra=extra
            )

        match_request, match_results = pre_existing.popitem()

        if (
            names == match_request.names
            and set(addresses) == set(businesses.BusinessAddress.from_list(match_request.addresses))
            and extra == businesses.ExtraInfo.model_validate(match_request.extra)
        ):
            MatchService.publish_results(match_results)
            return True, match_request

        return False, MatchService.create_request(
            business_id=business_id, names=names, addresses=addresses, extra=extra
        )

    @staticmethod
    def abort_matching_integration(
        businesses: businesses.WorthBusinessList, integration: str
    ) -> bool:
        """
        Determines if the integration should run based on the configuration.
        This is useful for integrations that are not applicable to certain regions.
        """
        match integration:
            case IntegrationEnum.equifax:
                return any(
                    [
                        businesses.contains_uk_businesses(),
                        businesses.contains_ca_businesses(),
                        businesses.contains_ie_businesses(),
                    ]
                )
            case IntegrationEnum.canada_open:
                return any(
                    [
                        businesses.contains_us_businesses(),
                        businesses.contains_uk_businesses(),
                        businesses.contains_ie_businesses(),
                    ]
                )
            case IntegrationEnum.npi:
                return any(
                    [
                        businesses.contains_ca_businesses(),
                        businesses.contains_uk_businesses(),
                        businesses.contains_ie_businesses(),
                    ]
                )
            # We can run any country against these integrations
            case IntegrationEnum.zoominfo:
                return False
            case IntegrationEnum.open_corporate:
                return False
            case _:
                logger.warning(f"Unknown integration {integration} for abort_matching_integration")
                return True
