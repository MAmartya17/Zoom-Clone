from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Zoom Clone API"
    database_url: str = "sqlite:///./zoom_clone.db"
    # Comma-separated list of allowed browser origins.
    cors_origins: str = "http://localhost:3000"
    # Base URL of the frontend; used to build shareable invite links.
    public_app_url: str = "http://localhost:3000"
    # Seed demo data on startup when the database is empty (useful on ephemeral hosts).
    seed_on_startup: bool = True

    # Seeded demo account (documented in the README so evaluators can sign in).
    default_user_email: str = "alex.morgan@example.com"
    default_user_name: str = "Alex Morgan"
    default_user_password: str = "demo1234"

    auth_session_days: int = 30

    # An empty live room is ended after this many seconds, so a page refresh
    # does not end the meeting but abandoned rooms do not stay "live" forever.
    empty_room_grace_seconds: int = 60

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
