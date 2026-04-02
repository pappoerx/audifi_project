from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.course import Course
from app.models.time_slot import TimeSlot
from app.schemas.common import CourseOut, TimeSlotOut

router = APIRouter(tags=["meta"])


@router.get("/courses", response_model=list[CourseOut])
def list_courses(
    _user: Annotated[object, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[Course]:
    return db.query(Course).order_by(Course.title).all()


@router.get("/time-slots", response_model=list[TimeSlotOut])
def list_time_slots(
    _user: Annotated[object, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[TimeSlot]:
    return db.query(TimeSlot).order_by(TimeSlot.start_time).all()
