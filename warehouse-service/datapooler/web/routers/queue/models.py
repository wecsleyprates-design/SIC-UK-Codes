from pydantic import BaseModel


class RetriedTask(BaseModel):
    task_id: str
    name: str
    retry_count: int
    last_error: str | None = None


class FailedTask(BaseModel):
    task_id: str
    name: str
    error: str
    failed_at: str | None = None
    retry_count: int


class QueueStatus(BaseModel):
    active_tasks: int
    reserved_tasks: int
    scheduled_tasks: int
    task_types: list[str]
