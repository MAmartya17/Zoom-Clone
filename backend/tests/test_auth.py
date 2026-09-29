import pytest

from app.core.security import hash_password, verify_password

SIGNUP = {"name": "Priya Sharma", "email": "Priya@Example.com", "password": "secret123"}


def signup(client, **overrides):
    return client.post("/api/v1/auth/signup", json={**SIGNUP, **overrides})


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestPasswordHashing:
    def test_hash_is_salted_and_verifiable(self):
        first, second = hash_password("secret123"), hash_password("secret123")
        assert first != second  # random salt
        assert first.startswith("scrypt$")
        assert verify_password("secret123", first)
        assert not verify_password("wrong-pass1", first)

    def test_malformed_hash_is_rejected(self):
        assert not verify_password("secret123", "not-a-hash")


class TestSignup:
    def test_signup_creates_account_and_signs_in(self, guest_client):
        response = signup(guest_client)

        assert response.status_code == 201
        body = response.json()
        assert body["user"]["email"] == "priya@example.com"  # normalized
        assert "password" not in str(body["user"])
        me = guest_client.get("/api/v1/users/me", headers=bearer(body["token"]))
        assert me.json()["name"] == "Priya Sharma"

    def test_duplicate_email_is_rejected_case_insensitively(self, guest_client):
        signup(guest_client)
        response = signup(guest_client, email="PRIYA@example.com")
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "EMAIL_TAKEN"

    @pytest.mark.parametrize(
        ("override", "field"),
        [
            ({"email": "not-an-email"}, "email"),
            ({"password": "short1"}, "password"),
            ({"password": "lettersonly"}, "password"),
            ({"name": "  "}, "name"),
        ],
    )
    def test_invalid_signup_is_rejected(self, guest_client, override, field):
        response = signup(guest_client, **override)
        assert response.status_code == 422
        assert field in response.json()["error"]["details"]


class TestLogin:
    def test_login_with_valid_credentials(self, guest_client):
        signup(guest_client)
        response = guest_client.post("/api/v1/auth/login", json={"email": "priya@example.com", "password": "secret123"})
        assert response.status_code == 200
        assert response.json()["token"]

    @pytest.mark.parametrize(
        "credentials",
        [
            {"email": "priya@example.com", "password": "wrong-pass1"},
            {"email": "nobody@example.com", "password": "secret123"},
        ],
    )
    def test_bad_credentials_get_the_same_error(self, guest_client, credentials):
        signup(guest_client)
        response = guest_client.post("/api/v1/auth/login", json=credentials)
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


class TestProtectedRoutes:
    @pytest.mark.parametrize(
        ("method", "path"),
        [
            ("get", "/api/v1/users/me"),
            ("get", "/api/v1/meetings?scope=upcoming"),
            ("post", "/api/v1/meetings/instant"),
            ("post", "/api/v1/meetings/12345678901/start"),
        ],
    )
    def test_require_sign_in(self, guest_client, method, path):
        response = getattr(guest_client, method)(path)
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"

    def test_invalid_token_is_rejected(self, guest_client):
        response = guest_client.get("/api/v1/users/me", headers=bearer("forged-token"))
        assert response.status_code == 401

    def test_logout_revokes_the_token(self, guest_client):
        token = signup(guest_client).json()["token"]

        assert guest_client.post("/api/v1/auth/logout", headers=bearer(token)).status_code == 204
        assert guest_client.get("/api/v1/users/me", headers=bearer(token)).status_code == 401

    def test_meeting_preview_stays_public(self, client, guest_client, instant_meeting):
        assert guest_client.get(f"/api/v1/meetings/{instant_meeting['meeting_code']}").status_code == 200


def test_only_the_real_host_can_start_their_meeting(client, guest_client, instant_meeting):
    other_token = signup(guest_client).json()["token"]
    response = guest_client.post(
        f"/api/v1/meetings/{instant_meeting['meeting_code']}/start",
        json={"display_name": "Priya"},
        headers=bearer(other_token),
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "NOT_HOST"


def test_users_only_see_their_own_meetings(client, guest_client, schedule_payload):
    client.post("/api/v1/meetings", json=schedule_payload)
    other_token = signup(guest_client).json()["token"]

    response = guest_client.get("/api/v1/meetings", params={"scope": "upcoming"}, headers=bearer(other_token))
    assert response.json() == []
