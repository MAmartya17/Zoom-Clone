from enum import StrEnum

from sqlalchemy import Enum as SAEnum


class MeetingType(StrEnum):
    INSTANT = "instant"
    SCHEDULED = "scheduled"


class MeetingStatus(StrEnum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"
    CANCELLED = "cancelled"


class ParticipantRole(StrEnum):
    HOST = "host"
    ATTENDEE = "attendee"


class ParticipantStatus(StrEnum):
    PENDING = "pending"  # REST join succeeded, WebSocket not yet connected
    CONNECTED = "connected"
    LEFT = "left"
    REMOVED = "removed"


def string_enum(enum_cls: type[StrEnum], name: str) -> SAEnum:
    """Store enums as VARCHAR + CHECK constraint (portable across SQLite/PostgreSQL)."""
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=16,
        values_callable=lambda cls: [member.value for member in cls],
    )
