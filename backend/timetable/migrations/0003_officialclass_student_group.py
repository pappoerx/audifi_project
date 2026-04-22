from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("timetable", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="officialclass",
            name="student_group",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
