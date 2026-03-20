from sqlalchemy import BigInteger, Column, Float, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from datapooler.adapters.db.models import base, mixins


class MatchRequestDb(mixins.TimestampMixin, base.Base):
    __tablename__ = "match_requests"

    id = Column(BigInteger, primary_key=True)
    match_id = Column(String, index=True, unique=True, nullable=False)
    business_id = Column(String, nullable=False)
    names = Column(JSONB, default=list, nullable=False)
    addresses = Column(JSONB, default=list, nullable=False)
    extra = Column(JSONB, default=dict)
    status = Column(String, index=True, nullable=False)
    match_results = relationship(
        "MatchResultDb",
        back_populates="match_request",
        cascade="all, delete",
        passive_deletes=True,
    )


class MatchResultDb(mixins.TimestampMixin, base.Base):
    __tablename__ = "match_results"

    id = Column(BigInteger, primary_key=True)
    match_id = Column(
        String,
        ForeignKey("match_requests.match_id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    business_id = Column(String, nullable=False)
    source = Column(String, nullable=False)
    match = Column(JSONB, nullable=False)
    prediction = Column(Float)

    match_request = relationship("MatchRequestDb", back_populates="match_results")

    __table_args__ = (Index("ix_match_results_match_id_source", "match_id", "source"),)
