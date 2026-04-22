import csv
import re
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError

from halls.models import Hall
from timetable.models import OfficialClass, WeekDay
from users.models import User, UserRole


class Command(BaseCommand):
    help = "Import fixed timetable into OfficialClass records (CSV or PDF)."

    def add_arguments(self, parser):
        parser.add_argument("--csv", help="Absolute or relative CSV path")
        parser.add_argument("--pdf", help="Absolute or relative PDF path")
        parser.add_argument("--semester", default="2026-Sem1", help="Semester label override")
        parser.add_argument(
            "--default-lecturer-id",
            default="10000001",
            help="Lecturer institutional_id used when lecturer_id column is missing",
        )
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Delete existing OfficialClass rows before import",
        )

    def handle(self, *args, **options):
        csv_path = options.get("csv")
        pdf_path = options.get("pdf")
        semester_default = options["semester"]
        default_lecturer_id = options["default_lecturer_id"]
        truncate = options["truncate"]

        if not csv_path and not pdf_path:
            raise CommandError("Provide one source: --csv <path> or --pdf <path>")
        if csv_path and pdf_path:
            raise CommandError("Use either --csv or --pdf, not both")

        if truncate:
            OfficialClass.objects.all().delete()
            self.stdout.write(self.style.WARNING("Deleted existing OfficialClass rows."))

        default_lecturer = (
            User.objects.filter(institutional_id=default_lecturer_id, role__in=[UserRole.STAFF, UserRole.TA, UserRole.ADMIN])
            .order_by("id")
            .first()
        )
        if not default_lecturer:
            raise CommandError(f"Could not find default lecturer with institutional_id={default_lecturer_id}")

        day_map = {
            "monday": WeekDay.MONDAY,
            "tuesday": WeekDay.TUESDAY,
            "wednesday": WeekDay.WEDNESDAY,
            "thursday": WeekDay.THURSDAY,
            "friday": WeekDay.FRIDAY,
            "saturday": WeekDay.SATURDAY,
            "sunday": WeekDay.SUNDAY,
        }

        created = 0
        updated = 0
        skipped = 0

        def upsert_row(row_idx, row_data):
            nonlocal created, updated, skipped
            try:
                course_name = (row_data.get("course_name") or "").strip()
                hall_name = (row_data.get("hall_name") or "").strip()
                day_raw = (row_data.get("day_of_week") or "").strip().lower()
                start_raw = (row_data.get("start_time") or "").strip()
                end_raw = (row_data.get("end_time") or "").strip()
                semester = (row_data.get("semester") or "").strip() or semester_default
                lecturer_id = (row_data.get("lecturer_id") or "").strip()

                if not all([course_name, hall_name, day_raw, start_raw, end_raw]):
                    skipped += 1
                    self.stdout.write(self.style.WARNING(f"Row {row_idx}: missing required value(s), skipped"))
                    return

                if day_raw not in day_map:
                    skipped += 1
                    self.stdout.write(self.style.WARNING(f"Row {row_idx}: invalid day_of_week '{day_raw}', skipped"))
                    return

                start_time = datetime.strptime(start_raw, "%H:%M").time()
                end_time = datetime.strptime(end_raw, "%H:%M").time()
                if start_time >= end_time:
                    skipped += 1
                    self.stdout.write(self.style.WARNING(f"Row {row_idx}: start_time must be before end_time, skipped"))
                    return

                hall = Hall.objects.filter(name=hall_name).first()
                if not hall:
                    hall = Hall.objects.create(
                        name=hall_name,
                        capacity=200,
                        location="School of Business",
                        campus_zone="School of Business",
                        has_wifi=True,
                        has_projector=True,
                        has_ac=False,
                        is_active=True,
                    )

                lecturer = (User.objects.filter(institutional_id=lecturer_id).first() if lecturer_id else None) or default_lecturer

                _, was_created = OfficialClass.objects.update_or_create(
                    course_name=course_name,
                    hall=hall,
                    day_of_week=day_map[day_raw],
                    start_time=start_time,
                    end_time=end_time,
                    semester=semester,
                    defaults={"lecturer": lecturer, "is_active": True},
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
            except ValueError as exc:
                skipped += 1
                self.stdout.write(self.style.WARNING(f"Row {row_idx}: parse error ({exc}), skipped"))

        if csv_path:
            with open(csv_path, newline="", encoding="utf-8-sig") as fh:
                reader = csv.DictReader(fh)
                required = {"course_name", "hall_name", "day_of_week", "start_time", "end_time"}
                missing = required - set(reader.fieldnames or [])
                if missing:
                    raise CommandError(
                        "CSV is missing required columns: " + ", ".join(sorted(missing))
                    )
                for idx, row in enumerate(reader, start=2):
                    upsert_row(idx, row)
        else:
            try:
                from pypdf import PdfReader
            except Exception as exc:
                raise CommandError(
                    f"PDF import requires pypdf. Install dependencies first. ({exc})"
                ) from exc

            reader = PdfReader(pdf_path)
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
            lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
            if not lines:
                raise CommandError("No extractable text found in PDF.")

            day_re = re.compile(r"\b(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b", re.I)
            time_re = re.compile(r"\b([01]?\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]?\d|2[0-3]):([0-5]\d)\b")
            course_re = re.compile(r"\b([A-Z]{2,5}\s?\d{3}[A-Z]?)\b")
            hall_re = re.compile(
                r"\b((?:AUDITORIUM\s*\d+)|(?:BLOCK\s*[A-Z](?:\s*-\s*(?:MAIN|BASEMENT))?)|(?:[FST]F\s*\d{1,2}))\b",
                re.I,
            )

            parsed_rows = []
            current_day = None
            for ln in lines:
                day_m = day_re.search(ln)
                if day_m:
                    current_day = day_m.group(1).lower()

                t_m = time_re.search(ln)
                c_m = course_re.search(ln)
                h_m = hall_re.search(ln)
                if not (current_day and t_m and c_m and h_m):
                    continue

                start_time = f"{int(t_m.group(1)):02d}:{t_m.group(2)}"
                end_time = f"{int(t_m.group(3)):02d}:{t_m.group(4)}"
                course_name = c_m.group(1).replace(" ", "")
                hall_name = re.sub(r"\s+", " ", h_m.group(1).strip()).title()
                hall_name = hall_name.replace("Ff", "FF").replace("Sf", "SF").replace("Tf", "TF")
                parsed_rows.append(
                    {
                        "course_name": course_name,
                        "hall_name": hall_name,
                        "day_of_week": current_day,
                        "start_time": start_time,
                        "end_time": end_time,
                        "semester": semester_default,
                    }
                )

            if not parsed_rows:
                raise CommandError(
                    "Could not parse timetable rows from PDF. Export as selectable-text PDF or use CSV import."
                )

            seen = set()
            deduped = []
            for row in parsed_rows:
                key = (
                    row["course_name"],
                    row["hall_name"],
                    row["day_of_week"],
                    row["start_time"],
                    row["end_time"],
                )
                if key in seen:
                    continue
                seen.add(key)
                deduped.append(row)

            for idx, row in enumerate(deduped, start=1):
                upsert_row(f"pdf-{idx}", row)

        self.stdout.write(self.style.SUCCESS("Fixed timetable import completed."))
        self.stdout.write(f"Created: {created}")
        self.stdout.write(f"Updated: {updated}")
        self.stdout.write(f"Skipped: {skipped}")
