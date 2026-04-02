from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class BookingCreate(BaseModel):
    hall_id: UUID
    course_id: UUID
    booking_date: date
    time_slot_id: UUID


class BookingOut(BaseModel):
    id: UUID
    hall_id: UUID
    hall_name: str
    course_id: UUID
    course_title: str
    booking_date: date
    time_slot_id: UUID
    time_slot_label: str
    status: str

    model_config = {"from_attributes": True}
