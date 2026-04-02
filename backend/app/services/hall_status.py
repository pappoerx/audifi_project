from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models.booking import Booking, BookingStatus
from app.models.hall import Hall
from app.services.booking_rules import slot_window_on_date


@dataclass
class HallLiveState:
    status: str
    live: bool
    event_text: str


def _active_booking_for_hall_now(db: Session, hall_id: UUID, today: date, now: datetime) -> Booking | None:
    q = (
        db.query(Booking)
        .options(
            joinedload(Booking.course),
            joinedload(Booking.time_slot),
            joinedload(Booking.check_in),
        )
        .filter(
            Booking.hall_id == hall_id,
            Booking.booking_date == today,
            Booking.status == BookingStatus.active.value,
        )
    )
    for b in q.all():
        slot = b.time_slot
        if slot is None:
            continue
        start, end = slot_window_on_date(b.booking_date, slot)
        if start <= now <= end:
            return b
    return None


def hall_live_state(db: Session, hall: Hall, now: datetime | None = None) -> HallLiveState:
    if now is None:
        now = datetime.now(ZoneInfo(settings.timezone))
    today = now.date()
    b = _active_booking_for_hall_now(db, hall.id, today, now)
    if b is None:
        return HallLiveState(status="Available", live=False, event_text="No active event")
    course_title = b.course.title if b.course else ""
    slot_label = b.time_slot.label if b.time_slot else ""
    event_text = f"{course_title} ({slot_label})".strip()
    if b.check_in is not None:
        return HallLiveState(status="Occupied", live=True, event_text=event_text or course_title)
    return HallLiveState(status="Booked - Pending", live=False, event_text=event_text or course_title)


def hall_ids_available_now(db: Session, now: datetime | None = None) -> set[UUID]:
    if now is None:
        now = datetime.now(ZoneInfo(settings.timezone))
    available: set[UUID] = set()
    for hall in db.query(Hall).all():
        if hall_live_state(db, hall, now).status == "Available":
            available.add(hall.id)
    return available


def filter_halls_query(db: Session, q: str | None):
    hq = db.query(Hall)
    if q:
        term = f"%{q.lower()}%"
        hq = hq.filter(
            or_(
                Hall.name.ilike(term),
                Hall.code.ilike(term),
                Hall.campus_zone.ilike(term),
            )
        )
    return hq.order_by(Hall.name)
