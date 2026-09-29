"""Domain exceptions and their translation into the API error contract.

Services raise these exceptions without knowing about HTTP; a single set of
handlers maps them to status codes, so REST and WebSocket code share the same
business rules and every error response has the same shape.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class DomainError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "BAD_REQUEST"
    message = "The request could not be processed."

    def __init__(self, message: str | None = None):
        super().__init__(message or self.message)
        self.message = message or self.message


class MeetingNotFound(DomainError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "MEETING_NOT_FOUND"
    message = "This meeting ID is not valid. Please check and try again."


class MeetingEnded(DomainError):
    status_code = status.HTTP_410_GONE
    code = "MEETING_ENDED"
    message = "This meeting has ended."


class MeetingCancelled(DomainError):
    status_code = status.HTTP_410_GONE
    code = "MEETING_CANCELLED"
    message = "This meeting has been cancelled by the host."


class InvalidPasscode(DomainError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "INVALID_PASSCODE"
    message = "The meeting passcode is incorrect."


class NotMeetingHost(DomainError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "NOT_HOST"
    message = "Only the host can perform this action."


class InvalidMeetingState(DomainError):
    status_code = status.HTTP_409_CONFLICT
    code = "INVALID_MEETING_STATE"
    message = "This action is not allowed in the meeting's current state."


class ParticipantNotFound(DomainError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "PARTICIPANT_NOT_FOUND"
    message = "Participant not found in this meeting."


class InvalidSession(DomainError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "INVALID_SESSION"
    message = "Your meeting session is invalid or has expired. Please join again."


class NotAuthenticated(DomainError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "NOT_AUTHENTICATED"
    message = "Please sign in to continue."


class InvalidCredentials(DomainError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "INVALID_CREDENTIALS"
    message = "Incorrect email or password."


class EmailAlreadyRegistered(DomainError):
    status_code = status.HTTP_409_CONFLICT
    code = "EMAIL_TAKEN"
    message = "An account with this email already exists."


class MeetingCodeGenerationFailed(DomainError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "MEETING_CODE_UNAVAILABLE"
    message = "Could not allocate a meeting ID. Please try again."


def _error_body(code: str, message: str, details=None) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


def _format_validation_errors(exc: RequestValidationError) -> dict[str, str]:
    details: dict[str, str] = {}
    for err in exc.errors():
        # loc looks like ("body", "title"); drop the location prefix for readability.
        field = ".".join(str(part) for part in err["loc"][1:]) or str(err["loc"][0])
        message = err["msg"].removeprefix("Value error, ")
        details.setdefault(field, message)
    return details


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def handle_domain_error(_: Request, exc: DomainError):
        return JSONResponse(status_code=exc.status_code, content=_error_body(exc.code, exc.message))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError):
        details = _format_validation_errors(exc)
        first_message = next(iter(details.values()), "Invalid request.")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_body("VALIDATION_ERROR", first_message, details),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, exc: Exception):
        # Log the full traceback server-side; never leak it to the client.
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body("INTERNAL_ERROR", "Something went wrong. Please try again."),
        )
