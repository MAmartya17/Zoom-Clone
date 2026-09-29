from sqlalchemy.orm import Session

from app.core.errors import InvalidSession
from app.models import ChatMessage, ParticipantStatus
from app.repositories.chat_repository import ChatRepository
from app.repositories.participant_repository import ParticipantRepository
from app.services.meeting_service import MeetingService


class ChatService:
    def __init__(self, db: Session):
        self.db = db
        self.messages = ChatRepository(db)
        self.participants = ParticipantRepository(db)

    def post(self, participant_id: int, body: str) -> ChatMessage:
        sender = self.participants.get(participant_id)
        if sender is None or sender.status != ParticipantStatus.CONNECTED:
            raise InvalidSession()
        message = self.messages.add(
            ChatMessage(meeting_id=sender.meeting_id, participant_id=sender.id, body=body)
        )
        self.db.commit()
        return message

    def list_for_meeting(self, raw_code: str) -> list[ChatMessage]:
        meeting = MeetingService(self.db).get_by_code(raw_code)
        return self.messages.list_for_meeting(meeting.id)
