from __future__ import annotations

import datetime
import logging

from json_log_formatter import JSONFormatter

from datapooler.config import Config

config = Config()


# Extend JSONFormatter to include level
class CustomJSONFormatter(JSONFormatter):
    def json_record(self, message, extra, record):
        extra.update(
            {
                "level": record.levelname,
                "message": message,
                "timestamp": datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
                "logger": record.name,  # ← logger name here
                "module": record.module,
                "function": record.funcName,
                "line": record.lineno,
                "file": record.pathname,
            }
        )

        if record.exc_info:
            extra["exception"] = self.formatException(record.exc_info)

        return extra


handler = logging.StreamHandler()
handler.setFormatter(CustomJSONFormatter())

logging.basicConfig(
    datefmt="%Y-%m-%d %H:%M:%S",
    level=logging.INFO,
    handlers=[handler],
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)
