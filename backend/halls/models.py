from django.db import models


class Hall(models.Model):
    name = models.CharField(max_length=120, unique=True)
    capacity = models.PositiveIntegerField()
    location = models.CharField(max_length=200)
    campus_zone = models.CharField(max_length=120, default="School of Business")
    has_wifi = models.BooleanField(default=True)
    has_projector = models.BooleanField(default=True)
    has_ac = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
