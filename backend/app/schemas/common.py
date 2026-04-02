from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CourseOut(BaseModel):
    id: UUID
    code: str
    title: str

    model_config = {"from_attributes": True}


class TimeSlotOut(BaseModel):
    id: UUID
    label: str

    model_config = {"from_attributes": True}


class HallOut(BaseModel):
    id: UUID
    code: str
    name: str
    capacity: int
    campus_zone: str
    has_wifi: bool
    has_projector: bool
    has_ac: bool
    status: str
    live: bool
    current_or_next_event: str

    model_config = {"from_attributes": True}


class ActivityOut(BaseModel):
    id: UUID
    type: str
    at: datetime
    lecturer_name: str
    auditorium: str
    course: str
    date: str | None
    time: str | None
    note: str | None


class IssueReportCreate(BaseModel):
    category: str = Field(min_length=1, max_length=64)
    location: str | None = Field(None, max_length=255)
    description: str = Field(min_length=10, max_length=2000)
    contact_email: str | None = Field(None, max_length=255)
