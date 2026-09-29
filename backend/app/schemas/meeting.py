from datetime import datetime, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, BaseModel, Field, StringConstraints

from app.core.clock import to_naive_utc, utc_now
from app.models import Meeting, MeetingStatus, MeetingType
from app.schemas.common import ApiModel, RequiredText, UtcDatetime
from app.schemas.user import UserOut
from app.services.meeting_code import format_meeting_code

MIN_DURATION_MINUTES = 15
MAX_DURATION_MINUTES = 24 * 60
DURATION_STEP_MINUTES = 15
# Allow a small clock skew between browser and server when validating "future".
START_TIME_GRACE = timedelta(minutes=1)


def _validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError("Unknown time zone.") from None
    return value


def _validate_future_start(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("Start time must include a timezone offset.")
    if to_naive_utc(value) < utc_now() - START_TIME_GRACE:
        raise ValueError("Start time must be in the future.")
    return value


def _validate_duration(value: int) -> int:
    if not MIN_DURATION_MINUTES <= value <= MAX_DURATION_MINUTES:
        raise ValueError(
            f"Duration must be between {MIN_DURATION_MINUTES} minutes and {MAX_DURATION_MINUTES // 60} hours."
        )
    if value % DURATION_STEP_MINUTES:
        raise ValueError(f"Duration must be a multiple of {DURATION_STEP_MINUTES} minutes.")
    return value


Title = Annotated[RequiredText, StringConstraints(max_length=200)]
Description = Annotated[
    str,
    StringConstraints(max_length=2000, strip_whitespace=True),
    AfterValidator(lambda value: value or None),  # store blank descriptions as NULL
]
Passcode = Annotated[str, StringConstraints(min_length=1, max_length=10, pattern=r"^[A-Za-z0-9]+$")]
TimezoneName = Annotated[str, AfterValidator(_validate_timezone)]
FutureStart = Annotated[datetime, AfterValidator(_validate_future_start)]
Duration = Annotated[int, AfterValidator(_validate_duration)]


class MeetingScheduleRequest(BaseModel):
    title: Title
    description: Description | None = None
    start_time: FutureStart
    duration_minutes: Duration = 60
    timezone: TimezoneName = "UTC"
    passcode: Passcode | None = None
    mute_on_entry: bool = False
    host_video_on: bool = True
    participant_video_on: bool = True


class MeetingUpdateRequest(BaseModel):
    title: Title | None = None
    description: Description | None = None
    start_time: FutureStart | None = None
    duration_minutes: Duration | None = None
    timezone: TimezoneName | None = None
    passcode: Passcode | None = None
    mute_on_entry: bool | None = None
    host_video_on: bool | None = None
    participant_video_on: bool | None = None


class MeetingInstantRequest(BaseModel):
    title: Title | None = None


class MeetingDetail(ApiModel):
    """Full meeting view for the host and for admitted participants."""

    meeting_code: str
    formatted_code: str
    passcode: str
    invite_link: str
    title: str
    description: str | None
    meeting_type: MeetingType
    status: MeetingStatus
    start_time: UtcDatetime
    end_time: UtcDatetime
    duration_minutes: int
    timezone: str
    mute_on_entry: bool
    host_video_on: bool
    participant_video_on: bool
    started_at: UtcDatetime | None
    ended_at: UtcDatetime | None
    host: UserOut
    participant_count: int = Field(default=0, description="Distinct attendance sessions")


class MeetingPublic(ApiModel):
    """What anyone holding a meeting ID may see before joining (no passcode)."""

    meeting_code: str
    formatted_code: str
    title: str
    host_name: str
    status: MeetingStatus
    start_time: UtcDatetime
    # Pre-join defaults for camera/mic, applied by the client before entering.
    mute_on_entry: bool
    host_video_on: bool
    participant_video_on: bool


def build_invite_link(app_url: str, meeting: Meeting) -> str:
    return f"{app_url.rstrip('/')}/meeting/{meeting.meeting_code}?pwd={meeting.passcode}"


def to_meeting_detail(meeting: Meeting, app_url: str) -> MeetingDetail:
    return MeetingDetail(
        meeting_code=meeting.meeting_code,
        formatted_code=format_meeting_code(meeting.meeting_code),
        passcode=meeting.passcode,
        invite_link=build_invite_link(app_url, meeting),
        title=meeting.title,
        description=meeting.description,
        meeting_type=meeting.meeting_type,
        status=meeting.status,
        start_time=meeting.scheduled_start_at,
        end_time=meeting.scheduled_end_at,
        duration_minutes=meeting.duration_minutes,
        timezone=meeting.timezone,
        mute_on_entry=meeting.mute_on_entry,
        host_video_on=meeting.host_video_on,
        participant_video_on=meeting.participant_video_on,
        started_at=meeting.started_at,
        ended_at=meeting.ended_at,
        host=UserOut.model_validate(meeting.host),
        participant_count=len(meeting.participants),
    )


def to_meeting_public(meeting: Meeting) -> MeetingPublic:
    return MeetingPublic(
        meeting_code=meeting.meeting_code,
        formatted_code=format_meeting_code(meeting.meeting_code),
        title=meeting.title,
        host_name=meeting.host.name,
        status=meeting.status,
        start_time=meeting.scheduled_start_at,
        mute_on_entry=meeting.mute_on_entry,
        host_video_on=meeting.host_video_on,
        participant_video_on=meeting.participant_video_on,
    )
