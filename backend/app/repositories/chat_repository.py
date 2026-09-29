from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import ChatMessage


class ChatRepository:
    def __init__(self, db: Session):
        self.db = db

    def add(self, message: ChatMessage) -> ChatMessage:
        self.db.add(message)
        self.db.flush()
        return message

    def list_for_meeting(self, meeting_id: int, limit: int = 200) -> list[ChatMessage]:
        stmt = (
            select(ChatMessage)
            .options(selectinload(ChatMessage.participant))
            .where(ChatMessage.meeting_id == meeting_id)
            .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt))
