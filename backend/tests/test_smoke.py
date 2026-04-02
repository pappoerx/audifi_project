from datetime import date, timedelta


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_login_student(client, seeded_db):
    r = client.post(
        "/auth/login",
        json={"institutional_id": "12345678", "password": "password123"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["user"]["role"] == "student"


def test_login_staff(client, seeded_db):
    r = client.post(
        "/auth/login",
        json={"institutional_id": "87654321", "password": "password123"},
    )
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "staff"


def test_halls_and_booking_flow(client, seeded_db):
    login = client.post(
        "/auth/login",
        json={"institutional_id": "87654321", "password": "password123"},
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = client.get("/halls", headers=headers)
    assert r.status_code == 200
    halls = r.json()
    assert len(halls) == 1
    assert halls[0]["name"] == "Test Hall"

    hall_id = str(seeded_db["hall"].id)
    course_id = str(seeded_db["course"].id)
    slot_id = str(seeded_db["slot"].id)
    future = (date.today() + timedelta(days=7)).isoformat()

    r = client.post(
        "/bookings",
        headers=headers,
        json={
            "hall_id": hall_id,
            "course_id": course_id,
            "booking_date": future,
            "time_slot_id": slot_id,
        },
    )
    assert r.status_code == 201, r.text

    r = client.get("/activity?limit=5", headers=headers)
    assert r.status_code == 200
    assert any(a["type"] == "booked" for a in r.json())

    r = client.get("/bookings/me", headers=headers)
    assert r.status_code == 200
    bid = r.json()[0]["id"]

    r = client.post(f"/bookings/{bid}/cancel", headers=headers)
    assert r.status_code == 200
