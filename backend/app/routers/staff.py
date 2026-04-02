from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_staff
from app.models.user import User
from app.services.analytics import compute_analytics

router = APIRouter(prefix="/staff", tags=["staff"])


@router.get("/analytics")
def staff_analytics(
    user: Annotated[User, Depends(require_staff)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    return compute_analytics(db, user)
