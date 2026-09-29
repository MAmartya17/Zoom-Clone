from app.schemas.common import ApiModel


class UserOut(ApiModel):
    id: int
    name: str
    email: str
