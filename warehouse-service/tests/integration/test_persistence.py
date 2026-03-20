from datapooler.adapters import sessions
from datapooler.adapters.db.models import matching


def test_match_result_db():
    match_request = matching.MatchRequestDb(
        match_id="123",
        business_id="456",
        names=["name1", "name2"],
        addresses=[{"address": "123 Main St", "state": "CA", "zip": "12345"}],
        extra={"key": "value"},
        status="completed",
    )
    match_result = matching.MatchResultDb(
        match_id="123",
        business_id="456",
        source="source",
        match={"key": "value"},
        prediction=0.5,
    )

    with sessions.TransactionalSessions.get_session() as session:
        match_request.match_results.append(match_result)
        session.add(match_request)
        session.commit()

    assert match_result.id is not None

    with sessions.TransactionalSessions.get_session() as session:
        match_result_from_db = (
            session.query(matching.MatchResultDb).filter_by(id=match_result.id).one()
        )
        assert match_result_from_db.match_id == "123"
        assert match_result_from_db.business_id == "456"
        assert match_result_from_db.source == "source"
        assert match_result_from_db.match == {"key": "value"}
        assert match_result_from_db.prediction == 0.5
