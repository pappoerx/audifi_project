"""Coverage for API routes not exercised by test_smoke.py."""

from datetime import date, timedelta


def _staff_headers(client):
    r = client.post(
        "/auth/login",
        json={"institutional_id": "87654321", "password": "password123"},
    )
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _student_headers(client):
    r = client.post(
        "/auth/login",
        json={"institutional_id": "12345678", "password": "password123"},
    )
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_login_invalid_401(client):
    r = client.post(
        "/auth/login",
        json={"institutional_id": "12345678", "password": "wrong"},
    )
    assert r.status_code == 401


def test_halls_requires_auth_401(client):
    r = client.get("/halls")
    assert r.status_code == 401


def test_auth_me_and_patch(client):
    h = _student_headers(client)
    r = client.get("/auth/me", headers=h)
    assert r.status_code == 200
    assert r.json()["institutional_id"] == "12345678"
    assert r.json()["role"] == "student"

    r = client.patch(
        "/auth/me",
        headers=h,
        json={
            "display_name": "Patched Student",
            "preferences": {"campus_zone": "North", "compact_cards": True},
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["display_name"] == "Patched Student"
    assert body["preferences"]["campus_zone"] == "North"
    assert body["preferences"]["compact_cards"] is True


def test_meta_courses_and_time_slots(client, seeded_db):
    h = _staff_headers(client)
    r = client.get("/courses", headers=h)
    assert r.status_code == 200
    courses = r.json()
    assert len(courses) == 1
    assert courses[0]["title"] == "TST 101 TEST COURSE"

    r = client.get("/time-slots", headers=h)
    assert r.status_code == 200
    slots = r.json()
    assert len(slots) == 1
    assert "8:00 AM" in slots[0]["label"]


def test_get_hall_by_id(client, seeded_db):
    h = _student_headers(client)
    hid = str(seeded_db["hall"].id)
    r = client.get(f"/halls/{hid}", headers=h)
    assert r.status_code == 200
    assert r.json()["name"] == "Test Hall"
    assert "status" in r.json()


def test_halls_available_now_filter(client, seeded_db):
    h = _student_headers(client)
    r = client.get("/halls?available_now=true", headers=h)
    assert r.status_code == 200
    halls = r.json()
    assert isinstance(halls, list)
    for hall in halls:
        assert hall["status"] == "Available"


def test_staff_analytics(client):
    h = _staff_headers(client)
    r = client.get("/staff/analytics", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert "active_reservations" in data
    assert "today_str" in data
    assert "lecturer_events_7d" in data


def test_staff_analytics_forbidden_for_student(client):
    h = _student_headers(client)
    r = client.get("/staff/analytics", headers=h)
    assert r.status_code == 403


def test_issue_report_student_ok(client):
    h = _student_headers(client)
    r = client.post(
        "/issue-reports",
        headers=h,
        json={
            "category": "app_bug",
            "location": "FF 01",
            "description": "This is at least ten chars for validation.",
            "contact_email": "s@test.edu",
        },
    )
    assert r.status_code == 201
    assert r.json().get("ok") is True


def test_issue_report_forbidden_for_staff(client):
    h = _staff_headers(client)
    r = client.post(
        "/issue-reports",
        headers=h,
        json={
            "category": "other",
            "description": "Staff should not submit via this endpoint.",
        },
    )
    assert r.status_code == 403


def test_student_forbidden_create_booking(client, seeded_db):
    h = _student_headers(client)
    future = (date.today() + timedelta(days=14)).isoformat()
    r = client.post(
        "/bookings",
        headers=h,
        json={
            "hall_id": str(seeded_db["hall"].id),
            "course_id": str(seeded_db["course"].id),
            "booking_date": future,
            "time_slot_id": str(seeded_db["slot"].id),
        },
    )
    assert r.status_code == 403


def test_booking_call_off(client, seeded_db):
    h = _staff_headers(client)
    future = (date.today() + timedelta(days=14)).isoformat()
    body = {
        "hall_id": str(seeded_db["hall"].id),
        "course_id": str(seeded_db["course"].id),
        "booking_date": future,
        "time_slot_id": str(seeded_db["slot"].id),
    }
    r = client.post("/bookings", headers=h, json=body)
    assert r.status_code == 201
    bid = r.json()["id"]

    r = client.post(f"/bookings/{bid}/call-off", headers=h)
    assert r.status_code == 200
    assert r.json()["status"] == "called_off"

    r = client.get("/activity?limit=20", headers=h)
    assert r.status_code == 200
    assert any(a["type"] == "class_called_off" for a in r.json())


def test_booking_check_in_creates_keypad_activity(client, seeded_db):
    h = _staff_headers(client)
    future = (date.today() + timedelta(days=21)).isoformat()
    body = {
        "hall_id": str(seeded_db["hall"].id),
        "course_id": str(seeded_db["course"].id),
        "booking_date": future,
        "time_slot_id": str(seeded_db["slot"].id),
    }
    r = client.post("/bookings", headers=h, json=body)
    assert r.status_code == 201
    bid = r.json()["id"]

    r = client.post(f"/bookings/{bid}/check-in", headers=h)
    assert r.status_code == 200

    r = client.get("/activity?limit=20", headers=h)
    assert r.status_code == 200
    types = [a["type"] for a in r.json()]
    assert "checked_in_keypad" in types
