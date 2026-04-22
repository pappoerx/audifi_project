from datetime import date, time

from halls.models import Hall
from timetable.models import OfficialClass

from .models import TutorialBooking, TutorialBookingStatus


def overlaps(start_a: time, end_a: time, start_b: time, end_b: time) -> bool:
    return start_a < end_b and start_b < end_a


def official_conflict(hall: Hall, target_date: date, start_time: time, end_time: time):
    weekday = target_date.weekday()
    rows = OfficialClass.objects.filter(
        hall=hall,
        day_of_week=weekday,
        is_active=True,
    )
    for row in rows:
        if overlaps(start_time, end_time, row.start_time, row.end_time):
            return row
    return None


def tutorial_conflict(hall: Hall, target_date: date, start_time: time, end_time: time):
    rows = TutorialBooking.objects.filter(
        hall=hall,
        booking_date=target_date,
        status__in=[TutorialBookingStatus.BOOKED, TutorialBookingStatus.IN_SESSION],
    ).select_related("time_slot", "course")
    for row in rows:
        if overlaps(start_time, end_time, row.time_slot.start_time, row.time_slot.end_time):
            return row
    return None


def check_hall_availability(hall: Hall, target_date: date, start_time: time, end_time: time):
    off = official_conflict(hall, target_date, start_time, end_time)
    if off:
        return {
            "available": False,
            "reason": f"Official class: {off.course_name} ({off.start_time.strftime('%H:%M')} - {off.end_time.strftime('%H:%M')})",
        }
    tut = tutorial_conflict(hall, target_date, start_time, end_time)
    if tut:
        return {
            "available": False,
            "reason": f"Tutorial booking: {tut.course.title} ({tut.time_slot.start_time.strftime('%H:%M')} - {tut.time_slot.end_time.strftime('%H:%M')})",
        }
    return {"available": True, "reason": ""}
