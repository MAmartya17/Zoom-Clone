from collections.abc import Callable

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import SessionLocal, get_db
from app.models import User
from app.realtime.room_manager import RoomManager, room_manager
from app.services.user_service import UserService


def get_current_user(db: Session = Depends(get_db), settings: Settings = Depends(get_settings)) -> User:
    """Authentication seam.

    The assignment assumes a logged-in default user. Adding real auth means
    replacing this body with token/session verification; routes and services
    that depend on `get_current_user` stay unchanged.
    """
    return UserService(db).get_or_create_default_user(settings)


def get_session_factory() -> Callable[[], Session]:
    """Long-lived WebSocket handlers open a short session per operation."""
    return SessionLocal


def get_room_manager() -> RoomManager:
    return room_manager
