import pytest

from datapooler.adapters import sessions
from datapooler.adapters.db.models.facts import FactDb
from datapooler.models.fact import Fact
from datapooler.services.facts import FactService


@pytest.fixture()
def seed_facts():
    facts = [
        FactDb(
            business_id="business_1",
            name="fact_1",
            value={"key": "value1"},
            received_at="2023-10-01T12:00:00Z",
        ),
        FactDb(
            business_id="business_1",
            name="fact_2",
            value={"key": "value2"},
            received_at="2023-10-01T12:00:00Z",
        ),
    ]
    with sessions.TransactionalSessions.get_session() as session:
        session.bulk_save_objects(facts)
        session.commit()


@pytest.mark.parametrize("business_id, count", [("business_1", 2), ("non_existent_business", 0)])
@pytest.mark.asyncio
async def test_get_facts(seed_facts, business_id, count):
    service = FactService()
    facts = await service.get(business_id)
    assert len(facts) == count

    if count > 0:
        assert all(isinstance(fact, Fact) for fact in facts)
        assert all(fact.business_id == business_id for fact in facts)


@pytest.mark.asyncio
async def test_gather_facts(seed_facts):
    service = FactService()
    facts = await service.gather("business_1", ["fact_1"])
    assert len(facts) == 1
    assert facts[0].name == "fact_1"
    assert facts[0].value == {"key": "value1"}
