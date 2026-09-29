"""In-memory registry of live meeting rooms and their WebSocket connections.

Live connections are inherently process-local, so they live here; the database
keeps only durable facts (who joined/left and when). Scaling to multiple
server instances would replace the fan-out in this class with Redis pub/sub.
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass, field

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class MediaState:
    audio: bool = False
    video: bool = False
    screen: bool = False


@dataclass
class RoomMember:
    participant_id: int
    display_name: str
    role: str
    websocket: WebSocket = field(repr=False)
    media: MediaState = field(default_factory=MediaState)

    def to_public(self) -> dict:
        return {
            "id": self.participant_id,
            "display_name": self.display_name,
            "role": self.role,
            **asdict(self.media),
        }


@dataclass
class Room:
    code: str
    members: dict[int, RoomMember] = field(default_factory=dict)
    empty_timer: asyncio.Task | None = None

    def cancel_empty_timer(self) -> None:
        if self.empty_timer and not self.empty_timer.done():
            self.empty_timer.cancel()
        self.empty_timer = None


class RoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}

    # --- membership ---

    def add_member(self, code: str, member: RoomMember) -> None:
        room = self._rooms.setdefault(code, Room(code))
        room.cancel_empty_timer()
        room.members[member.participant_id] = member

    def remove_member(self, code: str, participant_id: int) -> RoomMember | None:
        room = self._rooms.get(code)
        return room.members.pop(participant_id, None) if room else None

    def get_member(self, code: str, participant_id: int) -> RoomMember | None:
        room = self._rooms.get(code)
        return room.members.get(participant_id) if room else None

    def members(self, code: str) -> list[RoomMember]:
        room = self._rooms.get(code)
        return list(room.members.values()) if room else []

    def is_empty(self, code: str) -> bool:
        return not self.members(code)

    # --- messaging ---

    async def send(self, code: str, participant_id: int, message: dict) -> bool:
        member = self.get_member(code, participant_id)
        if member is None:
            return False
        await self._safe_send(member, message)
        return True

    async def broadcast(self, code: str, message: dict, exclude: int | None = None) -> None:
        targets = [m for m in self.members(code) if m.participant_id != exclude]
        await asyncio.gather(*(self._safe_send(m, message) for m in targets))

    async def disconnect_member(self, code: str, participant_id: int, message: dict, close_code: int) -> None:
        """Notify one member, drop them from the room and close their socket."""
        member = self.remove_member(code, participant_id)
        if member:
            await self._safe_send(member, message)
            await self._safe_close(member, close_code)

    async def close_room(self, code: str, message: dict, close_code: int) -> None:
        room = self._rooms.pop(code, None)
        if room is None:
            return
        room.cancel_empty_timer()
        for member in list(room.members.values()):
            await self._safe_send(member, message)
            await self._safe_close(member, close_code)

    # --- empty-room lifecycle ---

    def schedule_if_empty(
        self, code: str, delay_seconds: float, on_still_empty: Callable[[], Awaitable[None]]
    ) -> None:
        room = self._rooms.get(code)
        if room is None or room.members:
            return

        async def _wait_then_close() -> None:
            await asyncio.sleep(delay_seconds)
            if self.is_empty(code):
                self._rooms.pop(code, None)
                await on_still_empty()

        room.cancel_empty_timer()
        room.empty_timer = asyncio.create_task(_wait_then_close())

    # --- helpers ---

    @staticmethod
    async def _safe_send(member: RoomMember, message: dict) -> None:
        # A socket can close between lookup and send; its own handler cleans up.
        try:
            await member.websocket.send_json(message)
        except Exception:  # noqa: BLE001
            logger.debug("Dropping message to closed socket of participant %s", member.participant_id)

    @staticmethod
    async def _safe_close(member: RoomMember, code: int) -> None:
        try:
            await member.websocket.close(code=code)
        except Exception:  # noqa: BLE001
            pass


room_manager = RoomManager()
