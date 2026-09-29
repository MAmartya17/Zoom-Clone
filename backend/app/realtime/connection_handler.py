"""Handles one participant's WebSocket for the lifetime of their stay in a meeting.

Business rules (who may do what) stay in the services; this class only
authenticates the socket, translates protocol messages into service calls and
fans results out through the RoomManager.
"""

import json
import logging
from collections.abc import Callable
from typing import Any, TypeVar

import anyio
from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.errors import (
    DomainError,
    MeetingCancelled,
    MeetingEnded,
    MeetingNotFound,
    ParticipantNotFound,
)
from app.realtime.room_manager import MediaState, RoomManager, RoomMember
from app.schemas.chat import to_chat_message_out
from app.schemas.ws import (
    ChatSendMessage,
    EndMeetingMessage,
    MediaStateMessage,
    MuteAllMessage,
    MuteParticipantMessage,
    RemoveParticipantMessage,
    SignalMessage,
    WsCloseCode,
    client_message_adapter,
)
from app.services.chat_service import ChatService
from app.services.meeting_service import MeetingService
from app.services.participant_service import ParticipantService

logger = logging.getLogger(__name__)
T = TypeVar("T")

_CLOSE_CODE_BY_ERROR: dict[type[DomainError], int] = {
    MeetingNotFound: WsCloseCode.MEETING_NOT_FOUND,
    MeetingEnded: WsCloseCode.MEETING_ENDED,
    MeetingCancelled: WsCloseCode.MEETING_ENDED,
}

def meeting_ended_event() -> dict:
    return {"type": "meeting_ended", "reason": "The host has ended this meeting."}


class MeetingConnectionHandler:
    def __init__(
        self,
        websocket: WebSocket,
        meeting_code: str,
        token: str,
        rooms: RoomManager,
        session_factory: Callable[[], Session],
        empty_room_grace_seconds: float,
    ):
        self.ws = websocket
        self.code = meeting_code
        self.token = token
        self.rooms = rooms
        self.session_factory = session_factory
        self.empty_room_grace_seconds = empty_room_grace_seconds
        self.member: RoomMember | None = None

    async def run(self) -> None:
        await self.ws.accept()
        if not await self._authenticate():
            return
        try:
            await self._announce_arrival()
            await self._receive_loop()
        except WebSocketDisconnect:
            pass
        finally:
            # Shielded so presence is cleaned up (DB + other participants
            # notified) even if the task is being cancelled, e.g. on shutdown.
            with anyio.CancelScope(shield=True):
                await self._handle_departure()

    # --- connection lifecycle ---

    async def _authenticate(self) -> bool:
        def connect(db: Session) -> dict:
            participant = ParticipantService(db).connect(self.code, self.token)
            return {
                "id": participant.id,
                "display_name": participant.display_name,
                "role": participant.role.value,
            }

        try:
            info = await self._db(connect)
        except DomainError as exc:
            close_code = _CLOSE_CODE_BY_ERROR.get(type(exc), WsCloseCode.INVALID_SESSION)
            await self.ws.send_json({"type": "error", "code": exc.code, "message": exc.message})
            await self.ws.close(code=close_code)
            return False

        self.member = RoomMember(
            participant_id=info["id"],
            display_name=info["display_name"],
            role=info["role"],
            websocket=self.ws,
            media=MediaState(),
        )
        return True

    async def _announce_arrival(self) -> None:
        assert self.member
        others = self.rooms.members(self.code)
        self.rooms.add_member(self.code, self.member)
        await self.ws.send_json(
            {
                "type": "room_state",
                "self_id": self.member.participant_id,
                "participants": [m.to_public() for m in [*others, self.member]],
            }
        )
        await self.rooms.broadcast(
            self.code,
            {"type": "participant_joined", "participant": self.member.to_public()},
            exclude=self.member.participant_id,
        )

    async def _handle_departure(self) -> None:
        if self.member is None:
            return
        participant_id = self.member.participant_id
        still_listed = self.rooms.remove_member(self.code, participant_id) is not None
        await self._db(lambda db: ParticipantService(db).disconnect(participant_id))

        # If the member was already dropped (removed / meeting ended), whoever
        # dropped them has already notified the room.
        if still_listed:
            await self.rooms.broadcast(self.code, {"type": "participant_left", "participant_id": participant_id})
            self.rooms.schedule_if_empty(self.code, self.empty_room_grace_seconds, self._end_abandoned_meeting)

    async def _end_abandoned_meeting(self) -> None:
        await self._db(lambda db: MeetingService(db).end_if_live(self.code))

    # --- message loop ---

    async def _receive_loop(self) -> None:
        while self.ws.application_state == WebSocketState.CONNECTED:
            try:
                raw = await self.ws.receive_text()
            except RuntimeError:
                # Raised when the socket was closed by the server (removed / meeting ended).
                return
            try:
                message = client_message_adapter.validate_python(json.loads(raw))
            except (json.JSONDecodeError, ValidationError):
                await self._send_error("INVALID_MESSAGE", "Message format is not recognised.")
                continue
            try:
                await self._dispatch(message)
            except DomainError as exc:
                await self._send_error(exc.code, exc.message)

    async def _dispatch(self, message: Any) -> None:
        match message:
            case SignalMessage():
                await self._relay_signal(message)
            case MediaStateMessage():
                await self._update_media_state(message)
            case ChatSendMessage():
                await self._post_chat(message)
            case MuteAllMessage():
                await self._mute_all()
            case MuteParticipantMessage():
                await self._mute_participant(message.participant_id)
            case RemoveParticipantMessage():
                await self._remove_participant(message.participant_id)
            case EndMeetingMessage():
                await self._end_meeting()

    # --- handlers ---

    async def _relay_signal(self, message: SignalMessage) -> None:
        delivered = await self.rooms.send(
            self.code,
            message.to,
            {"type": "signal", "from": self.member.participant_id, "data": message.data},
        )
        if not delivered:
            raise ParticipantNotFound()

    async def _update_media_state(self, message: MediaStateMessage) -> None:
        self.member.media = MediaState(audio=message.audio, video=message.video, screen=message.screen)
        await self.rooms.broadcast(
            self.code, {"type": "participant_updated", "participant": self.member.to_public()}
        )

    async def _post_chat(self, message: ChatSendMessage) -> None:
        participant_id = self.member.participant_id

        def post(db: Session) -> dict:
            saved = ChatService(db).post(participant_id, message.body)
            return to_chat_message_out(saved).model_dump(mode="json")

        payload = await self._db(post)
        await self.rooms.broadcast(self.code, {"type": "chat_message", "message": payload})

    async def _mute_all(self) -> None:
        await self._require_host()
        await self.rooms.broadcast(
            self.code,
            {"type": "force_mute", "by": self.member.display_name},
            exclude=self.member.participant_id,
        )

    async def _mute_participant(self, target_id: int) -> None:
        await self._require_host()
        if not await self.rooms.send(self.code, target_id, {"type": "force_mute", "by": self.member.display_name}):
            raise ParticipantNotFound()

    async def _remove_participant(self, target_id: int) -> None:
        host_id = self.member.participant_id
        await self._db(lambda db: ParticipantService(db).remove(host_id, target_id))
        await self.rooms.disconnect_member(
            self.code,
            target_id,
            {"type": "removed", "reason": "You have been removed from this meeting by the host."},
            WsCloseCode.REMOVED,
        )
        await self.rooms.broadcast(self.code, {"type": "participant_left", "participant_id": target_id})

    async def _end_meeting(self) -> None:
        host_id = self.member.participant_id
        await self._db(lambda db: ParticipantService(db).end_meeting(host_id))
        await self.rooms.close_room(self.code, meeting_ended_event(), WsCloseCode.MEETING_ENDED)

    # --- helpers ---

    async def _require_host(self) -> None:
        participant_id = self.member.participant_id
        await self._db(lambda db: ParticipantService(db).require_host(participant_id))

    async def _send_error(self, code: str, message: str) -> None:
        try:
            await self.ws.send_json({"type": "error", "code": code, "message": message})
        except Exception:  # noqa: BLE001
            raise WebSocketDisconnect() from None

    async def _db(self, work: Callable[[Session], T]) -> T:
        """Run blocking ORM work off the event loop with its own short-lived session."""

        def run() -> T:
            with self.session_factory() as db:
                return work(db)

        return await run_in_threadpool(run)
