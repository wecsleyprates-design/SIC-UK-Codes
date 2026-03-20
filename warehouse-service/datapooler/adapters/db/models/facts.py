from sqlalchemy import BigInteger, Column, DateTime, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB

from datapooler.adapters.db.models import base, mixins


class FactDb(mixins.TimestampMixin, base.Base):
    __tablename__ = "facts"

    id = Column(BigInteger, autoincrement=True)
    business_id = Column(String, primary_key=True, index=True)
    name = Column(String, primary_key=True, index=True)
    value = Column(JSONB)
    received_at = Column(DateTime(timezone=True), index=True)

    __table_args__ = (UniqueConstraint("business_id", "name", name="uq_business_id_name"),)
