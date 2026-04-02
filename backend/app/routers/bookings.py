from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.deps import require_staff
from app.models.activity import Activity
from app.models.booking import Booking, BookingCheckIn, BookingStatus
from app.models.course import Course
from app.models.hall import Hall
from app.models.time_slot import TimeSlot
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingOut
from app.services.booking_rules import validate_booking_not_in_past

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _booking_out(b: Booking) -> BookingOut:
    return BookingOut(
        id=b.id,
        hall_id=b.hall_id,
        hall_name=b.hall.name if b.hall else "",
        course_id=b.course_id,
        course_title=b.course.title if b.course else "",
        booking_date=b.booking_date,
        time_slot_id=b.time_slot_id,
        time_slot_label=b.time_slot.label if b.time_slot else "",
        status=b.status,
    )


def _log_activity(
    db: Session,
    type_str: str,
    lecturer: User,
    hall: Hall,
    course: Course,
    booking_date,
    slot: TimeSlot | None,
    note: str | None = None,
) -> None:
    a = Activity(
        type=type_str,
        created_at=datetime.now(timezone.utc),
        lecturer_id=lecturer.id,
        hall_id=hall.id,
        course_id=course.id,
        booking_date=booking_date,
        time_slot_id=slot.id if slot else None,
        note=note,
    )
    db.add(a)


@router.get("/me", response_model=list[BookingOut])
def my_bookings(
    user: Annotated[User, Depends(require_staff)],
    db: Annotated[Session, Depends(get_db)],
) -> list[BookingOut]:
    from app.services.booking_rules import is_booking_active_for_listing

    rows = (
        db.query(Booking)
        .options(joinedload(Booking.hall), joinedload(Booking.course), joinedload(Booking.time_slot))
        .filter(Booking.lecturer_id == user.id)
        .order_by(Booking.booking_date, Booking.created_at)
        .all()
    )
    out = []
    for b in rows:
        if b.status != BookingStatus.active.value:
            continue
        if not is_booking_active_for_listing(b.booking_date, b.time_slot):
            continue
        out.append(_booking_out(b))
    return out


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    body: BookingCreate,
    user: Annotated[User, Depends(require_staff)],
    db: Annotated[Session, Depends(get_db)],
) -> BookingOut:
    hall = db.get(Hall, body.hall_id)
    course = db.get(Course, body.course_id)
    slot = db.get(TimeSlot, body.time_slot_id)
    if not hall or not course or not slot:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid hall, course, or slot")

    ok, msg = validate_booking_not_in_past(body.booking_date, slot)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg or "Invalid booking time")

    conflict = (
        db.query(Booking)
        .filter(
            Booking.hall_id == body.hall_id,
            Booking.booking_date == body.booking_date,
            Booking.time_slot_id == body.time_slot_id,
            Booking.status == BookingStatus.active.value,
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This hall is already booked for that date and time slot.",
        )

    now = datetime.now(timezone.utc)
    b = Booking(
        hall_id=body.hall_id,
        course_id=body.course_id,
        lecturer_id=user.id,
        booking_date=body.booking_date,
        time_slot_id=body.time_slot_id,
        status=BookingStatus.active.value,
        created_at=now,
        updated_at=now,
    )
    db.add(b)
    db.flush()
    _log_activity(db, "booked", user, hall, course, body.booking_date, slot)
    db.commit()
    db.refresh(b)
    b = (
        db.query(Booking)
        .options(joinedload(Booking.hall), joinedload(Booking.course), joinedload(Booking.time_slot))
        .filter(Booking.id == b.id)
        .first()
    )
    return _booking_out(b)


def _get_owned_booking(db: Session, booking_id: UUID, user: User) -> Booking:
    b = (
        db.query(Booking)
        .options(joinedload(Booking.hall), joinedload(Booking.course), joinedload(Booking.time_slot))
        .filter(Booking.id == booking_id, Booking.lecturer_id == user.id)
        .first()
    )
    if b is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if b.status != BookingStatus.active.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking is not active")
    return b


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: UUID,
    user: Annotated[User, Depends(require_staff)],
    db: Annotated[Session, Depends(get_db)],
) -> BookingOut:
    b = _get_owned_booking(db, booking_id, user)
    b.status = BookingStatus.cancelled.value
    b.updated_at = datetime.now(timezone.utc)
    _log_activity(db, "booking_cancelled", user, b.hall, b.course, b.booking_date, b.time_slot)
    db.commit()
    db.refresh(b)
    return _booking_out(b)


@router.post("/{booking_id}/call-off", response_model=BookingOut)
def call_off_booking(
    booking_id: UUID,
    user: Annotated[User, Depends(require_staff)],
    db: Annotated[Session, Depends(get_db)],
) -> BookingOut:
    b = _get_owned_booking(db, booking_id, user)
    b.status = BookingStatus.called_off.value
    b.updated_at = datetime.now(timezone.utc)
    _log_activity(db, "class_called_off", user, b.hall, b.course, b.booking_date, b.time_slot)
    db.commit()
    db.refresh(b)
    return _booking_out(b)


@router.post("/{booking_id}/check-in", response_model=BookingOut)
def check_in_booking(
    booking_id: UUID,
    user: Annotated[User, Depends(require_staff)],
    db: Annotated[Session, Depends(get_db)],
) -> BookingOut:
    b = _get_owned_booking(db, booking_id, user)
    now = datetime.now(timezone.utc)
    existing = db.query(BookingCheckIn).filter(BookingCheckIn.booking_id == b.id).first()
    if existing:
        existing.checked_in_at = now
    else:
        db.add(BookingCheckIn(booking_id=b.id, checked_in_at=now))
    _log_activity(db, "checked_in_keypad", user, b.hall, b.course, b.booking_date, b.time_slot)
    db.commit()
    db.refresh(b)
    b = (
        db.query(Booking)
        .options(joinedload(Booking.hall), joinedload(Booking.course), joinedload(Booking.time_slot))
        .filter(Booking.id == booking_id)
        .first()
    )
    return _booking_out(b)
