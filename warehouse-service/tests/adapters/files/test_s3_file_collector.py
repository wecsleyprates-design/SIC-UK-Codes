from unittest.mock import patch

import pytest

from datapooler.adapters.files.integrations import S3FileCollector, S3ObjectInfo

CATEGORY = "accounting"
INTEGRATION = "rutters"
NAME = "judgementsLiens"
S3_OBJECTS_RETURN_VALUE = [
    {
        "Key": "businesses/00000000-ec23-4c2b-b4d3-c79c4eed9e75/accounting/rutters/judgementsLiens.json"  # noqa
    },
    {
        "Key": "businesses/12345678-ec23-4c2b-b4d3-c79c4eed9e75/accounting/rutters/judgementsLiens.json"  # noqa
    },
]


@pytest.fixture()
def stub_s3_objects_method():
    with patch.object(S3FileCollector, "_s3_objects", return_value=iter(S3_OBJECTS_RETURN_VALUE)):
        yield


@pytest.fixture()
def s3_file_collector_instance():
    return S3FileCollector(CATEGORY, INTEGRATION, NAME)


@pytest.mark.skip()
def test_extract_business_id(s3_file_collector_instance):
    bid = s3_file_collector_instance.extract_business_id(
        "businesses/00202ac4-ec23-4c2b-b4d3-c79c4eed9e75/judgementsLiens.json"
    )

    assert bid == "00202ac4-ec23-4c2b-b4d3-c79c4eed9e75"


@pytest.mark.skip()
def test_s3_substring(s3_file_collector_instance):
    assert s3_file_collector_instance.s3_substring == "accounting/rutters/judgementsLiens"


@pytest.mark.skip()
def test_s3_objects_method(s3_file_collector_instance, stub_s3_objects_method):
    s3_object = next(s3_file_collector_instance._s3_objects())

    assert s3_object == S3_OBJECTS_RETURN_VALUE[0]


@pytest.mark.skip()
def test_iter_objects_method(s3_file_collector_instance, stub_s3_objects_method):
    s3_object_info = [*s3_file_collector_instance.iter_objects()]

    assert s3_object_info == [
        S3ObjectInfo(
            business_id="00000000-ec23-4c2b-b4d3-c79c4eed9e75",
            s3_uri="s3://worthai-prod-integrations-raw-data/businesses/00000000-ec23-4c2b-b4d3-c79c4eed9e75/accounting/rutters/judgementsLiens.json",  # noqa
            category="accounting",
            integration="rutters",
            name="judgementsLiens",
        ),
        S3ObjectInfo(
            business_id="12345678-ec23-4c2b-b4d3-c79c4eed9e75",
            s3_uri="s3://worthai-prod-integrations-raw-data/businesses/12345678-ec23-4c2b-b4d3-c79c4eed9e75/accounting/rutters/judgementsLiens.json",  # noqa
            category="accounting",
            integration="rutters",
            name="judgementsLiens",
        ),
    ]


@pytest.mark.skip()
def test_in_batches(s3_file_collector_instance, stub_s3_objects_method):
    s3_object_info = next(s3_file_collector_instance.in_batches(batch_size=1))

    assert s3_object_info == [
        S3ObjectInfo(
            business_id="00000000-ec23-4c2b-b4d3-c79c4eed9e75",
            s3_uri="s3://worthai-prod-integrations-raw-data/businesses/00000000-ec23-4c2b-b4d3-c79c4eed9e75/accounting/rutters/judgementsLiens.json",  # noqa
            category="accounting",
            integration="rutters",
            name="judgementsLiens",
        ),
    ]
