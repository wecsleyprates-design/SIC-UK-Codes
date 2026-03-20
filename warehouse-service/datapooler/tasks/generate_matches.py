import logging
from typing import Any

from sqlalchemy import exc

from datapooler.adapters import queues
from datapooler.models import businesses
from datapooler.services import match

logger = logging.getLogger(__name__)


@queues.TaskQueue.task(serializer="gzip-orjson", acks_late=True, reject_on_worker_lost=True)
def generate_matches_task(
    match_id: str,
    request: dict[str, Any],
    integration: str,
    persist: bool = True,
    update_request: bool = True,
    firmographics: bool = True,
) -> tuple[int | None, bool]:
    worth_businesses = businesses.WorthBusiness.from_request(request)

    if match.MatchService.abort_matching_integration(worth_businesses, integration):
        logger.debug(
            f"Skipping matching for {match_id} with integration {integration} as it is not applicable."  # noqa: E501
        )
        # Publish MatchResult with No Matches
        match.MatchService.publish_early_abort(
            match_id=match_id,
            businesses=worth_businesses,
            integration=integration,
        )
        return None, False

    try:
        matches = match.MatchService(match_id, worth_businesses, integration).create_matches(
            persist=persist, update_request=update_request, firmographics=firmographics
        )

        return len(matches.matches) if matches else None, True

    except exc.OperationalError as e:
        logger.warning(f"Database connecting to redshift for {match_id} - retrying.")

        if update_request:
            match.MatchService.set_status(match_id, "retrying")

        raise generate_matches_task.retry(exc=e, countdown=60, max_retries=3)

    except Exception:
        logger.exception(f"Error generating matches for {match_id}")

        if update_request:
            match.MatchService.set_status(match_id, "failed")

        return None, False
