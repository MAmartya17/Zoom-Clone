from collections.abc import Iterable

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.models import Participant, ParticipantStatus


class ParticipantRepository:
    def __init__(self, db: Session):
        self.db = db

    def add(self, participant: Participant) -> Participant:
        self.db.add(participant)
        self.db.flush()
        return participant

    def get(self, participant_id: int) -> Participant | None:
        return self.db.get(Participant, participant_id)

    def get_by_token_hash(self, token_hash: str) -> Participant | None:
        stmt = (
            select(Participant)
            .options(selectinload(Participant.meeting))
            .where(Participant.session_token_hash == token_hash)
        )
        return self.db.scalar(stmt)

    def list_for_meeting(
        self, meeting_id: int, statuses: Iterable[ParticipantStatus] | None = None
    ) -> list[Participant]:
        stmt = select(Participant).where(Participant.meeting_id == meeting_id)
        if statuses is not None:
            stmt = stmt.where(Participant.status.in_(list(statuses)))
        return list(self.db.scalars(stmt.order_by(Participant.created_at)))

    def mark_active_sessions_left(self, left_at) -> int:
        """Close every open session (used after a restart, when no socket survives)."""
        result = self.db.execute(
            update(Participant)
            .where(Participant.status.in_([ParticipantStatus.PENDING, ParticipantStatus.CONNECTED]))
            .values(status=ParticipantStatus.LEFT, left_at=left_at)
        )
        return result.rowcount
