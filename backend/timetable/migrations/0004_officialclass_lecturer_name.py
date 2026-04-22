from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("timetable", "0003_officialclass_student_group"),
    ]

    operations = [
        migrations.AddField(
            model_name="officialclass",
            name="lecturer_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
