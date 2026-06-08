from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("halls", "0001_initial"),
        ("bookings", "0002_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SeatingAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("session_id", models.CharField(max_length=120)),
                ("student_index", models.CharField(max_length=64)),
                ("full_name", models.CharField(blank=True, default="", max_length=255)),
                ("row_number", models.PositiveIntegerField()),
                ("column_number", models.PositiveIntegerField()),
                ("seat_label", models.CharField(max_length=16)),
                ("zone", models.CharField(blank=True, default="", max_length=80)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="created_seating_assignments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "hall",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="seating_assignments",
                        to="halls.hall",
                    ),
                ),
            ],
            options={
                "ordering": ["session_id", "zone", "row_number", "column_number"],
            },
        ),
        migrations.AddConstraint(
            model_name="seatingassignment",
            constraint=models.UniqueConstraint(
                fields=("session_id", "hall", "zone", "row_number", "column_number"),
                name="uniq_seating_slot_per_session",
            ),
        ),
        migrations.AddConstraint(
            model_name="seatingassignment",
            constraint=models.UniqueConstraint(
                fields=("session_id", "hall", "student_index"),
                name="uniq_student_per_session_hall",
            ),
        ),
    ]
