from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.config import settings
from app.models.booking import BookingStatus
from app.models.time_slot import TimeSlot


def slot_window_on_date(booking_date: date, slot: TimeSlot) -> tuple[datetime, datetime]:
    tz = ZoneInfo(settings.timezone)
    start = datetime.combine(booking_date, slot.start_time, tzinfo=tz)
    end = datetime.combine(booking_date, slot.end_time, tzinfo=tz)
    return start, end


def validate_booking_not_in_past(booking_date: date, slot: TimeSlot) -> tuple[bool, str | None]:
    now = datetime.now(ZoneInfo(settings.timezone))
    if booking_date < now.date():
        return False, "You cannot book for a date that has already passed. Choose today or a future date."
    start, _ = slot_window_on_date(booking_date, slot)
    if start <= now:
        return (
            False,
            "This time slot has already started or ended. Choose a later time slot or another day.",
        )
    return True, None


def is_booking_active_for_listing(booking_date: date, slot: TimeSlot) -> bool:
    """Include in staff roster if date is today or future and slot hasn't ended yet."""
    now = datetime.now(ZoneInfo(settings.timezone))
    _, end = slot_window_on_date(booking_date, slot)
    if booking_date < now.date():
        return False
    if booking_date == now.date() and end < now:
        return False
    return True


def booking_status_value() -> str:
    return BookingStatus.active.value
