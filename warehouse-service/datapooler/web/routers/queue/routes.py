from fastapi import APIRouter, HTTPException

from datapooler.adapters.queues.celery import TaskQueue
from datapooler.web.routers.queue.models import FailedTask, QueueStatus, RetriedTask

router = APIRouter(prefix="/queue", tags=["queue"])


# TODO: Move logic to service layer, so routes are thin and focused on request/response handling.
@router.get("/status", response_model=QueueStatus)
async def get_queue_status() -> QueueStatus:
    """Get the current status of the Celery queue."""
    try:
        inspector = TaskQueue.control.inspect()

        # Get active tasks
        active = inspector.active() or {}
        active_tasks = sum(len(tasks) for tasks in active.values())

        # Get reserved tasks
        reserved = inspector.reserved() or {}
        reserved_tasks = sum(len(tasks) for tasks in reserved.values())

        # Get scheduled tasks
        scheduled = inspector.scheduled() or {}
        scheduled_tasks = sum(len(tasks) for tasks in scheduled.values())

        # Get registered task types
        registered = inspector.registered() or {}
        task_types = list(registered.keys())

        return QueueStatus(
            active_tasks=active_tasks,
            reserved_tasks=reserved_tasks,
            scheduled_tasks=scheduled_tasks,
            task_types=task_types,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting queue status: {str(e)}")


@router.get("/retries", response_model=list[RetriedTask])
async def get_retried_tasks() -> list[RetriedTask]:
    """Get all tasks that have been retried."""
    try:
        inspector = TaskQueue.control.inspect()
        retried_tasks = []

        # Check active tasks
        active = inspector.active() or {}
        for worker, tasks in active.items():
            for task in tasks:
                if task.get("retries", 0) > 0:
                    retried_tasks.append(
                        RetriedTask(
                            task_id=task["id"],
                            name=task["name"],
                            retry_count=task["retries"],
                            last_error=task.get("exception", None),
                        )
                    )

        # Check reserved tasks
        reserved = inspector.reserved() or {}
        for worker, tasks in reserved.items():
            for task in tasks:
                if task.get("retries", 0) > 0:
                    retried_tasks.append(
                        RetriedTask(
                            task_id=task["id"],
                            name=task["name"],
                            retry_count=task["retries"],
                            last_error=task.get("exception", None),
                        )
                    )

        return retried_tasks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting retried tasks: {str(e)}")


# TODO: Move logic to service layer, so routes are thin and focused on request/response handling.
@router.get("/failed", response_model=list[FailedTask])
async def get_failed_tasks() -> list[FailedTask]:
    """Get all failed tasks."""
    try:
        inspector = TaskQueue.control.inspect()
        failed_tasks = []

        # Check active tasks
        active = inspector.active() or {}
        for worker, tasks in active.items():
            for task in tasks:
                if task.get("failed", False):
                    failed_tasks.append(
                        FailedTask(
                            task_id=task["id"],
                            name=task["name"],
                            error=task.get("exception", "Unknown error"),
                            failed_at=task.get("time_start", None),
                            retry_count=task.get("retries", 0),
                        )
                    )

        # Check reserved tasks
        reserved = inspector.reserved() or {}
        for worker, tasks in reserved.items():
            for task in tasks:
                if task.get("failed", False):
                    failed_tasks.append(
                        FailedTask(
                            task_id=task["id"],
                            name=task["name"],
                            error=task.get("exception", "Unknown error"),
                            failed_at=task.get("time_start", None),
                            retry_count=task.get("retries", 0),
                        )
                    )

        return failed_tasks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting failed tasks: {str(e)}")


# TODO: Move logic to service layer, so routes are thin and focused on request/response handling.
@router.post("/purge")
async def purge_queue() -> dict:
    """Purge all tasks from the queue."""
    try:
        # Get all task IDs from active and reserved tasks
        inspector = TaskQueue.control.inspect()
        task_ids = []

        # Get active tasks
        active = inspector.active() or {}
        for worker, tasks in active.items():
            task_ids.extend(task["id"] for task in tasks)

        # Get reserved tasks
        reserved = inspector.reserved() or {}
        for worker, tasks in reserved.items():
            task_ids.extend(task["id"] for task in tasks)

        if task_ids:
            # Revoke all tasks at once
            TaskQueue.control.revoke(task_ids, terminate=True)
            return {"message": f"Successfully purged {len(task_ids)} tasks from the queue"}

        return {"message": "No tasks found to purge"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error purging queue: {str(e)}")


# TODO: Move logic to service layer, so routes are thin and focused on request/response handling.
@router.post("/evict/task/{task_id}")
async def evict_task(task_id: str) -> dict:
    """Evict a specific task from the queue."""
    try:
        # Revoke the task
        TaskQueue.control.revoke(task_id, terminate=True)
        return {"message": f"Task {task_id} has been evicted from the queue"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error evicting task {task_id}: {str(e)}")
