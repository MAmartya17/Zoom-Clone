"""Meeting REST endpoints. Handlers only translate HTTP <-> DTOs; rules live in services."""

from enum import StrEnum

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user, get_optional_user, get_room_manager
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models import User
from app.realtime.connection_handler import meeting_ended_event
from app.realtime.room_manager import RoomManager
from app.schemas.chat import ChatMessageOut, to_chat_message_out
from app.schemas.meeting import (
    MeetingDetail,
    MeetingInstantRequest,
    MeetingPublic,
    MeetingScheduleRequest,
    MeetingUpdateRequest,
    to_meeting_detail,
    to_meeting_public,
)
from app.schemas.participant import (
    JoinMeetingRequest,
    JoinSession,
    ParticipantOut,
    StartMeetingRequest,
)
from app.schemas.ws import WsCloseCode
from app.services.chat_service import ChatService
from app.services.meeting_service import MeetingService
from app.services.participant_service import IssuedSession, ParticipantService

router = APIRouter(prefix="/meetings", tags=["meetings"])


class MeetingScope(StrEnum):
    UPCOMING = "upcoming"
    RECENT = "recent"


def _session_response(issued: IssuedSession, settings: Settings) -> JoinSession:
    return JoinSession(
        participant=ParticipantOut.model_validate(issued.participant),
        token=issued.token,
        meeting=to_meeting_detail(issued.meeting, settings.public_app_url),
    )


@router.get("", response_model=list[MeetingDetail])
def list_meetings(
    scope: MeetingScope = Query(...),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    service = MeetingService(db)
    meetings = service.list_upcoming(user, limit) if scope == MeetingScope.UPCOMING else service.list_recent(user, limit)
    return [to_meeting_detail(m, settings.public_app_url) for m in meetings]


@router.post("/instant", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
def create_instant_meeting(
    body: MeetingInstantRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    meeting = MeetingService(db).create_instant(user, body.title if body else None)
    return to_meeting_detail(meeting, settings.public_app_url)


@router.post("", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
def schedule_meeting(
    body: MeetingScheduleRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    meeting = MeetingService(db).schedule(user, body)
    return to_meeting_detail(meeting, settings.public_app_url)


@router.get("/{meeting_code}", response_model=MeetingPublic)
def get_meeting_preview(meeting_code: str, db: Session = Depends(get_db)):
    """Validates a meeting ID before joining. Never exposes the passcode."""
    return to_meeting_public(MeetingService(db).get_joinable(meeting_code))


@router.patch("/{meeting_code}", response_model=MeetingDetail)
def update_meeting(
    meeting_code: str,
    body: MeetingUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    meeting = MeetingService(db).update(user, meeting_code, body)
    return to_meeting_detail(meeting, settings.public_app_url)


@router.delete("/{meeting_code}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_meeting(meeting_code: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    MeetingService(db).cancel(user, meeting_code)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{meeting_code}/start", response_model=JoinSession, status_code=status.HTTP_201_CREATED)
def start_meeting(
    meeting_code: str,
    body: StartMeetingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    issued = ParticipantService(db).start_as_host(user, meeting_code, body.display_name)
    return _session_response(issued, settings)


@router.post("/{meeting_code}/join", response_model=JoinSession, status_code=status.HTTP_201_CREATED)
def join_meeting(
    meeting_code: str,
    body: JoinMeetingRequest,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    issued = ParticipantService(db).join(user, meeting_code, body.display_name, body.passcode)
    return _session_response(issued, settings)


@router.post("/{meeting_code}/end", response_model=MeetingDetail)
async def end_meeting(
    meeting_code: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    rooms: RoomManager = Depends(get_room_manager),
):
    meeting = await run_in_threadpool(MeetingService(db).end, user, meeting_code)
    await rooms.close_room(meeting.meeting_code, meeting_ended_event(), WsCloseCode.MEETING_ENDED)
    return to_meeting_detail(meeting, settings.public_app_url)


@router.get("/{meeting_code}/participants", response_model=list[ParticipantOut])
def list_participants(
    meeting_code: str,
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
):
    return ParticipantService(db).list_participants(meeting_code, active_only)


@router.get("/{meeting_code}/messages", response_model=list[ChatMessageOut])
def list_messages(meeting_code: str, db: Session = Depends(get_db)):
    return [to_chat_message_out(m) for m in ChatService(db).list_for_meeting(meeting_code)]
