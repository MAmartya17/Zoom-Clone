from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.models import AuthSession


class AuthSessionRepository:
    def __init__(self, db: Session):
        self.db = db

    def add(self, session: AuthSession) -> AuthSession:
        self.db.add(session)
        self.db.flush()
        return session

    def get_active(self, token_hash: str, now: datetime) -> AuthSession | None:
        stmt = (
            select(AuthSession)
            .options(selectinload(AuthSession.user))
            .where(AuthSession.token_hash == token_hash, AuthSession.expires_at > now)
        )
        return self.db.scalar(stmt)

    def delete_by_hash(self, token_hash: str) -> None:
        self.db.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash))

    def delete_expired(self, now: datetime) -> None:
        self.db.execute(delete(AuthSession).where(AuthSession.expires_at <= now))
