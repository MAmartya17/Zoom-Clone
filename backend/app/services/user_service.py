from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import User
from app.repositories.user_repository import UserRepository


class UserService:
    def __init__(self, db: Session):
        self.users = UserRepository(db)
        self.db = db

    def get_or_create_default_user(self, settings: Settings) -> User:
        """The assignment assumes a logged-in default user instead of authentication."""
        user = self.users.get_by_email(settings.default_user_email)
        if user is None:
            user = self.users.add(User(name=settings.default_user_name, email=settings.default_user_email))
            self.db.commit()
        return user
