import enum
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.activity import Activity
    from app.models.booking import Booking
    from app.models.issue_report import IssueReport


class UserRole(str, enum.Enum):
    student = "student"
    staff = "staff"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    institutional_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(16))
    display_name: Mapped[str] = mapped_column(String(255))
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    program: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preferences: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    bookings: Mapped[list["Booking"]] = relationship(back_populates="lecturer")
    activities: Mapped[list["Activity"]] = relationship(back_populates="lecturer")
    issue_reports: Mapped[list["IssueReport"]] = relationship(back_populates="reporter")
