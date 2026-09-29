from collections.abc import Callable

from fastapi import APIRouter, Depends, Query, WebSocket
from sqlalchemy.orm import Session

from app.api.deps import get_room_manager, get_session_factory
from app.core.config import Settings, get_settings
from app.realtime.connection_handler import MeetingConnectionHandler
from app.realtime.room_manager import RoomManager
from app.services.meeting_code import normalize_meeting_code

router = APIRouter(tags=["realtime"])


@router.websocket("/ws/meetings/{meeting_code}")
async def meeting_socket(
    websocket: WebSocket,
    meeting_code: str,
    token: str = Query(...),
    rooms: RoomManager = Depends(get_room_manager),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
    settings: Settings = Depends(get_settings),
):
    handler = MeetingConnectionHandler(
        websocket=websocket,
        meeting_code=normalize_meeting_code(meeting_code) or meeting_code,
        token=token,
        rooms=rooms,
        session_factory=session_factory,
        empty_room_grace_seconds=settings.empty_room_grace_seconds,
    )
    await handler.run()
