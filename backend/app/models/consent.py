from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class Consent(UUIDMixin, Base):
    """
    Consent record representing a patient's permission for a doctor or
    hospital to access a specific medical record. Consent state will
    eventually be mirrored on-chain via smart contracts.
    """

    __tablename__ = "consents"

    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id"), nullable=False, index=True
    )
    record_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("medical_records.id"), nullable=False, index=True
    )

    # Who is granted access — either a doctor or a hospital
    grantee_doctor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("doctors.id"), nullable=True
    )
    grantee_hospital_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("hospitals.id"), nullable=True
    )

    # Consent details
    permission: Mapped[str] = mapped_column(String(50), nullable=False)  # read, write, full
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")  # active, revoked, expired
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Blockchain reference
    blockchain_consent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    patient: Mapped["Patient"] = relationship(back_populates="consents")
    record: Mapped["MedicalRecord"] = relationship(back_populates="consents")
