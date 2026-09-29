import secrets
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.clock import utc_now
from app.core.errors import InvalidPasscode, InvalidSession, NotMeetingHost, ParticipantNotFound
from app.core.security import generate_session_token, hash_token
from app.models import Meeting, Participant, ParticipantRole, ParticipantStatus, User
from app.repositories.participant_repository import ParticipantRepository
from app.services.meeting_service import MeetingService

ACTIVE_STATUSES = (ParticipantStatus.PENDING, ParticipantStatus.CONNECTED)


@dataclass(frozen=True)
class IssuedSession:
    participant: Participant
    meeting: Meeting
    # Raw token is returned to the client once and never stored.
    token: str


class ParticipantService:
    """Admission into meetings, session authentication and host moderation."""

    def __init__(self, db: Session):
        self.db = db
        self.participants = ParticipantRepository(db)
        self.meeting_service = MeetingService(db)

    # --- admission ---

    def start_as_host(self, user: User, raw_code: str, display_name: str) -> IssuedSession:
        meeting = self.meeting_service.get_joinable(raw_code)
        if meeting.host_id != user.id:
            raise NotMeetingHost("Only the host can start this meeting.")
        return self._issue_session(meeting, user, display_name, ParticipantRole.HOST)

    def join(self, user: User | None, raw_code: str, display_name: str, passcode: str) -> IssuedSession:
        meeting = self.meeting_service.get_joinable(raw_code)
        # Constant-time comparison avoids leaking the passcode through timing.
        if not secrets.compare_digest(passcode.encode(), meeting.passcode.encode()):
            raise InvalidPasscode()
        return self._issue_session(meeting, user, display_name, ParticipantRole.ATTENDEE)

    def _issue_session(
        self, meeting: Meeting, user: User | None, display_name: str, role: ParticipantRole
    ) -> IssuedSession:
        token = generate_session_token()
        participant = self.participants.add(
            Participant(
                meeting_id=meeting.id,
                user_id=user.id if user else None,
                display_name=display_name,
                role=role,
                status=ParticipantStatus.PENDING,
                session_token_hash=hash_token(token),
            )
        )
        self.db.commit()
        return IssuedSession(participant=participant, meeting=meeting, token=token)

    # --- realtime session lifecycle ---

    def connect(self, meeting_code: str, token: str) -> Participant:
        """Validate a one-time session token and mark the participant as in the room."""
        participant = self.participants.get_by_token_hash(hash_token(token))
        if (
            participant is None
            or participant.meeting.meeting_code != meeting_code
            or participant.status != ParticipantStatus.PENDING
        ):
            raise InvalidSession()
        participant.meeting.ensure_joinable()

        now = utc_now()
        participant.status = ParticipantStatus.CONNECTED
        participant.joined_at = now
        participant.meeting.mark_live(now)
        self.db.commit()
        return participant

    def disconnect(self, participant_id: int) -> None:
        participant = self.participants.get(participant_id)
        # A removed participant keeps the REMOVED status when their socket closes.
        if participant and participant.status in ACTIVE_STATUSES:
            participant.status = ParticipantStatus.LEFT
            participant.left_at = utc_now()
            self.db.commit()

    # --- host moderation ---

    def require_host(self, participant_id: int) -> Participant:
        participant = self.participants.get(participant_id)
        if participant is None or not participant.is_host:
            raise NotMeetingHost()
        return participant

    def remove(self, host_participant_id: int, target_id: int) -> Participant:
        host = self.require_host(host_participant_id)
        target = self.participants.get(target_id)
        if target is None or target.meeting_id != host.meeting_id or target.status not in ACTIVE_STATUSES:
            raise ParticipantNotFound()
        if target.id == host.id:
            raise NotMeetingHost("The host cannot remove themselves.")
        target.status = ParticipantStatus.REMOVED
        target.left_at = utc_now()
        self.db.commit()
        return target

    def end_meeting(self, host_participant_id: int) -> Meeting:
        host = self.require_host(host_participant_id)
        meeting = host.meeting
        meeting.mark_ended(utc_now())
        self.db.commit()
        return meeting

    # --- queries ---

    def list_participants(self, raw_code: str, active_only: bool) -> list[Participant]:
        meeting = self.meeting_service.get_by_code(raw_code)
        statuses = (ParticipantStatus.CONNECTED,) if active_only else None
        return self.participants.list_for_meeting(meeting.id, statuses)
