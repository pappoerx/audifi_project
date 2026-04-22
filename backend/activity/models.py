from django.db import models
from django.utils import timezone


class ActivityType(models.TextChoices):
    BOOKED = "booked", "Booked"
    BOOKING_CANCELLED = "booking_cancelled", "Booking Cancelled"
    CLASS_CALLED_OFF = "class_called_off", "Class Called Off"
    CHECKED_IN_KEYPAD = "checked_in_keypad", "Checked In Keypad"


class ActivityEvent(models.Model):
    type = models.CharField(max_length=40, choices=ActivityType.choices, default=ActivityType.BOOKED)
    lecturer_name = models.CharField(max_length=255, default="")
    auditorium = models.CharField(max_length=255, default="")
    course = models.CharField(max_length=255, blank=True)
    date = models.CharField(max_length=20, blank=True)
    time = models.CharField(max_length=40, blank=True)
    note = models.TextField(blank=True)
    at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-at"]

    def __str__(self) -> str:
        return f"{self.lecturer_name} - {self.type}"
