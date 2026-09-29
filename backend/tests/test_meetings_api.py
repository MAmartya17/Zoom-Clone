import re

import pytest

from tests.conftest import TEST_APP_URL, future_iso


def upcoming_titles(client) -> list[str]:
    return [m["title"] for m in client.get("/api/v1/meetings", params={"scope": "upcoming"}).json()]


class TestInstantMeeting:
    def test_creates_meeting_with_unique_code_and_invite_link(self, client):
        first = client.post("/api/v1/meetings/instant").json()
        second = client.post("/api/v1/meetings/instant").json()

        assert re.fullmatch(r"[1-9]\d{10}", first["meeting_code"])
        assert first["meeting_code"] != second["meeting_code"]
        assert first["formatted_code"] == f"{first['meeting_code'][:3]} {first['meeting_code'][3:7]} {first['meeting_code'][7:]}"
        assert first["invite_link"] == f"{TEST_APP_URL}/meeting/{first['meeting_code']}?pwd={first['passcode']}"
        assert first["title"] == "Alex Morgan's Zoom Meeting"
        assert first["meeting_type"] == "instant"

    def test_unstarted_instant_meeting_is_not_listed_as_upcoming(self, client, instant_meeting):
        assert instant_meeting["title"] not in upcoming_titles(client)


class TestScheduleMeeting:
    def test_scheduled_meeting_is_persisted_and_shown_in_upcoming(self, client, schedule_payload):
        response = client.post("/api/v1/meetings", json=schedule_payload)

        assert response.status_code == 201
        body = response.json()
        assert body["duration_minutes"] == 45
        assert body["timezone"] == "Asia/Kolkata"
        assert body["invite_link"].startswith(f"{TEST_APP_URL}/meeting/{body['meeting_code']}")
        assert upcoming_titles(client) == ["Design Review"]

    def test_upcoming_is_sorted_by_start_time(self, client, schedule_payload):
        client.post("/api/v1/meetings", json={**schedule_payload, "title": "Later", "start_time": future_iso(days=3)})
        client.post("/api/v1/meetings", json={**schedule_payload, "title": "Sooner", "start_time": future_iso(hours=2)})
        assert upcoming_titles(client) == ["Sooner", "Later"]

    def test_custom_passcode_is_kept(self, client, schedule_payload):
        body = client.post("/api/v1/meetings", json={**schedule_payload, "passcode": "abc123"}).json()
        assert body["passcode"] == "abc123"

    @pytest.mark.parametrize(
        ("override", "field"),
        [
            ({"title": "   "}, "title"),
            ({"title": "x" * 201}, "title"),
            ({"start_time": "2020-01-01T10:00:00Z"}, "start_time"),
            ({"start_time": "2030-01-01T10:00:00"}, "start_time"),  # no timezone offset
            ({"start_time": "not-a-date"}, "start_time"),
            ({"duration_minutes": 10}, "duration_minutes"),
            ({"duration_minutes": 50}, "duration_minutes"),
            ({"duration_minutes": 24 * 60 + 15}, "duration_minutes"),
            ({"timezone": "Mars/Olympus"}, "timezone"),
            ({"passcode": "no spaces!"}, "passcode"),
        ],
    )
    def test_invalid_payload_returns_field_error(self, client, schedule_payload, override, field):
        response = client.post("/api/v1/meetings", json={**schedule_payload, **override})

        assert response.status_code == 422
        error = response.json()["error"]
        assert error["code"] == "VALIDATION_ERROR"
        assert field in error["details"]


class TestMeetingPreview:
    def test_preview_does_not_expose_passcode(self, client, instant_meeting):
        response = client.get(f"/api/v1/meetings/{instant_meeting['formatted_code']}")

        assert response.status_code == 200
        assert "passcode" not in response.json()
        assert response.json()["host_name"] == "Alex Morgan"

    @pytest.mark.parametrize("code", ["12345678901", "abc", "123"])
    def test_unknown_or_malformed_code_is_not_found(self, client, code):
        response = client.get(f"/api/v1/meetings/{code}")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "MEETING_NOT_FOUND"


class TestUpdateAndCancel:
    def test_update_changes_fields_and_keeps_duration(self, client, schedule_payload):
        code = client.post("/api/v1/meetings", json=schedule_payload).json()["meeting_code"]

        response = client.patch(f"/api/v1/meetings/{code}", json={"title": "Renamed", "start_time": future_iso(days=2)})

        assert response.status_code == 200
        assert response.json()["title"] == "Renamed"
        assert response.json()["duration_minutes"] == 45

    def test_cancelled_meeting_leaves_upcoming_and_cannot_be_joined(self, client, schedule_payload):
        meeting = client.post("/api/v1/meetings", json=schedule_payload).json()

        assert client.delete(f"/api/v1/meetings/{meeting['meeting_code']}").status_code == 204
        assert upcoming_titles(client) == []
        response = client.get(f"/api/v1/meetings/{meeting['meeting_code']}")
        assert response.status_code == 410
        assert response.json()["error"]["code"] == "MEETING_CANCELLED"

    def test_live_meeting_cannot_be_edited(self, client, instant_meeting):
        code = instant_meeting["meeting_code"]
        token = client.post(f"/api/v1/meetings/{code}/start", json={"display_name": "Alex"}).json()["token"]
        with client.websocket_connect(f"/ws/meetings/{code}?token={token}") as ws:
            ws.receive_json()  # room_state -> meeting is now live
            response = client.patch(f"/api/v1/meetings/{code}", json={"title": "Nope"})

        assert response.status_code == 409
        assert response.json()["error"]["code"] == "INVALID_MEETING_STATE"


def test_invalid_scope_is_rejected(client):
    assert client.get("/api/v1/meetings", params={"scope": "everything"}).status_code == 422
