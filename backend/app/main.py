from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import activity, auth, bookings, halls, issue_reports, meta, staff

app = FastAPI(title="AudiFi API", version="1.0.0")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(meta.router)
app.include_router(halls.router)
app.include_router(bookings.router)
app.include_router(activity.router)
app.include_router(issue_reports.router)
app.include_router(staff.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
