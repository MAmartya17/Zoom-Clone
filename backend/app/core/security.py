import base64
import hashlib
import hmac
import secrets
import string

_PASSCODE_ALPHABET = string.ascii_letters + string.digits

# scrypt parameters (RFC 7914 recommended interactive-login cost).
_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2**14, 8, 1
_SCRYPT_DKLEN = 32


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    # Only the hash is persisted, so a leaked database cannot be used to
    # impersonate a session (meeting WebSocket or signed-in browser).
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_passcode(length: int = 6) -> str:
    return "".join(secrets.choice(_PASSCODE_ALPHABET) for _ in range(length))


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii")


def hash_password(password: str) -> str:
    """Salted scrypt hash in a self-describing format: scrypt$N$r$p$salt$hash."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=_SCRYPT_DKLEN
    )
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, n, r, p, salt, expected = stored.split("$")
        if algorithm != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode("utf-8"),
            salt=base64.urlsafe_b64decode(salt),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=_SCRYPT_DKLEN,
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(_b64(digest), expected)


# Verified against when the email is unknown, so login takes the same time
# whether or not the account exists (prevents account enumeration by timing).
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))
