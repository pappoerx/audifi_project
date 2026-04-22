from django.conf import settings
from django.db import models

from halls.models import Hall


class WeekDay(models.IntegerChoices):
    MONDAY = 0, "Monday"
    TUESDAY = 1, "Tuesday"
    WEDNESDAY = 2, "Wednesday"
    THURSDAY = 3, "Thursday"
    FRIDAY = 4, "Friday"
    SATURDAY = 5, "Saturday"
    SUNDAY = 6, "Sunday"


class OfficialClass(models.Model):
    course_name = models.CharField(max_length=255)
    student_group = models.CharField(max_length=255, blank=True, default="")
    lecturer_name = models.CharField(max_length=255, blank=True, default="")
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="official_classes",
    )
    hall = models.ForeignKey(Hall, on_delete=models.PROTECT, related_name="official_classes")
    day_of_week = models.IntegerField(choices=WeekDay.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    semester = models.CharField(max_length=60)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["semester", "day_of_week", "start_time", "hall__name"]

    def __str__(self) -> str:
        return f"{self.course_name} @ {self.hall.name} ({self.semester})"
