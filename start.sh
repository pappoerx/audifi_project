#!/usr/bin/env bash
# Start AudiFi backend (FastAPI) and frontend static server together.
# No Docker: use SQLite in backend/.env, e.g.
#   DATABASE_URL=sqlite+pysqlite:///./audifi_local.db
# Then: cd backend && alembic upgrade head && PYTHONPATH=. python scripts/seed.py
#
# Usage: ./start.sh   (from repo root; chmod +x start.sh once)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
API_PORT="${API_PORT:-8000}"
API_HOST="${API_HOST:-127.0.0.1}"

if [[ ! -d "$BACKEND" ]]; then
  echo "Expected backend at $BACKEND" >&2
  exit 1
fi

if [[ -f "$BACKEND/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$BACKEND/.venv/bin/activate"
fi

cleanup() {
  if [[ -n "${UVICORN_PID:-}" ]]; then
    kill "$UVICORN_PID" 2>/dev/null || true
  fi
  if [[ -n "${HTTP_PID:-}" ]]; then
    kill "$HTTP_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting API on http://${API_HOST}:${API_PORT} (cwd: backend, loads backend/.env if present)"
(
  cd "$BACKEND"
  export PYTHONPATH=.
  exec uvicorn app.main:app --reload --host "$API_HOST" --port "$API_PORT"
) &
UVICORN_PID=$!

echo "Starting frontend on http://${API_HOST}:${FRONTEND_PORT} (repo root)"
(
  cd "$ROOT"
  exec python3 -m http.server "$FRONTEND_PORT" --bind "$API_HOST"
) &
HTTP_PID=$!

echo ""
echo "Open: http://${API_HOST}:${FRONTEND_PORT}/home_page.html"
echo "API docs: http://${API_HOST}:${API_PORT}/docs"
echo "Press Ctrl+C to stop both."
echo ""

wait
