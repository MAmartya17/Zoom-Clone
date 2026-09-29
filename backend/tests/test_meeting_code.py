import pytest

from app.core.errors import MeetingCodeGenerationFailed
from app.services.meeting_code import format_meeting_code, generate_meeting_code, normalize_meeting_code
from app.services.meeting_service import MAX_CODE_ATTEMPTS, MeetingService
from app.services.user_service import UserService


def test_generated_codes_are_eleven_digits_without_leading_zero():
    for _ in range(200):
        code = generate_meeting_code()
        assert len(code) == 11 and code.isdigit() and code[0] != "0"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("12345678901", "12345678901"),
        ("123 4567 8901", "12345678901"),
        ("123-4567-8901", "12345678901"),
        ("1234567890", None),
        ("abcdefghijk", None),
        ("", None),
    ],
)
def test_normalize_meeting_code(raw, expected):
    assert normalize_meeting_code(raw) == expected


def test_format_meeting_code():
    assert format_meeting_code("12345678901") == "123 4567 8901"


def test_code_collision_is_retried(db, settings):
    host = UserService(db).get_or_create_default_user(settings)
    codes = iter(["11111111111", "11111111111", "22222222222"])
    service = MeetingService(db, code_generator=lambda: next(codes))

    first = service.create_instant(host)
    second = service.create_instant(host)

    assert first.meeting_code == "11111111111"
    assert second.meeting_code == "22222222222"


def test_gives_up_after_repeated_collisions(db, settings):
    host = UserService(db).get_or_create_default_user(settings)
    service = MeetingService(db, code_generator=lambda: "33333333333")
    service.create_instant(host)

    with pytest.raises(MeetingCodeGenerationFailed):
        service.create_instant(host)
    assert MAX_CODE_ATTEMPTS > 1
