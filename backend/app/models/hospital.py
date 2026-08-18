from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class Hospital(UUIDMixin, Base):
    """Hospital or healthcare organization."""

    __tablename__ = "hospitals"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    registration_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Relationships
    doctors: Mapped[list["Doctor"]] = relationship(back_populates="hospital")
