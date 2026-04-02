from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models.activity import Activity
from app.models.booking import Booking, BookingStatus
from app.models.hall import Hall
from app.models.user import User
from app.services.booking_rules import is_booking_active_for_listing


def _start_of_calendar_week(d: date) -> date:
    day = d.weekday()
    return d - timedelta(days=day)


def _end_of_calendar_week(start: date) -> date:
    return start + timedelta(days=7)


def compute_analytics(db: Session, _staff_user: User) -> dict:
    tz = ZoneInfo(settings.timezone)
    now = datetime.now(tz)
    today_str = now.date().isoformat()
    today = now.date()
    week_start = _start_of_calendar_week(today)
    week_end = _end_of_calendar_week(week_start)

    all_bookings = (
        db.query(Booking)
        .options(joinedload(Booking.time_slot))
        .filter(Booking.status == BookingStatus.active.value)
        .all()
    )

    roster = [b for b in all_bookings if is_booking_active_for_listing(b.booking_date, b.time_slot)]

    active_reservations = len(roster)
    today_sessions = len([b for b in roster if b.booking_date == today])
    week_sessions = len([b for b in roster if week_start <= b.booking_date < week_end])
    distinct_halls = len({b.hall_id for b in roster})
    catalog_halls = db.scalar(select(func.count()).select_from(Hall)) or 0
    hall_coverage_pct = 0 if catalog_halls == 0 else round((distinct_halls / catalog_halls) * 100)

    now_ms = now.timestamp() * 1000
    ms7d = 7 * 24 * 60 * 60 * 1000
    ms30d = 30 * 24 * 60 * 60 * 1000

    activities = db.query(Activity).order_by(Activity.created_at.desc()).limit(500).all()
    acts7d = [a for a in activities if (now_ms - a.created_at.timestamp() * 1000) <= ms7d]
    acts30d = [a for a in activities if (now_ms - a.created_at.timestamp() * 1000) <= ms30d]

    booked_logged_30d = len([a for a in acts30d if a.type == "booked"])
    cancelled_logged_30d = len([a for a in acts30d if a.type == "booking_cancelled"])
    call_offs_30d = len([a for a in acts30d if a.type == "class_called_off"])
    keypad_30d = len([a for a in acts30d if a.type == "checked_in_keypad"])

    if booked_logged_30d == 0:
        release_rate_display = "—"
        release_rate_hint = "No booking events in the last 30 days to benchmark."
    else:
        pct = round(((cancelled_logged_30d + call_offs_30d) / booked_logged_30d) * 100)
        release_rate_display = f"{pct}%"
        release_rate_hint = (
            "Cancel + call-off events as a share of new bookings logged (directional only)."
        )

    return {
        "today_str": today_str,
        "active_reservations": active_reservations,
        "today_sessions": today_sessions,
        "week_sessions": week_sessions,
        "distinct_halls": distinct_halls,
        "catalog_halls": catalog_halls,
        "hall_coverage_pct": hall_coverage_pct,
        "lecturer_events_7d": len(acts7d),
        "keypad_checkins_30d": keypad_30d,
        "new_bookings_logged_30d": booked_logged_30d,
        "released_cancelled_30d": cancelled_logged_30d,
        "classes_called_off_30d": call_offs_30d,
        "release_rate_display": release_rate_display,
        "release_rate_hint": release_rate_hint,
        "release_rate_warn": booked_logged_30d > 0
        and (cancelled_logged_30d + call_offs_30d) / booked_logged_30d > 0.35,
    }
