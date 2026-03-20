import logging
import uuid

import boto3
import smart_open

from datapooler import config
from datapooler.adapters import files
from datapooler.models.integrations.lookup import is_iterable_integration_model


class IntegrationAccumulator:
    TRANSPORT_PARAMS = {
        "client": boto3.client("s3"),
        "client_kwargs": {
            "config": {
                "connect_timeout": 60,  # Increase the connect timeout to 60 seconds
                "read_timeout": 60,  # Increase the read timeout to 60 seconds
                "retries": {"max_attempts": 3},  # Retry up to 3 times
            }
        },
    }

    def __init__(self) -> None:
        self._collector = files.S3FileCollector()
        self._logger = logging.getLogger(f"{__name__}.IntegrationAccumulator")
        self._integration_sink_bucket = config.de_bucket

    def persist(self) -> None:
        self._collector.collect()

        for model_cls, s3_object_list in self._collector.in_batches():
            self._logger.info(f"Processing batch of {len(s3_object_list)} {model_cls} objects")
            for obj in s3_object_list:
                try:
                    with smart_open.open(
                        obj.s3_uri, "r", transport_params=self.TRANSPORT_PARAMS
                    ) as fin:
                        if model_data := fin.read():
                            obj.set_data(model_cls, model_data, self._logger)
                        else:
                            self._logger.warning(f"Empty file: {obj.s3_uri}")
                except Exception:
                    self._logger.exception(f"Error reading {obj.s3_uri}")
                    continue

            self._push(s3_object_list)

    def _push(self, s3_object_list: files.S3ObjectList) -> None:
        metadata_ref = s3_object_list[0]

        if is_iterable_integration_model(metadata_ref.data):
            content = "\n".join(
                [
                    obj.model_dump_json()
                    for s3_metadata in s3_object_list
                    if s3_metadata.data
                    for obj in s3_metadata.data
                ]
            )
        else:
            content = "\n".join([obj.data.model_dump_json() for obj in s3_object_list if obj.data])

        with smart_open.open(
            self._batch_file_uri(metadata_ref), "w", transport_params=self.TRANSPORT_PARAMS
        ) as fout:
            fout.write(content)

    def _batch_file_uri(self, obj: files.S3ObjectInfo) -> str:
        fn = f"{str(uuid.uuid4())}.json.gz"

        return f"s3://{self._integration_sink_bucket}/integrations/{obj.category}/{obj.integration}/{obj.name}/{fn}"  # noqa
