import gzip
from typing import Any

import orjson
from kombu import serialization

from datapooler import config


def orjson_gzip_dumps(v, *, default="") -> bytes:
    return gzip.compress(orjson.dumps(v, default=default))


def orjson_gzip_loads(v) -> dict[Any, Any]:
    try:
        return orjson.loads(gzip.decompress(v))
    except OSError:  # Celery Messages between Workers are not Gziped
        return orjson.loads(v)


# Broker and Result Backend
broker_url = config.redis_connection_string()
result_backend = config.redis_connection_string()

_redis_key_prefix = config.config_redis_key_prefix or ""
if _redis_key_prefix:
    broker_transport_options = {"global_keyprefix": _redis_key_prefix}
    result_backend_transport_options = {"global_keyprefix": _redis_key_prefix}

# Serelization
serialization.register(
    name="gzip-orjson",
    encoder=orjson_gzip_dumps,
    decoder=orjson_gzip_loads,
    content_type="application/json",
    content_encoding="gzip",
)

result_serializer = "gzip-orjson"
timezone = "America/New_York"
enable_utc = True

# Retry Configuration
task_default_max_retries = 3
task_default_retry_delay = 60  # seconds
task_acks_late = True
task_reject_on_worker_lost = True

# Error Handling
task_track_started = True
task_publish_retry = True
task_publish_retry_policy = {
    "max_retries": 3,
    "interval_start": 0,
    "interval_step": 0.2,
    "interval_max": 0.2,
}

# Worker Config
worker_prefetch_multiplier = 1

beat_schedule = {
    # TODO: Re-enable when more performance testing is done.
    # "incremental_npi_update": {
    #     "task": "datapooler.tasks.incremental_npi_update.incremental_npi_update_task",
    #     "schedule": crontab(day_of_week="*", hour=0, minute=0),  # Daily at midnight EST
    #     "options": {"queue": "celery"},
    # },
    # Turned off at request of Jacques on 2025-12-03. - Sam Stiyer
    # "perform_worth_score_audit": {
    #     "task": "datapooler.tasks.perform_worth_score_audit.perform_worth_score_audit_task",
    #     "schedule": crontab(day_of_week="*", hour=22, minute=0),  # Daily at 10 PM EST
    #     "options": {"queue": "celery"},
    # },
}
