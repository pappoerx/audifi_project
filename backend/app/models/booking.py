import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    pass


class BookingStatus(str, enum.Enum):
    active = "active"
    cancelled = "cancelled"
    called_off = "called_off"


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hall_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("halls.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    lecturer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    booking_date: Mapped[date] = mapped_column(Date, index=True)
    time_slot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("time_slots.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(32), default=BookingStatus.active.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    hall = relationship("Hall", back_populates="bookings")
    course = relationship("Course", back_populates="bookings")
    lecturer = relationship("User", back_populates="bookings")
    time_slot = relationship("TimeSlot", back_populates="bookings")
    check_in = relationship("BookingCheckIn", back_populates="booking", uselist=False)


class BookingCheckIn(Base):
    __tablename__ = "booking_check_ins"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), unique=True, index=True
    )
    checked_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    booking = relationship("Booking", back_populates="check_in")
