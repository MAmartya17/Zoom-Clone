from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.clock import utc_now
from app.db.base import Base
from app.models.enums import ParticipantRole, ParticipantStatus, string_enum


class Participant(Base):
    """One row per join *session* (not per person).

    Guests have no account, and the same person can join more than once, so a
    session row is what lets us keep an accurate attendance history.
    """

    __tablename__ = "participants"
    __table_args__ = (
        Index("ix_participants_meeting_status", "meeting_id", "status"),
        Index("ix_participants_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    display_name: Mapped[str] = mapped_column(String(64), nullable=False)
    role: Mapped[ParticipantRole] = mapped_column(
        string_enum(ParticipantRole, "participant_role"), nullable=False
    )
    status: Mapped[ParticipantStatus] = mapped_column(
        string_enum(ParticipantStatus, "participant_status"),
        nullable=False,
        default=ParticipantStatus.PENDING,
    )
    session_token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    joined_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    left_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    meeting = relationship("Meeting", back_populates="participants")
    user = relationship("User")

    @property
    def is_host(self) -> bool:
        return self.role == ParticipantRole.HOST
