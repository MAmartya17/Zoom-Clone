from collections.abc import Callable
from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.clock import to_naive_utc, utc_now
from app.core.errors import MeetingCodeGenerationFailed, MeetingNotFound, NotMeetingHost
from app.core.security import generate_passcode
from app.models import Meeting, MeetingStatus, MeetingType, User
from app.repositories.meeting_repository import MeetingRepository
from app.repositories.participant_repository import ParticipantRepository
from app.schemas.meeting import MeetingScheduleRequest, MeetingUpdateRequest
from app.services.meeting_code import generate_meeting_code, normalize_meeting_code

INSTANT_MEETING_DURATION = timedelta(minutes=60)
MAX_CODE_ATTEMPTS = 5


class MeetingService:
    """Business rules for creating, listing and changing the lifecycle of meetings."""

    def __init__(self, db: Session, code_generator: Callable[[], str] = generate_meeting_code):
        self.db = db
        self.meetings = MeetingRepository(db)
        self.participants = ParticipantRepository(db)
        self._generate_code = code_generator

    # --- queries ---

    def get_by_code(self, raw_code: str) -> Meeting:
        code = normalize_meeting_code(raw_code)
        meeting = self.meetings.get_by_code(code) if code else None
        if meeting is None:
            raise MeetingNotFound()
        return meeting

    def get_joinable(self, raw_code: str) -> Meeting:
        meeting = self.get_by_code(raw_code)
        meeting.ensure_joinable()
        return meeting

    def list_upcoming(self, user: User, limit: int) -> list[Meeting]:
        return self.meetings.list_upcoming(user.id, utc_now(), limit)

    def list_recent(self, user: User, limit: int) -> list[Meeting]:
        return self.meetings.list_recent(user.id, limit)

    # --- commands ---

    def create_instant(self, host: User, title: str | None = None) -> Meeting:
        now = utc_now()
        meeting = Meeting(
            host_id=host.id,
            title=title or f"{host.name}'s Zoom Meeting",
            meeting_type=MeetingType.INSTANT,
            status=MeetingStatus.SCHEDULED,
            scheduled_start_at=now,
            scheduled_end_at=now + INSTANT_MEETING_DURATION,
            timezone="UTC",
            passcode=generate_passcode(),
        )
        return self._insert_with_unique_code(meeting)

    def schedule(self, host: User, request: MeetingScheduleRequest) -> Meeting:
        start = to_naive_utc(request.start_time)
        meeting = Meeting(
            host_id=host.id,
            title=request.title,
            description=request.description,
            meeting_type=MeetingType.SCHEDULED,
            status=MeetingStatus.SCHEDULED,
            scheduled_start_at=start,
            scheduled_end_at=start + timedelta(minutes=request.duration_minutes),
            timezone=request.timezone,
            passcode=request.passcode or generate_passcode(),
            mute_on_entry=request.mute_on_entry,
            host_video_on=request.host_video_on,
            participant_video_on=request.participant_video_on,
        )
        return self._insert_with_unique_code(meeting)

    def update(self, host: User, raw_code: str, request: MeetingUpdateRequest) -> Meeting:
        meeting = self._get_owned(host, raw_code)
        meeting.ensure_editable()

        changes = request.model_dump(exclude_unset=True)
        duration = timedelta(minutes=changes.pop("duration_minutes", meeting.duration_minutes))
        if "start_time" in changes:
            meeting.scheduled_start_at = to_naive_utc(changes.pop("start_time"))
        meeting.scheduled_end_at = meeting.scheduled_start_at + duration

        for field, value in changes.items():
            if field in {"title", "passcode"} and value is None:
                continue  # required columns: explicit null means "leave unchanged"
            setattr(meeting, field, value)

        self.db.commit()
        return meeting

    def cancel(self, host: User, raw_code: str) -> None:
        meeting = self._get_owned(host, raw_code)
        meeting.mark_cancelled()
        self.db.commit()

    def end(self, host: User, raw_code: str) -> Meeting:
        meeting = self._get_owned(host, raw_code)
        meeting.mark_ended(utc_now())
        self.db.commit()
        return meeting

    def end_if_live(self, meeting_code: str) -> bool:
        """Used by the empty-room timer; a no-op if the meeting already ended."""
        meeting = self.meetings.get_by_code(meeting_code)
        if meeting is None or meeting.status != MeetingStatus.LIVE:
            return False
        meeting.mark_ended(utc_now())
        self.db.commit()
        return True

    def reconcile_after_restart(self) -> None:
        """Live room state is in memory, so after a restart no session survives."""
        now = utc_now()
        self.participants.mark_active_sessions_left(now)
        for meeting in self.meetings.list_by_status(MeetingStatus.LIVE):
            meeting.mark_ended(now)
        self.db.commit()

    # --- helpers ---

    def _get_owned(self, host: User, raw_code: str) -> Meeting:
        meeting = self.get_by_code(raw_code)
        if meeting.host_id != host.id:
            raise NotMeetingHost()
        return meeting

    def _insert_with_unique_code(self, meeting: Meeting) -> Meeting:
        # The UNIQUE constraint is the source of truth: a pre-check alone would
        # race with a concurrent insert, so we insert and retry on conflict.
        for _ in range(MAX_CODE_ATTEMPTS):
            meeting.meeting_code = self._generate_code()
            self.db.add(meeting)
            try:
                self.db.commit()
            except IntegrityError as exc:
                self.db.rollback()
                if "meeting_code" not in str(exc.orig):
                    raise
                continue
            return self.meetings.get_by_code(meeting.meeting_code)
        raise MeetingCodeGenerationFailed()
