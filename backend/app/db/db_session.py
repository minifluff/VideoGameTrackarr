from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

database_url = get_settings().database_url
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
engine = create_engine(database_url, connect_args=connect_args)


if database_url.startswith("sqlite"):
    # Performance pragmas for SQLite — significant speedup with large libraries.
    # WAL allows concurrent reads during writes; larger cache keeps hot pages in memory;
    # NORMAL synchronous is safe with WAL and much faster than FULL.
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA cache_size=-64000")  # 64MB page cache
        cursor.execute("PRAGMA temp_store=MEMORY")  # temp tables in RAM
        cursor.execute("PRAGMA mmap_size=268435456")  # 256MB memory-mapped I/O
        cursor.execute("PRAGMA busy_timeout=30000")  # Wait up to 30s for a write lock instead of failing
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
