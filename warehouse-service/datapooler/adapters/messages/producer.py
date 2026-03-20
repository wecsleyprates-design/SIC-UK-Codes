"""
Kafka Message Producer.

Provides a high-level interface for publishing messages to Kafka topics.

Uses a process-wide singleton KafkaProducer to avoid the overhead of
creating/destroying TCP connections and 32 MB send buffers on every publish.
KafkaProducer is thread-safe and topic-agnostic, so one instance serves all
topics and all threads.

Usage:
    with KafkaMessageSender.connect(topic='my-topic') as sender:
        sender.send(key='business_id', message=model_instance)
"""

import atexit
import logging
import threading
from contextlib import contextmanager
from typing import Any, Iterator

import orjson
from kafka import KafkaProducer
from pydantic import BaseModel

from datapooler import config

_logger = logging.getLogger(__name__)

_producer_lock = threading.Lock()
_shared_producer: KafkaProducer | None = None


def _get_shared_producer() -> KafkaProducer:
    """Return (and lazily create) the process-wide KafkaProducer singleton."""
    global _shared_producer
    if _shared_producer is not None:
        return _shared_producer
    with _producer_lock:
        if _shared_producer is not None:
            return _shared_producer
        _shared_producer = KafkaProducer(**config.kafka_connection_args())
        atexit.register(_shutdown_producer)
        _logger.info("Created shared KafkaProducer singleton")
        return _shared_producer


def _shutdown_producer():
    global _shared_producer
    if _shared_producer is not None:
        try:
            _shared_producer.flush(timeout=5)
            _shared_producer.close(timeout=5)
        except Exception:
            _logger.warning("Error closing KafkaProducer during shutdown", exc_info=True)
        _shared_producer = None


class KafkaMessageSender:
    """
    Lightweight wrapper around the shared KafkaProducer.

    Each instance is bound to a single topic but shares the underlying
    producer (TCP connections, buffers, background sender thread).
    """

    def __init__(self, topic: str):
        self.topic = topic
        self._logger = logging.getLogger(__name__ + ".KafkaMessageSender")

    @property
    def producer(self) -> KafkaProducer:
        return _get_shared_producer()

    def _serialize(self, message: BaseModel | dict[str, Any] | str) -> bytes:
        match message:
            case BaseModel():
                return message.model_dump_json().encode("utf-8")
            case dict():
                return orjson.dumps(message)
            case str():
                return message.encode("utf-8")
            case _:
                raise ValueError("Invalid Message Type")

    def send(self, key: str, message: BaseModel | dict[str, Any] | str) -> bool:
        """
        Send a message to the Kafka topic.

        Args:
            key: Message key for partitioning (e.g., business_id)
            message: Message payload (Pydantic model, dict, or string)

        Returns:
            True if message sent successfully, False otherwise
        """
        try:
            self.producer.send(self.topic, key=key.encode(), value=self._serialize(message))
            return True
        except Exception:
            self._logger.exception(f"Failed to send message to Kafka: {message}")
            return False

    def flush(self, timeout: int = 5) -> None:
        """Flush pending messages without closing the shared producer."""
        self.producer.flush(timeout=timeout)

    def close(self, timeout: int = 5) -> None:
        """Flush pending messages. Does NOT close the shared producer."""
        self.flush(timeout=timeout)

    @classmethod
    @contextmanager
    def connect(cls, topic: str) -> Iterator["KafkaMessageSender"]:
        """
        Context manager for sending messages to a Kafka topic.

        Creates a lightweight sender bound to *topic* that shares the
        process-wide KafkaProducer.  On exit the pending buffer is flushed
        but the producer stays alive for reuse.

        Usage:
            with KafkaMessageSender.connect('my-topic') as sender:
                sender.send('key', {'data': 'value'})
        """
        sender = cls(topic)
        try:
            yield sender
        except Exception as e:
            _logger.error(f"Failed to use Kafka sender for topic {topic}: {e}")
            raise
        finally:
            sender.flush()
