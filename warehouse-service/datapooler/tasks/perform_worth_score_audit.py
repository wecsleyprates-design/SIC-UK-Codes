from typing import Any

from datapooler import config
from datapooler.adapters import queues
from datapooler.services.score_audit import WorthScoreAuditService


@queues.TaskQueue.task(serializer="gzip-orjson", reject_on_worker_lost=True)
def perform_worth_score_audit_task() -> dict[str, Any] | None:
    if not config.is_production:
        return {"error": "Not in production environment"}

    result = WorthScoreAuditService().perform()

    return result.content.model_dump() if result else None
