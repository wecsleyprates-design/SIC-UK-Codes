import pytest

from datapooler.adapters.messages.producer import KafkaMessageSender
from datapooler.services.match import MatchResult
from datapooler.services.similarity import SimilarityResult


# TODO: Fix this test for github actions
@pytest.mark.skip(
    reason="This test requires a running Kafka instance, which is flakey in github actions"
)
@pytest.mark.parametrize(
    "message",
    [
        # {"key": "value"},
        # "test",
        MatchResult(
            match_id="123",
            business_id="456",
            source="equifax",
            matches=[
                SimilarityResult(
                    integration_business={
                        "efx_id": "123",
                        "name": "Equifax Business 1",
                        "legal_name": "Equifax Business 1",
                        "address": "123 Elm St",
                        "city": "San Francisco",
                        "state": "CA",
                        "zip": "94101",
                        "contct": "John Doe",
                        "ceo": "Jane Doe",
                        "source": "Equifax",
                        "zip3": "941",
                        "state_code": "CA",
                        "normalized_address": "123 Elm St, San Francisco, CA 94101",
                        "street_number": "123",
                        "street_name": "Elm",
                        "short_name": "EQUIFAXBUSINESS",
                    },
                    prediction=0.5,
                ),
                SimilarityResult(
                    integration_business={
                        "efx_id": "456",
                        "name": "Equifax Business 2",
                        "legal_name": "Equifax Business 2",
                        "address": "456 Oak St",
                        "city": "San Francisco",
                        "state": "CA",
                        "zip": "94102",
                        "contct": "John Doe",
                        "ceo": "Jane Doe",
                        "source": "Equifax",
                        "zip3": "941",
                        "state_code": "CA",
                        "normalized_address": "456 Oak St, San Francisco, CA 94102",
                        "street_number": "456",
                        "street_name": "Oak",
                        "short_name": "EQUIFAXBUSINESS",
                    },
                    prediction=0.6,
                ),
            ],
        ),
    ],
)
def test_kafka_message_sender_expected_message_types(message):
    with KafkaMessageSender.connect(topic="test-topic") as kafka_message_sender:
        assert kafka_message_sender.send("test-key", message)


def test_kafka_message_unexpected_message_type():
    # False means the message was not sent
    with KafkaMessageSender.connect(topic="test-topic") as kafka_message_sender:
        assert kafka_message_sender.send("test-key", 123) is False
