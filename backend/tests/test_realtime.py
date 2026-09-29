import pytest
from starlette.websockets import WebSocketDisconnect

from app.schemas.ws import WsCloseCode


def start(client, code: str, name: str = "Alex") -> dict:
    return client.post(f"/api/v1/meetings/{code}/start", json={"display_name": name}).json()


def join(client, meeting: dict, name: str) -> dict:
    return client.post(
        f"/api/v1/meetings/{meeting['meeting_code']}/join",
        json={"display_name": name, "passcode": meeting["passcode"]},
    ).json()


def connect(client, code: str, token: str):
    return client.websocket_connect(f"/ws/meetings/{code}?token={token}")


def recent_titles(client) -> list[str]:
    return [m["title"] for m in client.get("/api/v1/meetings", params={"scope": "recent"}).json()]


@pytest.fixture
def room(client, instant_meeting):
    """Host and one attendee connected to the same live meeting."""
    code = instant_meeting["meeting_code"]
    host_session = start(client, code)
    guest_session = join(client, instant_meeting, "Priya")
    with connect(client, code, host_session["token"]) as host:
        # Wait until the host is in the room so the join order is deterministic.
        host.receive_json()  # room_state
        with connect(client, code, guest_session["token"]) as guest:
            guest.receive_json()  # room_state
            host.receive_json()  # participant_joined (Priya)
            yield {
                "code": code,
                "host": host,
                "guest": guest,
                "host_id": host_session["participant"]["id"],
                "guest_id": guest_session["participant"]["id"],
                "guest_token": guest_session["token"],
            }


def test_room_state_lists_everyone_and_meeting_goes_live(client, instant_meeting):
    code = instant_meeting["meeting_code"]
    host_session = start(client, code)
    guest_session = join(client, instant_meeting, "Priya")

    with connect(client, code, host_session["token"]) as host:
        assert host.receive_json()["participants"][0]["role"] == "host"
        with connect(client, code, guest_session["token"]) as guest:
            state = guest.receive_json()
            assert state["type"] == "room_state"
            assert state["self_id"] == guest_session["participant"]["id"]
            assert {p["display_name"] for p in state["participants"]} == {"Alex", "Priya"}

            joined = host.receive_json()
            assert joined == {"type": "participant_joined", "participant": state["participants"][1]}

    assert instant_meeting["title"] in recent_titles(client)


def test_invalid_token_is_rejected(client, instant_meeting):
    with connect(client, instant_meeting["meeting_code"], "bogus") as ws:
        assert ws.receive_json()["code"] == "INVALID_SESSION"
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
    assert closed.value.code == WsCloseCode.INVALID_SESSION


def test_signal_is_relayed_only_to_target(room):
    room["guest"].send_json({"type": "signal", "to": room["host_id"], "data": {"sdp": "offer"}})

    assert room["host"].receive_json() == {"type": "signal", "from": room["guest_id"], "data": {"sdp": "offer"}}


def test_signal_to_unknown_peer_returns_error(room):
    room["guest"].send_json({"type": "signal", "to": 9999, "data": {}})
    assert room["guest"].receive_json()["code"] == "PARTICIPANT_NOT_FOUND"


def test_media_state_is_broadcast(room):
    room["guest"].send_json({"type": "media_state", "audio": True, "video": False})

    for ws in (room["host"], room["guest"]):
        update = ws.receive_json()
        assert update["type"] == "participant_updated"
        assert update["participant"]["audio"] is True
        assert update["participant"]["video"] is False


def test_malformed_message_returns_error_without_disconnecting(room):
    room["guest"].send_text("not json")
    assert room["guest"].receive_json()["code"] == "INVALID_MESSAGE"
    room["guest"].send_json({"type": "unknown"})
    assert room["guest"].receive_json()["code"] == "INVALID_MESSAGE"


def test_attendee_cannot_use_host_controls(room):
    for message in (
        {"type": "mute_all"},
        {"type": "remove_participant", "participant_id": room["host_id"]},
        {"type": "end_meeting"},
    ):
        room["guest"].send_json(message)
        assert room["guest"].receive_json()["code"] == "NOT_HOST"


def test_host_mute_all_reaches_attendees(room):
    room["host"].send_json({"type": "mute_all"})
    assert room["guest"].receive_json() == {"type": "force_mute", "by": "Alex"}


def test_host_can_mute_single_participant(room):
    room["host"].send_json({"type": "mute_participant", "participant_id": room["guest_id"]})
    assert room["guest"].receive_json()["type"] == "force_mute"


def test_host_removes_participant(client, room):
    room["host"].send_json({"type": "remove_participant", "participant_id": room["guest_id"]})

    assert room["guest"].receive_json()["type"] == "removed"
    with pytest.raises(WebSocketDisconnect) as closed:
        room["guest"].receive_json()
    assert closed.value.code == WsCloseCode.REMOVED
    assert room["host"].receive_json() == {"type": "participant_left", "participant_id": room["guest_id"]}

    # The removed session's token cannot be reused.
    with connect(client, room["code"], room["guest_token"]) as ws:
        assert ws.receive_json()["code"] == "INVALID_SESSION"

    statuses = {
        p["id"]: p["status"]
        for p in client.get(f"/api/v1/meetings/{room['code']}/participants", params={"active_only": False}).json()
    }
    assert statuses[room["guest_id"]] == "removed"


def test_host_ends_meeting_for_everyone(client, room):
    room["host"].send_json({"type": "end_meeting"})

    for ws in (room["host"], room["guest"]):
        assert ws.receive_json()["type"] == "meeting_ended"
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
        assert closed.value.code == WsCloseCode.MEETING_ENDED

    assert client.get(f"/api/v1/meetings/{room['code']}").status_code == 410


def test_chat_is_broadcast_and_persisted(client, room):
    room["guest"].send_json({"type": "chat_message", "body": "  Hello everyone  "})

    for ws in (room["host"], room["guest"]):
        event = ws.receive_json()
        assert event["type"] == "chat_message"
        assert event["message"]["body"] == "Hello everyone"
        assert event["message"]["sender_name"] == "Priya"

    history = client.get(f"/api/v1/meetings/{room['code']}/messages").json()
    assert [m["body"] for m in history] == ["Hello everyone"]


def test_leaving_notifies_others(client, instant_meeting):
    code = instant_meeting["meeting_code"]
    host_session = start(client, code)
    guest_session = join(client, instant_meeting, "Priya")
    with connect(client, code, host_session["token"]) as host:
        host.receive_json()
        with connect(client, code, guest_session["token"]) as guest:
            guest.receive_json()
            host.receive_json()
        assert host.receive_json() == {
            "type": "participant_left",
            "participant_id": guest_session["participant"]["id"],
        }
