from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class Doctor(UUIDMixin, Base):
    """Doctor profile linked to a User account and optionally a Hospital."""

    __tablename__ = "doctors"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), unique=True, nullable=False
    )
    hospital_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("hospitals.id"), nullable=True
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    specialization: Mapped[str | None] = mapped_column(String(255), nullable=True)
    license_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="doctor")
    hospital: Mapped["Hospital | None"] = relationship(back_populates="doctors")
