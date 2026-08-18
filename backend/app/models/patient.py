from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class Patient(UUIDMixin, Base):
    """
    Patient profile linked to a User account.
    Medical details are stored encrypted off-chain — this table holds
    only references and non-sensitive metadata.
    """

    __tablename__ = "patients"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), unique=True, nullable=False
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="patient")
    medical_records: Mapped[list["MedicalRecord"]] = relationship(back_populates="patient")
    consents: Mapped[list["Consent"]] = relationship(back_populates="patient")
    access_requests: Mapped[list["AccessRequest"]] = relationship(
        back_populates="patient", foreign_keys="AccessRequest.patient_id"
    )
