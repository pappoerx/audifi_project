# AudiFi API

Backend for **AudiFi**: hall discovery, lecturer bookings, activity feed, and student issue reports. Built with **FastAPI**, **SQLAlchemy**, **Alembic**, **JWT** auth, and **PostgreSQL** or **SQLite**.

The browser UI lives in the parent folder (`home_page.html`, `studentpage.html`, `staffpage.html`, `script.js`). This service exposes JSON APIs consumed by that frontend.

---

## What you need

| Requirement | Notes |
|-------------|--------|
| **Python 3.10+** | Used for the API and tooling |
| **PostgreSQL** | Optional; you can use **SQLite** only for local dev (no Docker) |
| **Docker** | Optional; only if you want Postgres via `docker compose` from the repo root |

---

## Quick start (SQLite, no Docker)

Good for trying the stack on one machine without installing Postgres.

1. **Create venv and install dependencies**

   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set at least:

   - `DATABASE_URL=sqlite+pysqlite:///./audifi_local.db`
   - `JWT_SECRET` — use a long random string (not the example value in production)
   - `CORS_ORIGINS` — comma-separated origins where the **frontend** is served (see below)

3. **Create tables and load demo data**

   ```bash
   alembic upgrade head
   PYTHONPATH=. python scripts/seed.py
   ```

   Re-run the seed script only when you want to repopulate reference data and demo users (it skips if data already exists).

4. **Run the API**

   ```bash
   PYTHONPATH=. uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

   - Interactive docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   - Health check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

5. **Run the frontend**

   The UI must be opened over **http://** (not `file://`), or the browser will block API calls.

   From the **repository root** (parent of `backend/`):

   ```bash
   python3 -m http.server 8080 --bind 127.0.0.1
   ```

   Then open [http://127.0.0.1:8080/home_page.html](http://127.0.0.1:8080/home_page.html).

6. **Optional: API + frontend together**

   From the repo root:

   ```bash
   ./start.sh
   ```

   This starts uvicorn (using `backend/.env`) and a static server on port **8080**. Ensure `.env` has a working `DATABASE_URL` and that `CORS_ORIGINS` includes `http://127.0.0.1:8080`.

---

## PostgreSQL (with Docker)

From the **repository root**:

```bash
docker compose up -d
```

In `backend/.env`, use a URL that matches [docker-compose.yml](../docker-compose.yml) (default user/db/password `audifi`):

```env
DATABASE_URL=postgresql+psycopg://audifi:audifi@localhost:5432/audifi
```

Then:

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
PYTHONPATH=. python scripts/seed.py
PYTHONPATH=. uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

---

## Environment variables

Defined in [`.env.example`](.env.example). Pydantic reads them from `.env` in the **current working directory** when you run commands from `backend/`.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLAlchemy URL. Examples: `postgresql+psycopg://user:pass@host:5432/dbname`, `sqlite+pysqlite:///./audifi_local.db` |
| `JWT_SECRET` | Signing key for access tokens — **change in production** |
| `JWT_EXPIRE_MINUTES` | Token lifetime (default 1440 = 24h if set in `.env`; app default may differ) |
| `CORS_ORIGINS` | Comma-separated list of allowed browser origins (no spaces), e.g. `http://127.0.0.1:8080,http://localhost:8080` |
| `TIMEZONE` | Campus timezone for booking/slot logic (default `Africa/Accra`) |
| `SEED_DEMO_PASSWORD` | Password bcrypt-hashed for seeded demo student/staff accounts |

---

## Demo accounts (after `scripts/seed.py`)

| Role | Institutional ID | Password |
|------|------------------|----------|
| Student | `12345678` | Value of `SEED_DEMO_PASSWORD` in `.env` (default `password123`) |
| Staff | `87654321` | Same |

Use **student login** on `home_page.html` and **lecturer login** on `lecturer_login.html`.

---

## Frontend API URL

HTML pages set `window.AUDIFI_API_BASE` (default `http://127.0.0.1:8000`). If the API runs on another host/port, edit the inline script in the HTML files or inject it before `script.js` loads.

---

## Common API routes (reference)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/auth/login` | `institutional_id`, `password` → JWT |
| GET/PATCH | `/auth/me` | Current user; PATCH updates profile/preferences |
| GET | `/courses`, `/time-slots` | Reference lists (authenticated) |
| GET | `/halls`, `/halls/{id}` | Query `q`, `available_now` |
| GET | `/bookings/me` | Staff — active future bookings |
| POST | `/bookings` | Staff — create booking |
| POST | `/bookings/{id}/cancel`, `/call-off`, `/check-in` | Staff |
| GET | `/activity` | Lecturer activity feed |
| GET | `/staff/analytics` | Staff dashboard metrics |
| POST | `/issue-reports` | Student |

Full schemas: **Swagger UI** at `/docs`.

---

## Database migrations

```bash
cd backend
source .venv/bin/activate
alembic revision --autogenerate -m "describe change"   # when you change models
alembic upgrade head
```

Initial schema is in `alembic/versions/`.

---

## Tests

Uses an in-memory SQLite database via `TestClient` (no running server required):

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest tests/ -v
```

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| `Connection refused` to API | Uvicorn running? Correct `--port` and `AUDIFI_API_BASE` in HTML? |
| CORS errors in the browser | `CORS_ORIGINS` must include the **exact** origin (scheme + host + port) of the page |
| `file://` and fetch fails | Serve the site with `python -m http.server` or `./start.sh` |
| Postgres errors | `docker compose ps`, `DATABASE_URL`, firewall, `alembic upgrade head` |
| Login always fails | Run seed after migrate; match password to `SEED_DEMO_PASSWORD` |
| 401 after some time | JWT expired; log in again or raise `JWT_EXPIRE_MINUTES` for dev only |

---

## Security (production)

- Use a strong, unique `JWT_SECRET` and keep `.env` out of git (see [`.gitignore`](.gitignore)).
- Prefer institutional SSO or managed auth instead of long-lived demo passwords.
- Run behind HTTPS and restrict `CORS_ORIGINS` to real app origins.

---

## Project layout

```
backend/
  app/           # FastAPI app, routers, models, services
  alembic/       # migrations
  scripts/       # seed.py
  tests/         # pytest
  requirements.txt
  .env.example
```
