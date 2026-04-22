import json
from datetime import date, datetime, time

from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_POST

from activity.models import ActivityEvent
from halls.models import Hall
from users.models import UserRole

from .models import TutorialBooking
from .services import check_hall_availability


def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def parse_time(value: str) -> time:
    return datetime.strptime(value, "%H:%M").time()


@require_GET
def find_available_halls(request: HttpRequest):
    date_str = request.GET.get("date")
    start_str = request.GET.get("start")
    end_str = request.GET.get("end")
    if not date_str or not start_str or not end_str:
        return JsonResponse(
            {"detail": "Query params date, start, and end are required (YYYY-MM-DD, HH:MM)."},
            status=400,
        )
    try:
        target_date = parse_date(date_str)
        start_time = parse_time(start_str)
        end_time = parse_time(end_str)
    except ValueError:
        return JsonResponse({"detail": "Invalid date/time format."}, status=400)

    if start_time >= end_time:
        return JsonResponse({"detail": "start must be earlier than end."}, status=400)

    rows = []
    for hall in Hall.objects.filter(is_active=True).order_by("name"):
        status = check_hall_availability(hall, target_date, start_time, end_time)
        rows.append(
            {
                "hall_id": hall.id,
                "hall_name": hall.name,
                "capacity": hall.capacity,
                "location": hall.location,
                "available": status["available"],
                "reason": status["reason"],
            }
        )
    return JsonResponse({"results": rows})


@require_POST
def create_tutorial_booking(request: HttpRequest):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required."}, status=401)
    if request.user.role not in [UserRole.STAFF, UserRole.TA, UserRole.ADMIN]:
        return JsonResponse({"detail": "Only staff/TAs/admins can create tutorial bookings."}, status=403)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON body."}, status=400)

    required_fields = ["course_name", "hall_id", "date", "start_time", "end_time"]
    missing = [field for field in required_fields if not payload.get(field)]
    if missing:
        return JsonResponse({"detail": f"Missing required fields: {', '.join(missing)}"}, status=400)

    try:
        hall = Hall.objects.get(id=payload["hall_id"], is_active=True)
        target_date = parse_date(payload["date"])
        start_time = parse_time(payload["start_time"])
        end_time = parse_time(payload["end_time"])
    except Hall.DoesNotExist:
        return JsonResponse({"detail": "Hall not found."}, status=404)
    except ValueError:
        return JsonResponse({"detail": "Invalid date/time format."}, status=400)

    if start_time >= end_time:
        return JsonResponse({"detail": "start_time must be earlier than end_time."}, status=400)

    availability = check_hall_availability(hall, target_date, start_time, end_time)
    if not availability["available"]:
        return JsonResponse({"detail": "Hall is not available.", "reason": availability["reason"]}, status=409)

    booking = TutorialBooking.objects.create(
        course_name=payload["course_name"].strip(),
        hall=hall,
        booked_by=request.user,
        date=target_date,
        start_time=start_time,
        end_time=end_time,
    )

    ActivityEvent.objects.create(
        message=f"{hall.name} booked for tutorial ({booking.course_name}) by {request.user.full_name or request.user.username}",
    )

    return JsonResponse(
        {
            "id": booking.id,
            "course_name": booking.course_name,
            "hall_id": booking.hall_id,
            "date": booking.date.isoformat(),
            "start_time": booking.start_time.strftime("%H:%M"),
            "end_time": booking.end_time.strftime("%H:%M"),
            "status": booking.status,
        },
        status=201,
    )
