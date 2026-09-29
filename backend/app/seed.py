"""Demo data: upcoming, recent (with attendance + chat) and cancelled meetings.

Usage:
    python -m app.seed           # seed only if the database is empty
    python -m app.seed --reset   # drop all tables, recreate and seed
"""

import argparse
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import utc_now
from app.core.config import Settings, get_settings
from app.core.security import generate_passcode, generate_session_token, hash_password, hash_token
from app.models import (
    ChatMessage,
    Meeting,
    MeetingStatus,
    MeetingType,
    Participant,
    ParticipantRole,
    ParticipantStatus,
    User,
)
from app.services.meeting_code import generate_meeting_code
from app.services.user_service import UserService

logger = logging.getLogger(__name__)


@dataclass
class SeedMeeting:
    title: str
    start_offset: timedelta
    duration_minutes: int
    status: MeetingStatus
    meeting_type: MeetingType = MeetingType.SCHEDULED
    description: str | None = None
    guests: list[str] = field(default_factory=list)
    chat: list[tuple[str, str]] = field(default_factory=list)  # (sender, body)


UPCOMING = [
    SeedMeeting("Weekly Product Sync", timedelta(hours=2), 60, MeetingStatus.SCHEDULED,
                description="Roadmap updates, blockers and release checklist."),
    SeedMeeting("Design Review: Mobile Onboarding", timedelta(days=1, hours=1), 45, MeetingStatus.SCHEDULED,
                description="Walkthrough of the new onboarding flow in Figma."),
    SeedMeeting("1:1 with Priya", timedelta(days=2), 30, MeetingStatus.SCHEDULED),
    SeedMeeting("Sprint Planning", timedelta(days=3, hours=2), 90, MeetingStatus.SCHEDULED,
                description="Estimate and commit to stories for Sprint 24."),
    SeedMeeting("Quarterly Business Review", timedelta(days=7), 120, MeetingStatus.SCHEDULED,
                description="Q3 results and Q4 targets with leadership."),
]

RECENT = [
    SeedMeeting("Engineering Standup", -timedelta(days=1), 15, MeetingStatus.ENDED,
                guests=["Priya Sharma", "Daniel Kim", "Sofia Martinez"],
                chat=[("Priya Sharma", "Morning all! PR #482 is ready for review."),
                      ("Daniel Kim", "I'll take it after standup."),
                      ("Alex Morgan", "Thanks both, let's ship it today.")]),
    SeedMeeting("Customer Demo - Acme Corp", -timedelta(days=2, hours=3), 60, MeetingStatus.ENDED,
                description="Live demo of the analytics dashboard.",
                guests=["Jordan Lee", "Rahul Verma"],
                chat=[("Jordan Lee", "Could you share the slides afterwards?"),
                      ("Alex Morgan", "Absolutely, I'll email them tonight.")]),
    SeedMeeting("Alex Morgan's Zoom Meeting", -timedelta(days=3, hours=5), 60, MeetingStatus.ENDED,
                meeting_type=MeetingType.INSTANT, guests=["Sofia Martinez"]),
    SeedMeeting("Interview: Frontend Engineer", -timedelta(days=5, hours=1), 45, MeetingStatus.ENDED,
                guests=["Chris Park"]),
    SeedMeeting("All Hands", -timedelta(days=8), 60, MeetingStatus.ENDED,
                guests=["Priya Sharma", "Daniel Kim", "Rahul Verma", "Jordan Lee", "Sofia Martinez"]),
]

CANCELLED = [
    SeedMeeting("Offsite Planning", timedelta(days=4), 60, MeetingStatus.CANCELLED,
                description="Postponed until next quarter."),
]


def _round_to_half_hour(value: datetime) -> datetime:
    return value.replace(minute=0 if value.minute < 30 else 30, second=0, microsecond=0)


def _build_meeting(host: User, spec: SeedMeeting, now: datetime) -> Meeting:
    start = _round_to_half_hour(now + spec.start_offset)
    end = start + timedelta(minutes=spec.duration_minutes)
    meeting = Meeting(
        meeting_code=generate_meeting_code(),
        passcode=generate_passcode(),
        host_id=host.id,
        title=spec.title,
        description=spec.description,
        meeting_type=spec.meeting_type,
        status=spec.status,
        scheduled_start_at=start,
        scheduled_end_at=end,
        timezone="UTC",
    )
    if spec.status == MeetingStatus.ENDED:
        meeting.started_at = start + timedelta(minutes=1)
        meeting.ended_at = end - timedelta(minutes=2)
    return meeting


def _add_attendance(db: Session, host: User, meeting: Meeting, spec: SeedMeeting) -> None:
    by_name: dict[str, Participant] = {}
    people = [(host.name, ParticipantRole.HOST, host.id)] + [
        (name, ParticipantRole.ATTENDEE, None) for name in spec.guests
    ]
    for offset, (name, role, user_id) in enumerate(people):
        participant = Participant(
            meeting_id=meeting.id,
            user_id=user_id,
            display_name=name,
            role=role,
            status=ParticipantStatus.LEFT,
            session_token_hash=hash_token(generate_session_token()),
            joined_at=meeting.started_at + timedelta(minutes=offset),
            left_at=meeting.ended_at,
        )
        db.add(participant)
        by_name[name] = participant
    db.flush()

    for index, (sender, body) in enumerate(spec.chat):
        db.add(
            ChatMessage(
                meeting_id=meeting.id,
                participant_id=by_name[sender].id,
                body=body,
                created_at=meeting.started_at + timedelta(minutes=2 + index),
            )
        )


SECOND_DEMO_USER = ("Priya Sharma", "priya.sharma@example.com")


def _seed_second_user(db: Session, settings: Settings) -> None:
    """A second account to demo that only the host can start their meeting."""
    name, email = SECOND_DEMO_USER
    if db.scalar(select(User.id).where(User.email == email)) is None:
        db.add(User(name=name, email=email, password_hash=hash_password(settings.default_user_password)))


def seed(db: Session, settings: Settings) -> None:
    host = UserService(db).get_or_create_default_user(settings)
    _seed_second_user(db, settings)
    now = utc_now()
    for spec in [*UPCOMING, *RECENT, *CANCELLED]:
        meeting = _build_meeting(host, spec, now)
        db.add(meeting)
        db.flush()
        if spec.status == MeetingStatus.ENDED:
            _add_attendance(db, host, meeting, spec)
    db.commit()
    logger.info("Seeded %d meetings", len(UPCOMING) + len(RECENT) + len(CANCELLED))


def seed_if_empty(db: Session, settings: Settings) -> bool:
    if db.scalar(select(Meeting.id).limit(1)) is not None:
        return False
    seed(db, settings)
    return True


def main() -> None:
    from app.db.base import Base
    from app.db.session import SessionLocal, engine

    parser = argparse.ArgumentParser(description="Seed the Zoom clone database.")
    parser.add_argument("--reset", action="store_true", help="Drop and recreate all tables first.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    if args.reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        seeded = seed(db, get_settings()) if args.reset else seed_if_empty(db, get_settings())
        if seeded is False:
            logger.info("Database already has data; use --reset to reseed.")


if __name__ == "__main__":
    main()
