from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Meeting, MeetingStatus, MeetingType, Participant

# Eager-load what MeetingDetail needs so list endpoints avoid N+1 queries.
_DETAIL_LOAD_OPTIONS = (selectinload(Meeting.host), selectinload(Meeting.participants))


class MeetingRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_code(self, meeting_code: str) -> Meeting | None:
        stmt = select(Meeting).options(*_DETAIL_LOAD_OPTIONS).where(Meeting.meeting_code == meeting_code)
        return self.db.scalar(stmt)

    def add(self, meeting: Meeting) -> Meeting:
        self.db.add(meeting)
        self.db.flush()
        return meeting

    def list_upcoming(self, host_id: int, now: datetime, limit: int) -> list[Meeting]:
        """Scheduled meetings of this host that have not reached their scheduled end."""
        stmt = (
            select(Meeting)
            .options(*_DETAIL_LOAD_OPTIONS)
            .where(
                Meeting.host_id == host_id,
                Meeting.meeting_type == MeetingType.SCHEDULED,
                Meeting.status == MeetingStatus.SCHEDULED,
                Meeting.scheduled_end_at > now,
            )
            .order_by(Meeting.scheduled_start_at.asc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt))

    def list_recent(self, user_id: int, limit: int) -> list[Meeting]:
        """Meetings the user hosted or attended that have actually started."""
        attended = select(Participant.meeting_id).where(Participant.user_id == user_id)
        stmt = (
            select(Meeting)
            .options(*_DETAIL_LOAD_OPTIONS)
            .where(
                or_(Meeting.host_id == user_id, Meeting.id.in_(attended)),
                Meeting.status.in_([MeetingStatus.LIVE, MeetingStatus.ENDED]),
            )
            .order_by(func.coalesce(Meeting.ended_at, Meeting.started_at).desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt))

    def list_by_status(self, status: MeetingStatus) -> list[Meeting]:
        return list(self.db.scalars(select(Meeting).where(Meeting.status == status)))
