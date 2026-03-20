from datapooler import config
from datapooler.adapters import queues
from datapooler.services.npi import NPIAutomationService


@queues.TaskQueue.task(serializer="gzip-orjson", reject_on_worker_lost=True)
def incremental_npi_update_task() -> int | None:
    if config.is_production:
        return None

    service = NPIAutomationService()
    run = service.perform()

    return run.id if run else None
