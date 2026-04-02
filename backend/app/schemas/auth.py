from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.user import UserRole


class LoginRequest(BaseModel):
    institutional_id: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    id: UUID
    institutional_id: str
    role: UserRole
    display_name: str
    department: str | None
    program: str | None
    preferences: dict[str, Any] | None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserMe(UserOut):
    pass


class UserPatch(BaseModel):
    display_name: str | None = None
    department: str | None = None
    program: str | None = None
    preferences: dict[str, Any] | None = None
