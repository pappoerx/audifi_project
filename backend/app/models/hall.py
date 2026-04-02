import uuid

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Hall(Base):
    __tablename__ = "halls"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    capacity: Mapped[int] = mapped_column(Integer)
    campus_zone: Mapped[str] = mapped_column(String(128))
    has_wifi: Mapped[bool] = mapped_column(Boolean, default=True)
    has_projector: Mapped[bool] = mapped_column(Boolean, default=True)
    has_ac: Mapped[bool] = mapped_column(Boolean, default=True)

    bookings = relationship("Booking", back_populates="hall")
    activities = relationship("Activity", back_populates="hall")
