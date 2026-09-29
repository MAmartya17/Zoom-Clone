"""WebSocket message protocol (client -> server).

Every message carries a `type` discriminator; pydantic parses the raw JSON
into exactly one of these models or rejects it.
"""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints, TypeAdapter


class SignalMessage(BaseModel):
    type: Literal["signal"]
    to: int
    # Opaque WebRTC payload ({"sdp": ...} or {"candidate": ...}); the server only relays it.
    data: dict[str, Any]


class MediaStateMessage(BaseModel):
    type: Literal["media_state"]
    audio: bool
    video: bool
    screen: bool = False


class ChatSendMessage(BaseModel):
    type: Literal["chat_message"]
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class MuteAllMessage(BaseModel):
    type: Literal["mute_all"]


class MuteParticipantMessage(BaseModel):
    type: Literal["mute_participant"]
    participant_id: int


class RemoveParticipantMessage(BaseModel):
    type: Literal["remove_participant"]
    participant_id: int


class EndMeetingMessage(BaseModel):
    type: Literal["end_meeting"]


ClientMessage = Annotated[
    SignalMessage
    | MediaStateMessage
    | ChatSendMessage
    | MuteAllMessage
    | MuteParticipantMessage
    | RemoveParticipantMessage
    | EndMeetingMessage,
    Field(discriminator="type"),
]

client_message_adapter: TypeAdapter[ClientMessage] = TypeAdapter(ClientMessage)


class WsCloseCode:
    """Application close codes (4000-4999 range is reserved for apps)."""

    INVALID_SESSION = 4401
    REMOVED = 4403
    MEETING_NOT_FOUND = 4404
    MEETING_ENDED = 4410
