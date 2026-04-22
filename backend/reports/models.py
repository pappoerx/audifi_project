from django.conf import settings
from django.db import models

from halls.models import Hall


class IssueStatus(models.TextChoices):
    OPEN = "open", "Open"
    IN_PROGRESS = "in_progress", "In Progress"
    RESOLVED = "resolved", "Resolved"


class IssueReport(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="issue_reports",
    )
    hall = models.ForeignKey(Hall, on_delete=models.PROTECT, related_name="issue_reports")
    issue = models.TextField()
    status = models.CharField(max_length=20, choices=IssueStatus.choices, default=IssueStatus.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.hall.name}: {self.issue[:50]}"
