import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

import app.models  # noqa: F401  (registers tables on Base.metadata)
from app.api.v1.router import api_router
from app.api.v1.ws import router as ws_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.seed import seed_if_empty
from app.services.meeting_service import MeetingService

logging.basicConfig(level=logging.INFO)


def _ensure_schema_is_current() -> None:
    """create_all() never alters existing tables, so fail loudly on an old DB file."""
    inspector = inspect(engine)
    if inspector.has_table("users") and "password_hash" not in {c["name"] for c in inspector.get_columns("users")}:
        raise RuntimeError(
            "The database was created by an older version of the app. "
            "Run `python -m app.seed --reset` to recreate it."
        )


def initialize_database(settings: Settings) -> None:
    _ensure_schema_is_current()
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        MeetingService(db).reconcile_after_restart()
        if settings.seed_on_startup:
            seed_if_empty(db, settings)


def create_app(settings: Settings | None = None, init_db: bool = True) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if init_db:
            initialize_database(settings)
        yield

    app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(api_router)
    app.include_router(ws_router)

    @app.get("/health", tags=["health"])
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
