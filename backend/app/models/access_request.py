from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class AccessRequest(UUIDMixin, Base):
    """
    A request from a doctor or hospital to access a patient's medical record.
    The patient must approve or deny the request, which then creates a Consent.
    """

    __tablename__ = "access_requests"

    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id"), nullable=False, index=True
    )
    requester_doctor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("doctors.id"), nullable=True
    )
    requester_hospital_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("hospitals.id"), nullable=True
    )
    record_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("medical_records.id"), nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending"
    )  # pending, approved, denied
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    patient: Mapped["Patient"] = relationship(
        back_populates="access_requests", foreign_keys=[patient_id]
    )
