import logging
from concurrent.futures import TimeoutError as FuturesTimeoutError
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable, Iterator

import orjson
from kafka import KafkaConsumer
from kafka.errors import KafkaError

from datapooler import config
from datapooler.models import BaseDataPoolerModel


class Consumer:
    def __init__(self, topic: str, _model: BaseDataPoolerModel | None = None, max_workers: int = 1):
        if max_workers < 1:
            raise ValueError("max_workers must be >= 1")
        self.topic = topic
        self.group_id = config.config_kafka_group_id
        kafka_kwargs = dict(config.kafka_connection_args())
        if max_workers > 1:
            # fetch enough to keep workers busy; avoid rebalance when blocking on in-flight handlers
            kafka_kwargs["max_poll_records"] = max_workers * 2
            kafka_kwargs.setdefault("max_poll_interval_ms", 600_000)  # 10 min
        self.consumer = KafkaConsumer(
            self.topic,
            group_id=self.group_id,
            auto_offset_reset="earliest",
            enable_auto_commit=True,  # at-most-once: offsets may commit before handler completes
            value_deserializer=lambda v: orjson.loads(v),
            **kafka_kwargs,
        )
        self._logger = logging.getLogger(__name__)
        self._model = _model
        self._max_workers = max_workers

    def _parse_message(self, message):
        """Parse a Kafka message, applying the model if configured."""
        if self._model:
            return self._model.model_validate(message.value)
        return message.value

    def __iter__(self) -> Iterator[BaseDataPoolerModel] | Iterator[dict[Any, Any]]:
        for message in self.consumer:
            self._logger.debug(f"Received message: {message.value}")
            try:
                yield self._parse_message(message)
            except KafkaError:
                self._logger.exception("Kafka error")
            except Exception:
                self._logger.exception(f"Error parsing message: {message}")

    def consume_concurrent(self, handler: Callable) -> None:
        """
        Process messages concurrently using a thread pool.

        With enable_auto_commit=True, offsets may be committed before the handler
        completes (or if it fails), so delivery is at-most-once. Failed messages
        are not retried by this consumer.

        Args:
            handler: Callable that processes a single parsed message.
                     Receives a model instance (if _model is set) or raw dict.
        """
        self._logger.info(
            f"Starting concurrent consumer: topic={self.topic}, "
            f"group_id={self.group_id}, max_workers={self._max_workers}"
        )

        with ThreadPoolExecutor(max_workers=self._max_workers) as executor:
            futures = {}

            for message in self.consumer:
                self._logger.debug(f"Received message: {message.value}")
                try:
                    parsed = self._parse_message(message)

                    # Submit to thread pool
                    future = executor.submit(handler, parsed)
                    futures[future] = message

                    # When pool is full, wait for at least one to complete before continuing
                    while len(futures) >= self._max_workers:
                        try:
                            done = next(iter(as_completed(futures, timeout=300)))
                        except FuturesTimeoutError:
                            self._logger.warning(
                                "No handler completed within 300s; in-flight=%d",
                                len(futures),
                            )
                            continue
                        try:
                            done.result()
                        except Exception:
                            self._logger.exception(
                                f"Error processing message from partition "
                                f"{futures[done].partition} offset {futures[done].offset}"
                            )
                        del futures[done]
                        break

                except KafkaError:
                    self._logger.exception("Kafka error")
                except Exception:
                    self._logger.exception(f"Error parsing message: {message}")

            # Drain remaining futures on shutdown
            while futures:
                try:
                    done = next(iter(as_completed(futures, timeout=300)))
                except FuturesTimeoutError:
                    self._logger.warning(
                        "Shutdown drain: no handler completed within 300s; remaining=%d",
                        len(futures),
                    )
                    break
                try:
                    done.result()
                except Exception:
                    self._logger.exception(
                        f"Error processing message from partition "
                        f"{futures[done].partition} offset {futures[done].offset}"
                    )
                del futures[done]
