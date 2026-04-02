from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserMe, UserOut, UserPatch
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.institutional_id == body.institutional_id.strip()).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserMe)
def me(user: Annotated[User, Depends(get_current_user)]):
    return user


@router.patch("/me", response_model=UserMe)
def patch_me(
    body: UserPatch,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if body.display_name is not None:
        user.display_name = body.display_name.strip() or user.display_name
    if body.department is not None:
        user.department = body.department.strip() or None
    if body.program is not None:
        user.program = body.program.strip() or None
    if body.preferences is not None:
        merged: dict[str, Any] = dict(user.preferences or {})
        merged.update(body.preferences)
        user.preferences = merged
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
