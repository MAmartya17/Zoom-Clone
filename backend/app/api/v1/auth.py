from fastapi import APIRouter, Depends, Response, status

from app.api.deps import get_auth_service, get_bearer_token, get_current_user
from app.models import User
from app.schemas.auth import AuthResponse, LoginRequest, SignupRequest
from app.schemas.user import UserOut
from app.services.auth_service import AuthService, SignedIn

router = APIRouter(prefix="/auth", tags=["auth"])


def _response(signed_in: SignedIn) -> AuthResponse:
    return AuthResponse(user=UserOut.model_validate(signed_in.user), token=signed_in.token)


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, auth: AuthService = Depends(get_auth_service)):
    return _response(auth.signup(body))


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, auth: AuthService = Depends(get_auth_service)):
    return _response(auth.login(body))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    _: User = Depends(get_current_user),
    token: str | None = Depends(get_bearer_token),
    auth: AuthService = Depends(get_auth_service),
):
    auth.logout(token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
