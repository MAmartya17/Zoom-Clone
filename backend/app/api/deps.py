from collections.abc import Callable

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import NotAuthenticated
from app.db.session import SessionLocal, get_db
from app.models import User
from app.realtime.room_manager import RoomManager, room_manager
from app.services.auth_service import AuthService

# auto_error=False so we can return our own error body instead of FastAPI's default.
_bearer = HTTPBearer(auto_error=False, description="Token from /auth/login or /auth/signup")


def get_bearer_token(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str | None:
    return credentials.credentials if credentials else None


def get_auth_service(db: Session = Depends(get_db), settings: Settings = Depends(get_settings)) -> AuthService:
    return AuthService(db, settings.auth_session_days)


def get_current_user(
    token: str | None = Depends(get_bearer_token),
    auth: AuthService = Depends(get_auth_service),
) -> User:
    """The signed-in user; responds 401 when the token is missing or invalid."""
    return auth.authenticate(token)


def get_optional_user(
    token: str | None = Depends(get_bearer_token),
    auth: AuthService = Depends(get_auth_service),
) -> User | None:
    """Signed-in user if any. Guests may join meetings from an invite link, as in Zoom."""
    try:
        return auth.authenticate(token) if token else None
    except NotAuthenticated:
        return None


def get_session_factory() -> Callable[[], Session]:
    """Long-lived WebSocket handlers open a short session per operation."""
    return SessionLocal


def get_room_manager() -> RoomManager:
    return room_manager
