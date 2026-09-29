from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


def build_engine(database_url: str, **kwargs) -> Engine:
    is_sqlite = database_url.startswith("sqlite")
    connect_args = {"check_same_thread": False} if is_sqlite else {}
    engine = create_engine(database_url, connect_args=connect_args, **kwargs)

    if is_sqlite:
        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_connection, _):
            cursor = dbapi_connection.cursor()
            # SQLite ignores FOREIGN KEY constraints unless enabled per connection.
            cursor.execute("PRAGMA foreign_keys=ON")
            # WAL lets readers proceed while a write is in progress.
            if ":memory:" not in database_url:
                cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

    return engine


engine = build_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
