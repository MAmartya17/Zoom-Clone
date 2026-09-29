import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, StringConstraints

from app.schemas.common import RequiredText
from app.schemas.user import UserOut

# Deliberately simple: full RFC 5322 validation adds a dependency for little gain.
_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PASSWORD_MIN_LENGTH = 8


def _normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not _EMAIL_PATTERN.match(email):
        raise ValueError("Please enter a valid email address.")
    return email


def _validate_password(value: str) -> str:
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters.")
    if not (re.search(r"[A-Za-z]", value) and re.search(r"\d", value)):
        raise ValueError("Password must contain at least one letter and one number.")
    return value


Email = Annotated[str, StringConstraints(max_length=255), AfterValidator(_normalize_email)]
NewPassword = Annotated[str, StringConstraints(max_length=128), AfterValidator(_validate_password)]
FullName = Annotated[RequiredText, StringConstraints(max_length=100)]


class SignupRequest(BaseModel):
    name: FullName
    email: Email
    password: NewPassword


class LoginRequest(BaseModel):
    email: Email
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class AuthResponse(BaseModel):
    user: UserOut
    # Bearer token for the Authorization header; shown to the client once.
    token: str
