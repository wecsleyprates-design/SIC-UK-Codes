"""
Fact Table Management Service.

Manages storage and retrieval of business facts (key-value data points)
for analytics and decision making.

Facts represent discrete data points about businesses:
- Financial metrics (revenue, expenses)
- Application status (approved, declined)
- Verification results (KYC, credit check)
- Calculated scores (credit score, risk rating)

Workflow:
1. Facts arrive via Kafka from various sources
2. Consumer processes fact envelopes
3. Facts are merged into database (upsert on business_id + name)
4. Facts available for querying by business_id

Supports:
- Real-time fact consumption from Kafka
- Async fact retrieval
- Automatic retry on integrity errors
- Fact gathering for specific fact names
"""

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_fixed

from datapooler import config
from datapooler.adapters import messages, sessions
from datapooler.adapters.db.models.facts import FactDb
from datapooler.models.fact import Fact, FactEnvelope


class FactService:
    """Service for managing business facts storage and retrieval."""

    def __init__(self):
        self._async_sessionmaker = sessions.AsyncTransactionalSessions
        self._sessionmaker = sessions.TransactionalSessions
        self._logger = logging.getLogger(__name__)

    async def get(self, business_id: str) -> list[Fact]:
        """
        Retrieve all facts for a business.

        Args:
            business_id: Unique business identifier

        Returns:
            List of Fact objects (empty if none found)
        """
        async with self._async_sessionmaker.get_session() as session:
            stmt = select(FactDb).where(FactDb.business_id == business_id)
            result = await session.scalars(stmt)
            facts_from_db = result.all()

            if not facts_from_db:
                return []

            return Fact.from_db(facts_from_db)

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_fixed(0.5),
        retry=retry_if_exception_type(IntegrityError),
        reraise=True,
    )
    def merge(self, fact: Fact) -> None:
        """
        Merge (upsert) a fact into the database.

        Updates existing fact if business_id + name already exists,
        otherwise inserts new fact. Retries on integrity errors.

        Args:
            fact: Fact to merge
        """
        # TODO: Switch to session.bulk_save_objects if performance is an issue.
        with self._sessionmaker.get_session() as session:
            fact_db = FactDb(
                business_id=fact.business_id,
                name=fact.name,
                value=fact.value,
                received_at=fact.received_at,
            )
            session.merge(fact_db)

        return

    async def gather(self, business_id: str, facts_required: list[str]) -> list[Fact]:
        """
        Gather specific facts for a business.

        Args:
            business_id: Unique business identifier
            facts_required: List of fact names to retrieve

        Returns:
            List of matching Fact objects
        """
        async with self._async_sessionmaker.get_session() as session:
            facts = await session.scalars(
                select(FactDb).where(
                    FactDb.business_id == business_id, FactDb.name.in_(facts_required)
                )
            )

            return [Fact.from_db(fact) for fact in facts.all()]

    def consume(self) -> None:
        """
        Consume fact envelopes from the Kafka topic and persist them.

        Long-running: runs until interrupted. Uses a concurrent consumer so
        multiple envelopes can be processed in parallel (up to max_workers).
        DB sessions are thread-safe (TransactionalSessions uses scoped_session).
        """
        consumer = messages.Consumer(
            topic=config.facts_topic,
            _model=FactEnvelope,
            max_workers=3,
        )

        self._logger.info("Starting to process facts...")
        self._logger.info(f"Listening to topic: {config.facts_topic}")

        consumer.consume_concurrent(self._process_envelope)

    def _process_envelope(self, fact_envelope: FactEnvelope) -> None:
        facts = list(fact_envelope)
        try:
            self.merge_batch(facts)
        except Exception:
            envelope_info = {
                "business_id": getattr(fact_envelope, "business_id", None),
                "scope": getattr(fact_envelope, "scope", None),
                "fact_count": len(facts),
            }
            self._logger.warning(
                "Error processing fact batch: %s",
                envelope_info,
                exc_info=True,
            )

    def merge_batch(self, facts: list[Fact]) -> None:
        """
        Merge all facts in a single transaction.

        On IntegrityError (e.g. concurrent insert), falls back to per-fact
        merge() so retry semantics apply and no valid facts are dropped.
        """
        try:
            with self._sessionmaker.get_session() as session:
                for fact in facts:
                    fact_db = FactDb(
                        business_id=fact.business_id,
                        name=fact.name,
                        value=fact.value,
                        received_at=fact.received_at,
                    )
                    session.merge(fact_db)
        except IntegrityError:
            self._logger.warning(
                "Batch merge failed (integrity error), falling back to per-fact merge",
                exc_info=True,
            )
            # Re-merge each fact individually (idempotent; may be redundant if only one fact caused the error)
            for fact in facts:
                self.merge(fact)


if __name__ == "__main__":
    fact_service = FactService()
    fact_service.consume()
