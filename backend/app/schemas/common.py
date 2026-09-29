from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, PlainSerializer, StringConstraints

from app.core.clock import as_aware_utc


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def _strip_required(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("This field cannot be empty.")
    return stripped


# Trimmed, non-empty string; length limits are applied per field.
RequiredText = Annotated[str, AfterValidator(_strip_required)]

DisplayName = Annotated[
    RequiredText,
    StringConstraints(max_length=64),
]

# DB values are naive UTC; always emit explicit UTC ISO-8601 so browsers
# convert to local time correctly.
UtcDatetime = Annotated[
    datetime,
    PlainSerializer(lambda v: as_aware_utc(v).isoformat().replace("+00:00", "Z"), return_type=str),
]
