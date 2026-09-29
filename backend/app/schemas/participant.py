from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.models import ParticipantRole, ParticipantStatus
from app.schemas.common import ApiModel, DisplayName, UtcDatetime
from app.schemas.meeting import MeetingDetail


class StartMeetingRequest(BaseModel):
    display_name: DisplayName


class JoinMeetingRequest(BaseModel):
    display_name: DisplayName
    passcode: Annotated[str, StringConstraints(strip_whitespace=True, max_length=10)]


class ParticipantOut(ApiModel):
    id: int
    display_name: str
    role: ParticipantRole
    status: ParticipantStatus
    joined_at: UtcDatetime | None
    left_at: UtcDatetime | None


class JoinSession(BaseModel):
    """Returned when entering a meeting; `token` authenticates the WebSocket."""

    participant: ParticipantOut
    token: str
    meeting: MeetingDetail
