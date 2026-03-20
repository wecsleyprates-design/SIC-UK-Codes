"""add foreign key constraint

Revision ID: 20260114145457
Revises: 20251002124428
Create Date: 2026-01-14 14:54:57

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260114145457"
down_revision = "20251002124428"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("match_requests", "match_id", existing_type=sa.VARCHAR(), nullable=False)
    op.alter_column("match_requests", "business_id", existing_type=sa.VARCHAR(), nullable=False)
    op.alter_column(
        "match_requests",
        "names",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=False,
    )
    op.alter_column(
        "match_requests",
        "addresses",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=False,
    )
    op.alter_column("match_requests", "status", existing_type=sa.VARCHAR(), nullable=False)
    op.drop_index(op.f("ix_match_requests_match_id"), table_name="match_requests")
    op.create_index(op.f("ix_match_requests_match_id"), "match_requests", ["match_id"], unique=True)
    op.create_index(op.f("ix_match_requests_status"), "match_requests", ["status"], unique=False)
    op.alter_column("match_results", "match_id", existing_type=sa.VARCHAR(), nullable=False)
    op.alter_column("match_results", "business_id", existing_type=sa.VARCHAR(), nullable=False)
    op.alter_column("match_results", "source", existing_type=sa.VARCHAR(), nullable=False)
    op.alter_column(
        "match_results",
        "match",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=False,
    )
    op.create_index(
        "ix_match_results_match_id_source", "match_results", ["match_id", "source"], unique=False
    )
    op.create_foreign_key(
        "fk_match_results_match_requests_match_id",
        "match_results",
        "match_requests",
        ["match_id"],
        ["match_id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_match_results_match_requests_match_id", "match_results", type_="foreignkey"
    )
    op.drop_index("ix_match_results_match_id_source", table_name="match_results")
    op.alter_column(
        "match_results",
        "match",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
    )
    op.alter_column("match_results", "source", existing_type=sa.VARCHAR(), nullable=True)
    op.alter_column("match_results", "business_id", existing_type=sa.VARCHAR(), nullable=True)
    op.alter_column("match_results", "match_id", existing_type=sa.VARCHAR(), nullable=True)
    op.drop_index(op.f("ix_match_requests_status"), table_name="match_requests")
    op.drop_index(op.f("ix_match_requests_match_id"), table_name="match_requests")
    op.create_index(
        op.f("ix_match_requests_match_id"), "match_requests", ["match_id"], unique=False
    )
    op.alter_column("match_requests", "status", existing_type=sa.VARCHAR(), nullable=True)
    op.alter_column(
        "match_requests",
        "addresses",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
    )
    op.alter_column(
        "match_requests",
        "names",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
    )
    op.alter_column("match_requests", "business_id", existing_type=sa.VARCHAR(), nullable=True)
    op.alter_column("match_requests", "match_id", existing_type=sa.VARCHAR(), nullable=True)
