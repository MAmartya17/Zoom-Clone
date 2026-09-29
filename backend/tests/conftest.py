from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_room_manager, get_session_factory
from app.core.config import Settings, get_settings
from app.db.base import Base
from app.db.session import build_engine, get_db
from app.main import create_app
from app.realtime.room_manager import RoomManager
from app.services.user_service import UserService

TEST_APP_URL = "http://app.test"


@pytest.fixture
def settings() -> Settings:
    return Settings(
        database_url="sqlite://",
        public_app_url=TEST_APP_URL,
        seed_on_startup=False,
        empty_room_grace_seconds=60,
    )


@pytest.fixture
def session_factory() -> Iterator[sessionmaker]:
    # One shared in-memory connection so every session sees the same database.
    engine = build_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    engine.dispose()


@pytest.fixture
def db(session_factory) -> Iterator[Session]:
    with session_factory() as session:
        yield session


@pytest.fixture
def app(settings, session_factory):
    app = create_app(settings, init_db=False)
    rooms = RoomManager()

    def override_get_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_session_factory] = lambda: session_factory
    app.dependency_overrides[get_room_manager] = lambda: rooms
    return app


@pytest.fixture
def guest_client(app) -> Iterator[TestClient]:
    """Not signed in (e.g. someone who only has an invite link)."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def client(app, settings, session_factory) -> Iterator[TestClient]:
    """Signed in as the seeded demo host (Alex Morgan)."""
    with session_factory() as db:
        UserService(db).get_or_create_default_user(settings)
    with TestClient(app) as test_client:
        response = test_client.post(
            "/api/v1/auth/login",
            json={"email": settings.default_user_email, "password": settings.default_user_password},
        )
        assert response.status_code == 200, response.text
        test_client.headers["Authorization"] = f"Bearer {response.json()['token']}"
        yield test_client


def future_iso(**delta) -> str:
    return (datetime.now(timezone.utc) + timedelta(**delta)).isoformat()


@pytest.fixture
def instant_meeting(client) -> dict:
    response = client.post("/api/v1/meetings/instant")
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def schedule_payload() -> dict:
    return {
        "title": "Design Review",
        "description": "Walkthrough",
        "start_time": future_iso(days=1),
        "duration_minutes": 45,
        "timezone": "Asia/Kolkata",
    }
