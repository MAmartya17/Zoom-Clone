# Importing every model here registers it on Base.metadata before create_all().
from app.models.auth_session import AuthSession
from app.models.chat_message import ChatMessage
from app.models.enums import MeetingStatus, MeetingType, ParticipantRole, ParticipantStatus
from app.models.meeting import Meeting
from app.models.participant import Participant
from app.models.user import User

__all__ = [
    "AuthSession",
    "ChatMessage",
    "Meeting",
    "MeetingStatus",
    "MeetingType",
    "Participant",
    "ParticipantRole",
    "ParticipantStatus",
    "User",
]
