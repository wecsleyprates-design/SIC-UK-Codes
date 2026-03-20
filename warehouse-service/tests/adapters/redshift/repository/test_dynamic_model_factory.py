"""Test suite for DynamicModelFactory with comprehensive edge cases."""

from datetime import date, datetime, time
from unittest.mock import Mock

import pytest
from pydantic import ValidationError
from sqlalchemy import (
    DECIMAL,
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    Integer,
    MetaData,
    Numeric,
    SmallInteger,
    String,
    Table,
    Text,
    Time,
)

from datapooler.adapters.redshift.dynamic_model_factory import DynamicModelFactory


class TestDynamicModelFactory:
    """Test the DynamicModelFactory class."""

    def setup_method(self):
        """Clear cache before each test."""
        DynamicModelFactory.clear_cache()

    def test_create_model_basic_types(self):
        """Test model creation with basic SQLAlchemy types."""
        metadata = MetaData()
        table = Table(
            "test_table",
            metadata,
            Column("id", Integer, primary_key=True),
            Column("name", String(50), nullable=False),
            Column("description", Text, nullable=True),
            Column("active", Boolean, nullable=False),
            Column("created_at", DateTime, nullable=False),
        )

        model = DynamicModelFactory.create_model_for_table(table)

        # Test model creation
        assert model.__name__ == "Test_TableModel"  # table.name.title() gives Test_Table

        # Test field types
        fields = model.model_fields
        assert "id" in fields
        assert "name" in fields
        assert "description" in fields
        assert "active" in fields
        assert "created_at" in fields

    def test_create_model_numeric_types(self):
        """Test model creation with various numeric types."""
        metadata = MetaData()
        table = Table(
            "numeric_table",
            metadata,
            Column("big_int", BigInteger),
            Column("small_int", SmallInteger),
            Column("float_val", Float),
            Column("numeric_val", Numeric(10, 2)),
            Column("decimal_val", DECIMAL(8, 2)),
        )

        model = DynamicModelFactory.create_model_for_table(table)

        # Test that model can be created and validated
        instance = model(
            big_int=1234567890,
            small_int=123,
            float_val=123.45,
            numeric_val=999.99,
            decimal_val=888.88,
        )

        assert instance.big_int == 1234567890
        assert instance.small_int == 123
        assert instance.float_val == 123.45

    def test_create_model_datetime_types(self):
        """Test model creation with datetime types."""
        metadata = MetaData()
        table = Table(
            "datetime_table",
            metadata,
            Column("datetime_col", DateTime, nullable=True),  # Make nullable for optional data
            Column("date_col", Date, nullable=True),
            Column("time_col", Time, nullable=True),
            Column("required_datetime", DateTime, nullable=False),  # One required field
        )

        model = DynamicModelFactory.create_model_for_table(table)

        # Test datetime handling with required field only
        now = datetime.now()

        instance = model(required_datetime=now)

        # Check that required field is set
        assert instance.required_datetime == now

        # Check that nullable fields default to None
        assert instance.datetime_col is None
        assert instance.date_col is None
        assert instance.time_col is None

        # Test with all fields provided
        today = date.today()
        current_time = time(10, 30, 0)

        instance_full = model(
            datetime_col=now, date_col=today, time_col=current_time, required_datetime=now
        )

        assert instance_full.datetime_col == now
        assert instance_full.date_col == today
        assert instance_full.time_col == current_time
        assert instance_full.required_datetime == now

    def test_nullable_vs_required_fields(self):
        """Test that nullable fields are optional and non-nullable are required."""
        metadata = MetaData()
        table = Table(
            "nullable_test",
            metadata,
            Column("required_field", String(50), nullable=False),
            Column("optional_field", String(50), nullable=True),
        )

        model = DynamicModelFactory.create_model_for_table(table)

        # Test required field only
        instance1 = model(required_field="test")
        assert instance1.required_field == "test"
        assert instance1.optional_field is None

        # Test both fields
        instance2 = model(required_field="test", optional_field="optional")
        assert instance2.required_field == "test"
        assert instance2.optional_field == "optional"

        # Test missing required field should raise validation error
        with pytest.raises(ValidationError):
            model(optional_field="only optional")

    def test_table_with_schema(self):
        """Test model creation for table with schema."""
        metadata = MetaData()
        table = Table(
            "schema_table",
            metadata,
            Column("id", Integer),
            Column("name", String),
            schema="test_schema",
        )

        DynamicModelFactory.create_model_for_table(table)

        # Cache key should include schema
        assert "test_schema_schema_table" in DynamicModelFactory._model_cache

    def test_model_caching(self):
        """Test that models are properly cached."""
        metadata = MetaData()
        table = Table("cached_table", metadata, Column("id", Integer), Column("name", String))

        # Create model twice
        model1 = DynamicModelFactory.create_model_for_table(table)
        model2 = DynamicModelFactory.create_model_for_table(table)

        # Should be the same object due to caching
        assert model1 is model2
        assert len(DynamicModelFactory._model_cache) == 1

    def test_custom_model_name(self):
        """Test creating model with custom name."""
        metadata = MetaData()
        table = Table("test_table", metadata, Column("id", Integer))

        model = DynamicModelFactory.create_model_for_table(table, "CustomModelName")
        assert model.__name__ == "CustomModelName"

    def test_unknown_column_type(self):
        """Test handling of unknown SQLAlchemy column types."""
        metadata = MetaData()

        # Create a mock column with unknown type
        unknown_type = Mock()
        unknown_type.__class__.__name__ = "UnknownType"

        table = Table(
            "unknown_type_table",
            metadata,
            Column("id", Integer),
            Column("unknown_col", unknown_type),
        )

        model = DynamicModelFactory.create_model_for_table(table)

        # Should create model with Any type for unknown column
        instance = model(id=1, unknown_col="anything")
        assert instance.id == 1
        assert instance.unknown_col == "anything"

    def test_clear_cache(self):
        """Test cache clearing functionality."""
        metadata = MetaData()
        table = Table("cache_test", metadata, Column("id", Integer))

        # Create model to populate cache
        DynamicModelFactory.create_model_for_table(table)
        assert len(DynamicModelFactory._model_cache) == 1

        # Clear cache
        DynamicModelFactory.clear_cache()
        assert len(DynamicModelFactory._model_cache) == 0

    def test_multiple_tables_different_schemas(self):
        """Test creating models for tables with same name but different schemas."""
        metadata = MetaData()

        table1 = Table("same_name", metadata, Column("id", Integer), schema="schema1")

        table2 = Table(
            "same_name",
            metadata,
            Column("id", Integer),
            Column("extra_field", String),
            schema="schema2",
        )

        model1 = DynamicModelFactory.create_model_for_table(table1)
        model2 = DynamicModelFactory.create_model_for_table(table2)

        # Should be different models
        assert model1 is not model2
        assert len(DynamicModelFactory._model_cache) == 2

        # Test different field sets
        instance1 = model1(id=1)
        instance2 = model2(id=1, extra_field="test")

        assert not hasattr(instance1, "extra_field")
        assert hasattr(instance2, "extra_field")

    def test_complex_table_structure(self):
        """Test with a complex table structure similar to real warehouse tables."""
        metadata = MetaData()
        table = Table(
            "complex_business_table",
            metadata,
            Column("business_id", String(50), primary_key=True, nullable=False),
            Column("company_name", String(255), nullable=False),
            Column("legal_name", String(255), nullable=True),
            Column("address", Text, nullable=True),
            Column("city", String(100), nullable=True),
            Column("state", String(10), nullable=True),
            Column("zip_code", String(20), nullable=True),
            Column("phone", String(20), nullable=True),
            Column("revenue", BigInteger, nullable=True),
            Column("employee_count", Integer, nullable=True),
            Column("active", Boolean, nullable=False, default=True),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=True),
            schema="warehouse",
        )

        model = DynamicModelFactory.create_model_for_table(table)

        # Test creating instance with realistic data
        now = datetime.now()
        instance = model(
            business_id="BUS_001",
            company_name="ACME CORPORATION",
            legal_name="ACME CORP LLC",
            address="123 MAIN STREET",
            city="LOS ANGELES",
            state="CA",
            zip_code="90210",
            phone="555-123-4567",
            revenue=1000000,
            employee_count=50,
            active=True,
            created_at=now,
            updated_at=None,
        )

        assert instance.business_id == "BUS_001"
        assert instance.company_name == "ACME CORPORATION"
        assert instance.revenue == 1000000
        assert instance.active is True
        assert instance.updated_at is None

    def test_edge_case_empty_table(self):
        """Test handling of table with no columns (edge case)."""
        metadata = MetaData()
        table = Table("empty_table", metadata)

        model = DynamicModelFactory.create_model_for_table(table)

        # Should create a model with no fields
        instance = model()
        assert isinstance(instance, model)

    @pytest.mark.parametrize(
        "field_name",
        [
            "id",
            "name",
            "description",
            "created_at",
            "updated_at",
            "business_id",
            "company_name",
            "revenue",
            "active",
        ],
    )
    def test_common_field_names(self, field_name):
        """Test that common database field names are handled correctly."""
        metadata = MetaData()
        table = Table("test_table", metadata, Column(field_name, String))

        model = DynamicModelFactory.create_model_for_table(table)
        instance = model(**{field_name: "test_value"})

        assert getattr(instance, field_name) == "test_value"

    def test_model_validation_errors(self):
        """Test that models properly validate data types."""
        metadata = MetaData()
        table = Table(
            "validation_test",
            metadata,
            Column("integer_field", Integer, nullable=False),
            Column("boolean_field", Boolean, nullable=False),
        )

        model = DynamicModelFactory.create_model_for_table(table)

        # Valid data should work
        valid_instance = model(integer_field=123, boolean_field=True)
        assert valid_instance.integer_field == 123
        assert valid_instance.boolean_field is True

        # Invalid data should raise ValidationError
        with pytest.raises(ValidationError):
            model(integer_field="not_an_integer", boolean_field=True)
