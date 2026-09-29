from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.errors import InvalidMeetingState, MeetingCancelled, MeetingEnded
from app.db.base import Base, TimestampMixin
from app.models.enums import MeetingStatus, MeetingType, string_enum


class Meeting(TimestampMixin, Base):
    __tablename__ = "meetings"
    __table_args__ = (
        CheckConstraint("scheduled_end_at > scheduled_start_at", name="ck_meetings_end_after_start"),
        CheckConstraint("ended_at IS NULL OR started_at IS NOT NULL", name="ck_meetings_ended_after_started"),
        Index("ix_meetings_host_status_start", "host_id", "status", "scheduled_start_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Public, human-facing 11-digit ID. The integer PK stays internal.
    meeting_code: Mapped[str] = mapped_column(String(11), nullable=False, unique=True)
    passcode: Mapped[str] = mapped_column(String(10), nullable=False)
    host_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    meeting_type: Mapped[MeetingType] = mapped_column(
        string_enum(MeetingType, "meeting_type"), nullable=False
    )
    status: Mapped[MeetingStatus] = mapped_column(
        string_enum(MeetingStatus, "meeting_status"), nullable=False, default=MeetingStatus.SCHEDULED
    )
    # Start + end (rather than start + duration) keeps "still upcoming?" a plain
    # indexed comparison that is portable across databases; duration is derived.
    scheduled_start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    scheduled_end_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")

    mute_on_entry: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    host_video_on: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    participant_video_on: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    host = relationship("User", back_populates="hosted_meetings")
    participants = relationship(
        "Participant", back_populates="meeting", cascade="all, delete-orphan", passive_deletes=True
    )
    messages = relationship(
        "ChatMessage", back_populates="meeting", cascade="all, delete-orphan", passive_deletes=True
    )

    @property
    def duration_minutes(self) -> int:
        return int((self.scheduled_end_at - self.scheduled_start_at).total_seconds() // 60)

    # --- lifecycle: scheduled -> live -> ended, or scheduled -> cancelled ---

    def ensure_joinable(self) -> None:
        if self.status == MeetingStatus.ENDED:
            raise MeetingEnded()
        if self.status == MeetingStatus.CANCELLED:
            raise MeetingCancelled()

    def ensure_editable(self) -> None:
        if self.status != MeetingStatus.SCHEDULED:
            raise InvalidMeetingState("Only meetings that have not started can be changed.")

    def mark_live(self, now: datetime) -> None:
        if self.status == MeetingStatus.SCHEDULED:
            self.status = MeetingStatus.LIVE
            self.started_at = now

    def mark_ended(self, now: datetime) -> None:
        if self.status != MeetingStatus.LIVE:
            raise InvalidMeetingState("Only a meeting in progress can be ended.")
        self.status = MeetingStatus.ENDED
        self.ended_at = now

    def mark_cancelled(self) -> None:
        self.ensure_editable()
        self.status = MeetingStatus.CANCELLED
