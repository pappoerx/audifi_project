from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.deps import get_current_user
from app.models.activity import Activity
from app.schemas.common import ActivityOut

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=list[ActivityOut])
def list_activity(
    _user: Annotated[object, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 40,
) -> list[ActivityOut]:
    rows = (
        db.query(Activity)
        .options(
            joinedload(Activity.lecturer),
            joinedload(Activity.hall),
            joinedload(Activity.course),
            joinedload(Activity.time_slot),
        )
        .order_by(Activity.created_at.desc())
        .limit(limit)
        .all()
    )
    out: list[ActivityOut] = []
    for a in rows:
        slot_label = a.time_slot.label if a.time_slot else None
        out.append(
            ActivityOut(
                id=a.id,
                type=a.type,
                at=a.created_at,
                lecturer_name=a.lecturer.display_name if a.lecturer else "Lecturer",
                auditorium=a.hall.name if a.hall else "",
                course=a.course.title if a.course else "",
                date=a.booking_date.isoformat() if a.booking_date else None,
                time=slot_label,
                note=a.note,
            )
        )
    return out
