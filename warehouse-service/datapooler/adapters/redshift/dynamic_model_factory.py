from datetime import date, datetime, time
from typing import Any, Dict, Optional, Type

import sqlalchemy.types as sql_types
from pydantic import ConfigDict, Field, create_model
from sqlalchemy import Table


class DynamicModelFactory:
    """Factory class to create and cache dynamic Pydantic models for database tables."""

    _model_cache: Dict[str, Type] = {}

    @classmethod
    def create_model_for_table(cls, table: Table, model_name: str = None) -> Type:
        """Create a dynamic Pydantic model based on SQLAlchemy table columns."""
        if model_name is None:
            model_name = f"{table.name.title()}Model"

        # Check cache first
        cache_key = f"{table.schema}_{table.name}" if table.schema else table.name
        if cache_key in cls._model_cache:
            return cls._model_cache[cache_key]

        fields = {}
        for column in table.columns:
            python_type = cls._map_sqlalchemy_to_python_type(column.type)

            # Make field optional if column is nullable
            if column.nullable:
                python_type = Optional[python_type]
                default_value = Field(default=None)
            else:
                default_value = Field(...)

            fields[column.name] = (python_type, default_value)

        # Create the dynamic model with config similar to BaseDataPoolerModel
        dynamic_model = create_model(
            model_name,
            **fields,
            __config__=ConfigDict(
                populate_by_name=True,
                validate_assignment=True,
                extra="ignore",
                coerce_numbers_to_str=True,
            ),
        )

        # Cache it
        cls._model_cache[cache_key] = dynamic_model

        return dynamic_model

    @classmethod
    def _map_sqlalchemy_to_python_type(cls, sqlalchemy_type) -> Type:
        """Map SQLAlchemy column types to Python types."""
        type_mapping = {
            sql_types.String: str,
            sql_types.Text: str,
            sql_types.Integer: int,
            sql_types.BigInteger: int,
            sql_types.SmallInteger: int,
            sql_types.Float: float,
            sql_types.Numeric: float,
            sql_types.DECIMAL: float,
            sql_types.Boolean: bool,
            sql_types.DateTime: datetime,
            sql_types.Date: date,
            sql_types.Time: time,
        }

        for sql_type, python_type in type_mapping.items():
            if isinstance(sqlalchemy_type, sql_type):
                return python_type

        # Default to Any for unknown types
        return Any

    @classmethod
    def clear_cache(cls):
        """Clear the model cache (useful for testing)."""
        cls._model_cache.clear()
