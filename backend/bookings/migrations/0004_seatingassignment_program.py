from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bookings", "0003_seatingassignment"),
    ]

    operations = [
        migrations.AddField(
            model_name="seatingassignment",
            name="program",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
    ]
