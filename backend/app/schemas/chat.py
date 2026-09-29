from app.models import ChatMessage
from app.schemas.common import ApiModel, UtcDatetime


class ChatMessageOut(ApiModel):
    id: int
    participant_id: int
    sender_name: str
    body: str
    created_at: UtcDatetime


def to_chat_message_out(message: ChatMessage) -> ChatMessageOut:
    return ChatMessageOut(
        id=message.id,
        participant_id=message.participant_id,
        sender_name=message.participant.display_name,
        body=message.body,
        created_at=message.created_at,
    )
