import logging
import time

from billiard.exceptions import WorkerLostError
from celery import Celery
from celery.exceptions import MaxRetriesExceededError

from datapooler.adapters.queues import celeryconfig

logger = logging.getLogger(__name__)


def on_task_retry(task_id, exc, args, kwargs, einfo) -> None:
    """Handle task retries and log them."""
    retry_count = kwargs.get("retries", 0)
    max_retries = kwargs.get("max_retries", 3)
    next_retry_delay = kwargs.get("countdown", 60)

    logger.warning(
        f"Task {task_id} is being retried (attempt {retry_count + 1}/{max_retries + 1})",
        extra={
            "task_id": task_id,
            "exception": str(exc),
            "args": args,
            "kwargs": kwargs,
            "traceback": einfo.traceback if einfo else None,
            "retry_count": retry_count,
            "max_retries": max_retries,
            "next_retry_delay": next_retry_delay,
            "timestamp": time.time(),
            "error_type": "retry",
        },
    )


def on_task_failure(task_id, exc, args, kwargs, einfo) -> None:
    """Handle task failures and log errors."""
    retry_count = kwargs.get("retries", 0)
    max_retries = kwargs.get("max_retries", 3)

    # Special handling for worker lost errors
    if isinstance(exc, WorkerLostError):
        logger.error(
            f"Task {task_id} failed due to worker being killed (SIGKILL) - Likely OOM",
            extra={
                "task_id": task_id,
                "exception": str(exc),
                "args": args,
                "kwargs": kwargs,
                "traceback": einfo.traceback if einfo else None,
                "retry_count": retry_count,
                "max_retries": max_retries,
                "timestamp": time.time(),
                "error_type": "worker_lost",
            },
        )
        # Ensure the task is properly acknowledged as failed
        TaskQueue.control.revoke(task_id, terminate=True)
    elif isinstance(exc, MaxRetriesExceededError):
        logger.error(
            f"Task {task_id} failed after exceeding maximum retries ({max_retries})",
            extra={
                "task_id": task_id,
                "exception": str(exc),
                "args": args,
                "kwargs": kwargs,
                "traceback": einfo.traceback if einfo else None,
                "retry_count": retry_count,
                "max_retries": max_retries,
                "timestamp": time.time(),
                "error_type": "max_retries_exceeded",
            },
        )
        # Ensure the task is properly acknowledged as failed
        TaskQueue.control.revoke(task_id, terminate=True)
    else:
        logger.error(
            f"Task {task_id} failed after {retry_count + 1} attempts (max: {max_retries + 1})",
            extra={
                "task_id": task_id,
                "exception": str(exc),
                "args": args,
                "kwargs": kwargs,
                "traceback": einfo.traceback if einfo else None,
                "retry_count": retry_count,
                "max_retries": max_retries,
                "timestamp": time.time(),
                "error_type": "failure",
            },
        )


TaskQueue: Celery = Celery(
    "datapooler",
    config_source=celeryconfig,
    broker_connection_retry_on_startup=True,
    include=["datapooler.tasks"],
)

# Register the error handlers
TaskQueue.conf.task_failure_handler = on_task_failure
TaskQueue.conf.task_retry_handler = on_task_retry
TaskQueue.conf.timezone = "America/New_York"
