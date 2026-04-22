from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse
from campus_system.student_api import activity_feed, auth_login, auth_me, create_issue_report, halls_list
from campus_system.staff_api import (
    bookings_resource,
    call_off_booking,
    cancel_booking,
    courses_list,
    fixed_timetable_list,
    fixed_timetable_upload,
    halls_availability_for_slot,
    staff_analytics,
    time_slots_list,
)


def root(request):
    return JsonResponse(
        {
            "service": "AudiFi backend",
            "status": "ok",
            "routes": [
                "/admin/",
                "/auth/login",
                "/auth/me",
                "/student/halls",
                "/student/activity",
                "/student/issues/report",
                "/staff/courses",
                "/staff/time-slots",
                "/staff/bookings",
                "/staff/analytics",
            ],
        }
    )

urlpatterns = [
    path("", root, name="root"),
    path("admin/", admin.site.urls),
    # Backward-compatible routes used by current frontend
    path("auth/login", auth_login),
    path("auth/me", auth_me),
    path("halls", halls_list),
    path("courses", courses_list),
    path("time-slots", time_slots_list),
    path("halls/availability", halls_availability_for_slot),
    path("fixed-timetable", fixed_timetable_list),
    path("fixed-timetable/upload", fixed_timetable_upload),
    path("bookings", bookings_resource),
    path("bookings/me", bookings_resource),
    path("bookings/<int:booking_id>/cancel", cancel_booking),
    path("bookings/<int:booking_id>/call-off", call_off_booking),
    path("activity", activity_feed),
    path("issue-reports", create_issue_report),
    # Role-separated routes for cleaner architecture
    path("student/halls", halls_list),
    path("student/activity", activity_feed),
    path("student/issues/report", create_issue_report),
    path("staff/courses", courses_list),
    path("staff/time-slots", time_slots_list),
    path("staff/halls/availability", halls_availability_for_slot),
    path("staff/fixed-timetable", fixed_timetable_list),
    path("staff/fixed-timetable/upload", fixed_timetable_upload),
    path("staff/bookings", bookings_resource),
    path("staff/bookings/me", bookings_resource),
    path("staff/bookings/<int:booking_id>/cancel", cancel_booking),
    path("staff/bookings/<int:booking_id>/call-off", call_off_booking),
    path("staff/analytics", staff_analytics),
    path("api/bookings/", include("bookings.urls")),
]
