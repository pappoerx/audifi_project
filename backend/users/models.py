from django.contrib.auth.models import AbstractUser
from django.db import models
import secrets


class UserRole(models.TextChoices):
    STUDENT = "student", "Student"
    STAFF = "staff", "Lecturer/Staff"
    ADMIN = "admin", "Admin"
    TA = "ta", "Teaching Assistant"


class User(AbstractUser):
    institutional_id = models.CharField(max_length=32, unique=True)
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.STUDENT)
    full_name = models.CharField(max_length=255, blank=True)
    display_name = models.CharField(max_length=255, blank=True)
    department = models.CharField(max_length=255, blank=True, null=True)
    program = models.CharField(max_length=255, blank=True, null=True)
    preferences = models.JSONField(default=dict, blank=True)

    REQUIRED_FIELDS = ["email", "institutional_id"]

    def __str__(self) -> str:
        return self.display_name or self.full_name or self.username


class UserToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tokens")
    token = models.CharField(max_length=80, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @classmethod
    def issue_for_user(cls, user: User):
        token = secrets.token_urlsafe(48)
        return cls.objects.create(user=user, token=token)
