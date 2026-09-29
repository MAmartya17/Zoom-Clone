import hashlib
import secrets
import string

_PASSCODE_ALPHABET = string.ascii_letters + string.digits


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    # Only the hash is persisted, so a leaked database cannot be used to
    # impersonate a participant's WebSocket session.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_passcode(length: int = 6) -> str:
    return "".join(secrets.choice(_PASSCODE_ALPHABET) for _ in range(length))
