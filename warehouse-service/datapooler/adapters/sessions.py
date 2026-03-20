"""
Database Session Management.

This module provides session managers for different database engines:
- TransactionalSessions: PostgreSQL operational database (sync)
- AsyncTransactionalSessions: PostgreSQL with asyncio support
- WarehouseSessions: Redshift data warehouse (read-only)

All session managers implement context managers for automatic:
- Connection lifecycle management
- Transaction handling (commit/rollback)
- Cleanup and connection release

NOTE: expire_on_commit is False because the codebase returns detached ORM
objects from session contexts (e.g. MatchService.get_request).  Setting it
to True would cause DetachedInstanceError on every attribute access after
the session closes.  The previous memory leak was caused by creating a new
scoped_session *registry* on every call — each registry held a reference to
the (closed) Session and its identity-map until the cyclic GC ran.  Using
plain sessionmaker() calls instead ensures each Session is promptly freed
when the context manager exits.
"""

import logging
from contextlib import asynccontextmanager, contextmanager

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session, sessionmaker

from datapooler.adapters.engines import Engines

logger = logging.getLogger(f"{__name__}.Sessions")


class SupportsSession:
    """
    Base protocol for session managers.

    Defines the interface for creating database session context managers.
    """

    sessions: sessionmaker

    @classmethod
    @contextmanager
    def get_session(cls) -> Session:
        """Provide a transactional scope around a series of operations."""
        ...


class TransactionalSessions(SupportsSession):
    """
    Session manager for PostgreSQL transactional database.

    Provides sessions with automatic transaction management:
    - Auto-commit on successful completion
    - Auto-rollback on exceptions

    Usage:
        with TransactionalSessions.get_session() as session:
            session.add(model_instance)
            # Commits automatically on exit
    """

    sessions = sessionmaker(Engines.transactional, expire_on_commit=False)

    @classmethod
    @contextmanager
    def get_session(cls) -> Session:
        """Provide a transactional scope with automatic commit/rollback."""
        session = cls.sessions()
        try:
            yield session
            session.commit()
        except Exception as exc:
            session.rollback()
            raise exc
        finally:
            session.close()


class AsyncTransactionalSessions(SupportsSession):
    """
    Async session manager for PostgreSQL with asyncio support.

    Enables concurrent database operations using async/await.
    Provides same transactional guarantees as TransactionalSessions.

    Usage:
        async with AsyncTransactionalSessions.get_session() as session:
            await session.execute(stmt)
            # Commits automatically on exit
    """

    sessions = sessionmaker(
        Engines.async_transactional, expire_on_commit=False, class_=AsyncSession
    )

    @classmethod
    @asynccontextmanager
    async def get_session(cls) -> AsyncSession:
        """Provide an async transactional scope with automatic commit/rollback."""
        session = cls.sessions()
        try:
            yield session
            await session.commit()
        except Exception as exc:
            await session.rollback()
            raise exc
        finally:
            await session.close()


class WarehouseSessions(SupportsSession):
    """
    Session manager for Redshift data warehouse.

    Read-only sessions for querying analytics data.
    No automatic commit as warehouse queries are typically read-only.

    Usage:
        with WarehouseSessions.get_session() as session:
            result = session.execute(query)
    """

    sessions = sessionmaker(Engines.warehouse, expire_on_commit=False)

    @classmethod
    @contextmanager
    def get_session(cls) -> Session:  # type: ignore
        """Provide a session for warehouse queries (no transaction management)."""
        session = cls.sessions()
        try:
            yield session
        except Exception as exc:
            raise exc
        finally:
            session.close()
