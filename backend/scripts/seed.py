"""Load reference data and demo users. Run from backend/: PYTHONPATH=. python scripts/seed.py"""

import os
import sys
import uuid
from datetime import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.db import SessionLocal
from app.models.course import Course
from app.models.hall import Hall
from app.models.time_slot import TimeSlot
from app.models.user import User, UserRole
from app.security import hash_password

ZONES = [
    "Commercial Area",
    "Engineering Strip",
    "Business School Wing",
    "North Academic Block",
    "Central Walkway",
]

COURSE_ROWS = [
    ("AI 150", "AI 150 FUNDAMENTALS OF RESPONSIBLE AI FOR ALL"),
    ("BSBA 351", "BSBA 351 BUSINESS LAW"),
    ("BSBA 353", "BSBA 353 BUSINESS RESEARCH METHODS"),
    ("BSBA 361", "BSBA 361 BUILDING PROFESSIONAL SKILLS"),
    ("ISD 331", "ISD 331 INTRODUCTION TO BUSINESS ANALYTICS"),
    ("ISD 355", "ISD 355 DATABASE MANAGEMENT FOR BUSINESS"),
    ("ISD 357", "ISD 357 INTRODUCTION TO OPERATIONS MANAGEMENT"),
    ("ISD 359", "ISD 359 INTRODUCTION TO PROGRAMMING"),
]

TIME_SLOT_ROWS = [
    ("8:00 AM – 10:00 AM", time(8, 0), time(10, 0)),
    ("10:30 AM – 12:30 PM", time(10, 30), time(12, 30)),
    ("1:00 PM – 3:00 PM", time(13, 0), time(15, 0)),
    ("3:30 PM – 5:30 PM", time(15, 30), time(17, 30)),
]


def seed_halls(db) -> None:
    if db.query(Hall).first():
        return
    halls: list[Hall] = []
    blocks = list("ABCDEF")
    for i, block in enumerate(blocks):
        for level in ("Main", "Basement"):
            code = f"block-{block}-{level.lower()}"
            name = f"Block {block} - {level}"
            cap = 400 + i * 20
            zone = ZONES[i % len(ZONES)]
            halls.append(
                Hall(
                    id=uuid.uuid4(),
                    code=code,
                    name=name,
                    capacity=cap,
                    campus_zone=zone,
                    has_wifi=True,
                    has_projector=True,
                    has_ac=level == "Main",
                )
            )
    for prefix, floor_label in (("FF", "First Floor"), ("SF", "Second Floor"), ("TF", "Third Floor")):
        for i in range(1, 6):
            code = f"{prefix}-{str(i).zfill(2)}"
            name = f"{prefix} {str(i).zfill(2)}"
            cap = 120 + i * 10
            zi = (blocks.index("A") + i + ord(prefix[0])) % len(ZONES)
            halls.append(
                Hall(
                    id=uuid.uuid4(),
                    code=code,
                    name=name,
                    capacity=cap,
                    campus_zone=ZONES[zi],
                    has_wifi=True,
                    has_projector=i % 3 != 0,
                    has_ac=True,
                )
            )
    db.add_all(halls)


def seed_courses(db) -> None:
    if db.query(Course).first():
        return
    rows = [
        Course(id=uuid.uuid4(), code=c, title=t) for c, t in COURSE_ROWS
    ]
    db.add_all(rows)


def seed_time_slots(db) -> None:
    if db.query(TimeSlot).first():
        return
    rows = [
        TimeSlot(id=uuid.uuid4(), label=label, start_time=st, end_time=et)
        for label, st, et in TIME_SLOT_ROWS
    ]
    db.add_all(rows)


def seed_users(db) -> None:
    if db.query(User).filter(User.institutional_id == "12345678").first():
        return
    pw = settings.seed_demo_password
    db.add_all(
        [
            User(
                id=uuid.uuid4(),
                institutional_id="12345678",
                password_hash=hash_password(pw),
                role=UserRole.student.value,
                display_name="Kwame Mensah",
                department=None,
                program="BSc Information Systems",
                preferences=None,
            ),
            User(
                id=uuid.uuid4(),
                institutional_id="87654321",
                password_hash=hash_password(pw),
                role=UserRole.staff.value,
                display_name="Dr. John Doe",
                department="Department of Computer Science",
                program=None,
                preferences=None,
            ),
        ]
    )


def main() -> None:
    db = SessionLocal()
    try:
        seed_halls(db)
        seed_courses(db)
        seed_time_slots(db)
        seed_users(db)
        db.commit()
        print("Seed complete. Demo login: student 12345678 / staff 87654321, password from SEED_DEMO_PASSWORD")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
