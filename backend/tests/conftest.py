import uuid
from datetime import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import Activity, Booking, BookingCheckIn, Course, Hall, IssueReport, TimeSlot
from app.models.user import User, UserRole
from app.security import hash_password


def _seed(session):
    session.add_all(
        [
            User(
                id=uuid.uuid4(),
                institutional_id="12345678",
                password_hash=hash_password("password123"),
                role=UserRole.student.value,
                display_name="Test Student",
                department=None,
                program="BSc Test",
                preferences=None,
            ),
            User(
                id=uuid.uuid4(),
                institutional_id="87654321",
                password_hash=hash_password("password123"),
                role=UserRole.staff.value,
                display_name="Test Staff",
                department="Dept",
                program=None,
                preferences=None,
            ),
        ]
    )
    session.add_all(
        [
            Hall(
                id=uuid.uuid4(),
                code="test-hall",
                name="Test Hall",
                capacity=100,
                campus_zone="Zone A",
                has_wifi=True,
                has_projector=True,
                has_ac=True,
            ),
            Course(id=uuid.uuid4(), code="TST", title="TST 101 TEST COURSE"),
            TimeSlot(
                id=uuid.uuid4(),
                label="8:00 AM – 10:00 AM",
                start_time=time(8, 0),
                end_time=time(10, 0),
            ),
        ]
    )
    session.commit()


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    _seed(session)
    yield session
    session.close()


@pytest.fixture
def client(db_session):
    def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def seeded_db(db_session):
    hall = db_session.query(Hall).one()
    course = db_session.query(Course).one()
    slot = db_session.query(TimeSlot).one()
    return {"hall": hall, "course": course, "slot": slot}
