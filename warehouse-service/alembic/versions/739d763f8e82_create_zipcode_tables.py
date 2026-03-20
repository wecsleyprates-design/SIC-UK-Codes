"""create zipcode tables

Revision ID: 20250603141043
Revises: 20250513165615
Create Date: 2025-06-03 14:10:43

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20250603141043"
down_revision = "20250513165615"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ca_zip_codes",
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("postal_code", sa.String(length=10), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("province_abbr", sa.String(length=2), nullable=False),
        sa.Column("timezone", sa.SmallInteger(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_ca_zip_codes_id"), "ca_zip_codes", ["id"], unique=False, if_not_exists=True
    )
    op.create_index(
        op.f("ix_ca_zip_codes_postal_code"),
        "ca_zip_codes",
        ["postal_code"],
        unique=False,
        if_not_exists=True,
    )

    op.create_table(
        "us_zip_codes",
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("zip_code", sa.String(length=5), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("county", sa.String(length=100), nullable=True),
        sa.Column("state", sa.String(length=2), nullable=False),
        sa.Column("county_fips", sa.SmallInteger(), nullable=True),
        sa.Column("state_fips", sa.SmallInteger(), nullable=True),
        sa.Column("timezone", sa.SmallInteger(), nullable=True),
        sa.Column("daylight_savings", sa.Boolean(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_us_zip_codes_id"), "us_zip_codes", ["id"], unique=False, if_not_exists=True
    )
    op.create_index(
        op.f("ix_us_zip_codes_zip_code"),
        "us_zip_codes",
        ["zip_code"],
        unique=False,
        if_not_exists=True,
    )
    op.get_context().execute("COMMIT;")


def downgrade() -> None:
    op.drop_index(op.f("ix_us_zip_codes_zip_code"), table_name="us_zip_codes")
    op.drop_index(op.f("ix_us_zip_codes_id"), table_name="us_zip_codes")
    op.drop_table("us_zip_codes")
    op.drop_index(op.f("ix_ca_zip_codes_postal_code"), table_name="ca_zip_codes")
    op.drop_index(op.f("ix_ca_zip_codes_id"), table_name="ca_zip_codes")
    op.drop_table("ca_zip_codes")
