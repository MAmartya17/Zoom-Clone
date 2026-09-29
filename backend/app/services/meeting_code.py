"""Zoom-style numeric meeting IDs: generation, normalization and display formatting."""

import re
import secrets

MEETING_CODE_LENGTH = 11
_NON_DIGITS = re.compile(r"[\s\-]")
_VALID_CODE = re.compile(rf"^\d{{{MEETING_CODE_LENGTH}}}$")


def generate_meeting_code() -> str:
    # First digit is never 0 so the ID always has exactly 11 significant digits.
    first = str(secrets.randbelow(9) + 1)
    rest = "".join(str(secrets.randbelow(10)) for _ in range(MEETING_CODE_LENGTH - 1))
    return first + rest


def normalize_meeting_code(raw: str) -> str | None:
    """'123 4567 8901' / '123-4567-8901' -> '12345678901'; None if not a valid ID."""
    candidate = _NON_DIGITS.sub("", raw or "")
    return candidate if _VALID_CODE.match(candidate) else None


def format_meeting_code(code: str) -> str:
    return f"{code[:3]} {code[3:7]} {code[7:]}"
