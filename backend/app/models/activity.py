import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    pass


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(32), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    lecturer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    hall_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("halls.id", ondelete="CASCADE"))
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    booking_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    time_slot_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("time_slots.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    lecturer = relationship("User", back_populates="activities")
    hall = relationship("Hall", back_populates="activities")
    course = relationship("Course", back_populates="activities")
    time_slot = relationship("TimeSlot", back_populates="activities")
