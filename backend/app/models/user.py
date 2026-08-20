from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class User(UUIDMixin, Base):
    """
    Core user account. Every person in the system (patient, doctor, admin)
    has a User record for authentication and identification.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # patient, doctor, hospital_admin
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    wallet_address: Mapped[str | None] = mapped_column(String(42), unique=True, nullable=True, index=True)

    # Relationships — back_populates defined in related models
    patient: Mapped["Patient"] = relationship(back_populates="user", uselist=False)
    doctor: Mapped["Doctor"] = relationship(back_populates="user", uselist=False)
