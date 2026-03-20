"""
Database Engine Configuration.

This module creates and configures SQLAlchemy engines for connecting to:
- Redshift: Data warehouse for analytics (read-mostly operations)
- PostgreSQL: Transactional database for operational data (read-write)

Connection pooling strategies:
- Redshift uses NullPool (no connection pooling) due to serverless architecture
- PostgreSQL uses default QueuePool for efficient connection reuse
- Async engine supports asyncio-based database operations
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from datapooler import config


class Engines:
    """
    Database engine instances for the application.

    Attributes:
        warehouse: Redshift engine for data warehouse queries
        transactional: PostgreSQL engine for operational data
        async_transactional: Async PostgreSQL engine for concurrent operations
    """

    # Redshift data warehouse - uses NullPool to avoid connection pooling
    # with serverless Redshift which manages connections dynamically
    warehouse = create_engine(
        config.redshift_connection_string(),
        connect_args=config.redshift_connection_args(),
        pool_pre_ping=True,  # Verify connections before use
        poolclass=NullPool,  # No pooling for serverless Redshift
    )

    # PostgreSQL operational database - uses QueuePool with periodic recycling
    # to avoid accumulating stale connections and Python-side buffers.
    transactional = create_engine(
        config.postgres_connection_string(),
        pool_size=5,
        max_overflow=5,
        pool_recycle=300,
        pool_pre_ping=True,
    )

    # Async PostgreSQL engine for asyncio-based operations
    async_transactional = create_async_engine(
        config.postgres_connection_string(_async=True),
        pool_size=5,
        max_overflow=5,
        pool_recycle=300,
        pool_pre_ping=True,
    )
