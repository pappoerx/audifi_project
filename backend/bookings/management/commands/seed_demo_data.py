from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand

from bookings.models import Course, TimeSlot
from halls.models import Hall
from timetable.models import OfficialClass, WeekDay
from users.models import User, UserRole


class Command(BaseCommand):
    help = "Seed baseline data for AudiFi demo."

    def handle(self, *args, **options):
        staff, _ = User.objects.update_or_create(
            username="10000001",
            defaults={
                "institutional_id": "10000001",
                "role": UserRole.STAFF,
                "display_name": "Dr. Mensah",
                "password": make_password("password123"),
            },
        )
        User.objects.update_or_create(
            username="20000001",
            defaults={
                "institutional_id": "20000001",
                "role": UserRole.STUDENT,
                "display_name": "Kwame Mensah",
                "program": "BSc Information Systems",
                "password": make_password("password123"),
            },
        )

        halls = [
            ("Auditorium 1", 520, "School of Business"),
            ("Auditorium 2", 500, "School of Business"),
            ("Auditorium 3", 480, "School of Business"),
            ("Block A - Main", 420, "School of Business"),
            ("Block A - Basement", 320, "School of Business"),
            ("Block B - Main", 400, "School of Business"),
            ("Block B - Basement", 300, "School of Business"),
            ("Block C - Main", 390, "School of Business"),
            ("Block C - Basement", 290, "School of Business"),
            ("Block D - Main", 380, "School of Business"),
            ("Block D - Basement", 280, "School of Business"),
            ("Block E - Main", 370, "School of Business"),
            ("Block E - Basement", 270, "School of Business"),
            ("Block F - Main", 360, "School of Business"),
            ("Block F - Basement", 260, "School of Business"),
            ("FF 01", 150, "School of Business"),
            ("FF 02", 150, "School of Business"),
            ("FF 03", 140, "School of Business"),
            ("FF 04", 140, "School of Business"),
            ("FF 05", 130, "School of Business"),
            ("SF 01", 130, "School of Business"),
            ("SF 02", 130, "School of Business"),
            ("SF 03", 120, "School of Business"),
            ("SF 04", 120, "School of Business"),
            ("SF 05", 110, "School of Business"),
            ("TF 01", 110, "School of Business"),
            ("TF 02", 110, "School of Business"),
            ("TF 03", 100, "School of Business"),
            ("TF 04", 100, "School of Business"),
            ("TF 05", 90, "School of Business"),
        ]
        for name, cap, zone in halls:
            Hall.objects.update_or_create(
                name=name,
                defaults={"capacity": cap, "location": zone, "campus_zone": zone, "has_wifi": True, "has_projector": True},
            )

        courses = [
            ("BSBA101", "Introduction to Business Administration"),
            ("BSBA103", "Principles of Management"),
            ("BSBA105", "Principles of Marketing"),
            ("BSBA107", "Business Communication"),
            ("BSBA109", "Quantitative Techniques for Business"),
            ("BSBA201", "Financial Accounting"),
            ("BSBA203", "Cost and Management Accounting"),
            ("BSBA205", "Organizational Behaviour"),
            ("BSBA207", "Business Statistics"),
            ("BSBA209", "Business Economics"),
            ("BSBA251", "Human Resource Management"),
            ("BSBA253", "Consumer Behaviour"),
            ("BSBA255", "Operations Management"),
            ("BSBA301", "Strategic Management"),
            ("BSBA303", "Corporate Finance"),
            ("BSBA305", "Investment Analysis"),
            ("BSBA307", "Entrepreneurship"),
            ("BSBA309", "Small Business Management"),
            ("BSBA351", "Business Law"),
            ("BSBA353", "Business Research Methods"),
            ("BSBA361", "Building Professional Skills"),
            ("ISD231", "Introduction to Information Systems"),
            ("ISD233", "Systems Analysis and Design"),
            ("ISD235", "Data Communications"),
            ("ISD331", "Introduction to Business Analytics"),
            ("ISD333", "Management Information Systems"),
            ("ISD335", "E-Business Management"),
            ("ISD337", "IT Project Management"),
            ("ISD355", "Database Management for Business"),
            ("ISD357", "Introduction to Operations Management"),
            ("ISD359", "Introduction to Programming"),
            ("ISD431", "Business Intelligence"),
            ("ISD433", "Enterprise Systems"),
            ("ISD435", "Information Security Management"),
            ("ISD437", "Digital Transformation Strategy"),
            ("ACT201", "Intermediate Accounting I"),
            ("ACT203", "Intermediate Accounting II"),
            ("ACT305", "Auditing and Assurance"),
            ("ACT307", "Taxation"),
            ("FIN201", "Principles of Finance"),
            ("FIN303", "Financial Markets and Institutions"),
            ("FIN305", "Risk Management"),
            ("MKT201", "Marketing Management"),
            ("MKT303", "Digital Marketing"),
            ("MKT305", "Retail and Sales Management"),
            ("HRM301", "Training and Development"),
            ("HRM303", "Compensation Management"),
            ("MBA601", "Managerial Economics"),
            ("MBA603", "Leadership and Change"),
            ("MBA605", "Corporate Governance"),
        ]
        for code, title in courses:
            Course.objects.update_or_create(code=code, defaults={"title": title})

        slots = [
            ("8:00 AM – 10:00 AM", "08:00", "10:00"),
            ("10:30 AM – 12:30 PM", "10:30", "12:30"),
            ("1:00 PM – 3:00 PM", "13:00", "15:00"),
            ("3:30 PM – 5:30 PM", "15:30", "17:30"),
        ]
        for label, start, end in slots:
            TimeSlot.objects.update_or_create(label=label, defaults={"start_time": start, "end_time": end})

        hall_a = Hall.objects.get(name="Block A - Main")
        OfficialClass.objects.update_or_create(
            course_name="BSBA 301",
            hall=hall_a,
            day_of_week=WeekDay.MONDAY,
            start_time="10:30",
            end_time="12:30",
            semester="2026-Sem2",
            defaults={"lecturer": staff, "is_active": True},
        )

        self.stdout.write(self.style.SUCCESS("Seed complete."))
        self.stdout.write("Student login: 20000001 / password123")
        self.stdout.write("Staff login:   10000001 / password123")
