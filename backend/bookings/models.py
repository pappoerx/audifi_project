from django.conf import settings
from django.db import models

from halls.models import Hall


class Course(models.Model):
    code = models.CharField(max_length=32, unique=True)
    title = models.CharField(max_length=255)

    class Meta:
        ordering = ["code"]

    def __str__(self) -> str:
        return f"{self.code} {self.title}"


class TimeSlot(models.Model):
    label = models.CharField(max_length=80, unique=True)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        ordering = ["start_time"]

    def __str__(self) -> str:
        return self.label


class TutorialBookingStatus(models.TextChoices):
    BOOKED = "booked", "Booked"
    CANCELLED = "cancelled", "Cancelled"
    IN_SESSION = "in_session", "In Session"
    COMPLETED = "completed", "Completed"


class TutorialBooking(models.Model):
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name="tutorial_bookings")
    hall = models.ForeignKey(Hall, on_delete=models.PROTECT, related_name="tutorial_bookings")
    booked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="tutorial_bookings",
    )
    booking_date = models.DateField()
    time_slot = models.ForeignKey(TimeSlot, on_delete=models.PROTECT, related_name="tutorial_bookings")
    status = models.CharField(
        max_length=20,
        choices=TutorialBookingStatus.choices,
        default=TutorialBookingStatus.BOOKED,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-booking_date", "time_slot__start_time", "hall__name"]

    def __str__(self) -> str:
        return f"{self.course.title} @ {self.hall.name} ({self.booking_date})"


class SeatingAssignment(models.Model):
    session_id = models.CharField(max_length=120)
    hall = models.ForeignKey(Hall, on_delete=models.PROTECT, related_name="seating_assignments", null=True, blank=True)
    student_index = models.CharField(max_length=64)
    full_name = models.CharField(max_length=255, blank=True, default="")
    row_number = models.PositiveIntegerField()
    column_number = models.PositiveIntegerField()
    seat_label = models.CharField(max_length=16)
    zone = models.CharField(max_length=80, blank=True, default="")
    program = models.CharField(max_length=120, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_seating_assignments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["session_id", "zone", "row_number", "column_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["session_id", "hall", "zone", "row_number", "column_number"],
                name="uniq_seating_slot_per_session",
            ),
            models.UniqueConstraint(
                fields=["session_id", "hall", "student_index"],
                name="uniq_student_per_session_hall",
            ),
        ]

    def __str__(self) -> str:
        hall_name = self.hall.name if self.hall_id else "No hall"
        return f"{self.session_id} · {self.student_index} · {self.seat_label} @ {hall_name}"
