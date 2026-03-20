import datetime
import logging
from collections import defaultdict
from typing import Any, Iterator, Optional

import boto3
from dateutil import parser
from more_itertools import chunked
from pydantic.dataclasses import dataclass

from datapooler import config
from datapooler.models.integrations.lookup import (
    AnyIntegrationModel,
    is_iterable_integration_model,
    model_lookup,
)

type S3Metadata = tuple[str, str, str, dict[str, Any]]
type S3ObjectList = list[S3ObjectInfo]

FILE_COMBINATIONS = {
    ("accounting", "rutter", "balancesheet"),
    ("accounting", "rutter", "business_info"),
    ("accounting", "rutter", "cashflow"),
    ("accounting", "rutter", "incomestatement"),
    ("business_entity_verification", "MIDDESK", "business_entity_verification"),
    ("credit_bureau", "EQUIFAX", "judgementsLiens"),
    ("public_records", "verdata", "public_records"),
}


# Use a dataclass over a genric like dict so that we have increased readability and type checking.
@dataclass
class S3ObjectInfo:
    business_id: str
    s3_uri: str
    category: str
    integration: str
    name: str
    collected_at: datetime.datetime
    data: Optional[AnyIntegrationModel] = None

    def set_data(
        self, model: AnyIntegrationModel, data: str | bytes, _logger: logging.Logger
    ) -> None:
        try:
            self.data = model.model_validate_json(data)

            if is_iterable_integration_model(self.data):
                for item in self.data:
                    item.business_id = self.business_id
                    item.collected_at = self.collected_at
            else:
                self.data.business_id = self.business_id
                self.data.collected_at = self.collected_at

        except Exception:
            _logger.exception(f"Error validating {model}")


class S3FileCollector:
    def __init__(self, max_keys: int = 50_000) -> None:
        self._client = boto3.client("s3")
        self._paginator = self._client.get_paginator("list_objects_v2")
        self._bucket = config.integration_bucket
        self._logger = logging.getLogger(f"{__name__}.{self.__class__}")

        self.collection: dict[AnyIntegrationModel, S3ObjectList] = defaultdict(list)
        self._max_keys = max_keys
        self._last_run = config.last_integration_run

    @staticmethod
    def extract_business_id(s3_key) -> str:
        # Pattern Matching is available in Python 3.10+
        match s3_key.split("/"):
            case ["businesses", uuid, *_] if len(uuid) == 36:
                return uuid
            case _:
                return None

    def in_batches(self, n: int = 10_000) -> Iterator[tuple[AnyIntegrationModel, S3ObjectList]]:
        self.collect()

        for model_cls, s3_object_list in self.collection.items():
            self._logger.info(f"Processing {len(s3_object_list)} {model_cls} objects")
            for batch in chunked(s3_object_list, n):
                yield model_cls, batch

        self.collection.clear()

    def _store(self, category, integration, name, obj) -> dict[AnyIntegrationModel, S3ObjectList]:
        business_id = self.extract_business_id(obj["Key"])
        s3_uri = f"s3://{self._bucket}/{obj['Key']}"

        # If the business_id is not found, skip the object.
        # This should be investigated further to understand why the business_id is missing.
        if not business_id:
            self._logger.warning(f"Skipping {s3_uri} as it does not contain a business_id!")

            return

        s3_obj_info = S3ObjectInfo(
            business_id=business_id,
            s3_uri=s3_uri,
            category=category,
            integration=integration,
            name=name,
            collected_at=obj["LastModified"],
        )

        self.collection[model_lookup(category, integration, name)].append(s3_obj_info)

    def collect(self) -> dict[AnyIntegrationModel, S3ObjectList]:
        for page in self._paginator.paginate(Bucket=self._bucket, MaxKeys=self._max_keys):
            if "Contents" in page:
                for obj in page["Contents"]:
                    for category, integration, name in FILE_COMBINATIONS:
                        if (
                            f"{category}/{integration}/{name}" in obj["Key"]
                            and parser.parse(obj["LastModified"]) > self._last_run
                        ):

                            self._store(category, integration, name, obj)
