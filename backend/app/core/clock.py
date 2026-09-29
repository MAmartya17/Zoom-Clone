from datetime import datetime, timezone


def utc_now() -> datetime:
    """Naive UTC datetime.

    SQLite has no timezone-aware datetime type, so every datetime is stored as
    naive UTC and converted to an aware value only at the API boundary.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def as_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc)
