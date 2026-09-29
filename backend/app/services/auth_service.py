from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.clock import utc_now
from app.core.errors import EmailAlreadyRegistered, InvalidCredentials, NotAuthenticated
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    generate_session_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models import AuthSession, User
from app.repositories.auth_session_repository import AuthSessionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, SignupRequest


@dataclass(frozen=True)
class SignedIn:
    user: User
    token: str


class AuthService:
    """Sign-up, sign-in, sign-out and bearer-token verification."""

    def __init__(self, db: Session, session_days: int = 30):
        self.db = db
        self.users = UserRepository(db)
        self.sessions = AuthSessionRepository(db)
        self.session_lifetime = timedelta(days=session_days)

    def signup(self, request: SignupRequest) -> SignedIn:
        if self.users.get_by_email(request.email):
            raise EmailAlreadyRegistered()
        user = User(name=request.name, email=request.email, password_hash=hash_password(request.password))
        try:
            self.users.add(user)
        except IntegrityError:
            # Two concurrent sign-ups with the same email: the UNIQUE constraint decides.
            self.db.rollback()
            raise EmailAlreadyRegistered() from None
        return self._start_session(user)

    def login(self, request: LoginRequest) -> SignedIn:
        user = self.users.get_by_email(request.email)
        # Always run the hash check so unknown emails aren't faster to reject.
        password_ok = verify_password(request.password, user.password_hash if user else DUMMY_PASSWORD_HASH)
        if user is None or not password_ok:
            raise InvalidCredentials()
        return self._start_session(user)

    def logout(self, token: str) -> None:
        self.sessions.delete_by_hash(hash_token(token))
        self.db.commit()

    def authenticate(self, token: str | None) -> User:
        if not token:
            raise NotAuthenticated()
        session = self.sessions.get_active(hash_token(token), utc_now())
        if session is None:
            raise NotAuthenticated("Your session has expired. Please sign in again.")
        return session.user

    def _start_session(self, user: User) -> SignedIn:
        now = utc_now()
        token = generate_session_token()
        self.sessions.delete_expired(now)  # opportunistic cleanup, keeps the table small
        self.sessions.add(AuthSession(user_id=user.id, token_hash=hash_token(token), expires_at=now + self.session_lifetime))
        self.db.commit()
        return SignedIn(user=user, token=token)
