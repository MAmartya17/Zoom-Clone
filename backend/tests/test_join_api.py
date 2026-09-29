import pytest

from app.core.clock import utc_now
from app.core.security import generate_passcode, hash_password
from app.models import Meeting, MeetingStatus, MeetingType, User


def join(client, code: str, name: str = "Priya", passcode: str = ""):
    return client.post(f"/api/v1/meetings/{code}/join", json={"display_name": name, "passcode": passcode})


class TestJoinMeeting:
    def test_join_returns_attendee_session_and_meeting_details(self, client, instant_meeting):
        response = join(client, instant_meeting["meeting_code"], "  Priya  ", instant_meeting["passcode"])

        assert response.status_code == 201
        body = response.json()
        assert body["participant"]["display_name"] == "Priya"  # trimmed
        assert body["participant"]["role"] == "attendee"
        assert body["participant"]["status"] == "pending"
        assert body["token"]
        assert body["meeting"]["meeting_code"] == instant_meeting["meeting_code"]

    def test_guest_can_join_without_signing_in(self, guest_client, instant_meeting):
        response = join(guest_client, instant_meeting["meeting_code"], "Guest", instant_meeting["passcode"])
        assert response.status_code == 201
        assert response.json()["participant"]["role"] == "attendee"

    def test_join_accepts_formatted_meeting_id(self, client, instant_meeting):
        response = join(client, instant_meeting["formatted_code"], passcode=instant_meeting["passcode"])
        assert response.status_code == 201

    def test_wrong_passcode_is_forbidden(self, client, instant_meeting):
        response = join(client, instant_meeting["meeting_code"], passcode="wrong")
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "INVALID_PASSCODE"

    @pytest.mark.parametrize("name", ["", "   ", "x" * 65])
    def test_invalid_display_name_is_rejected(self, client, instant_meeting, name):
        response = join(client, instant_meeting["meeting_code"], name, instant_meeting["passcode"])
        assert response.status_code == 422
        assert "display_name" in response.json()["error"]["details"]

    def test_nonexistent_meeting_is_not_found(self, client):
        assert join(client, "98765432101", passcode="x").status_code == 404

    def test_ended_meeting_is_gone(self, client, instant_meeting):
        code = instant_meeting["meeting_code"]
        token = client.post(f"/api/v1/meetings/{code}/start", json={"display_name": "Alex"}).json()["token"]
        with client.websocket_connect(f"/ws/meetings/{code}?token={token}") as ws:
            ws.receive_json()
            assert client.post(f"/api/v1/meetings/{code}/end").status_code == 200

        response = join(client, code, passcode=instant_meeting["passcode"])
        assert response.status_code == 410
        assert response.json()["error"]["code"] == "MEETING_ENDED"


class TestStartMeeting:
    def test_host_start_issues_host_session(self, client, instant_meeting):
        response = client.post(
            f"/api/v1/meetings/{instant_meeting['meeting_code']}/start", json={"display_name": "Alex"}
        )
        assert response.status_code == 201
        assert response.json()["participant"]["role"] == "host"

    def test_non_host_cannot_start(self, client, db):
        other = User(name="Someone Else", email="other@example.com", password_hash=hash_password("secret123"))
        db.add(other)
        db.flush()
        now = utc_now()
        db.add(
            Meeting(
                meeting_code="11122233344",
                passcode=generate_passcode(),
                host_id=other.id,
                title="Not yours",
                meeting_type=MeetingType.INSTANT,
                status=MeetingStatus.SCHEDULED,
                scheduled_start_at=now,
                scheduled_end_at=now.replace(year=now.year + 1),
            )
        )
        db.commit()

        response = client.post("/api/v1/meetings/11122233344/start", json={"display_name": "Alex"})
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "NOT_HOST"
