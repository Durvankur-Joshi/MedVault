from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class MedicalRecord(UUIDMixin, Base):
    """
    Medical record metadata. The actual medical content is encrypted and
    stored off-chain (IPFS or secure storage). This table holds only
    references and integrity hashes — never raw medical data.
    """

    __tablename__ = "medical_records"

    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id"), nullable=False, index=True
    )

    # Record classification
    record_type: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. lab_result, prescription, imaging
    fhir_resource_type: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. Observation, MedicationRequest

    # Off-chain storage reference — points to the encrypted blob
    encrypted_storage_ref: Mapped[str | None] = mapped_column(Text, nullable=True)  # e.g. IPFS CID

    # Integrity — SHA-256 hash of the original record before encryption
    record_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Blockchain reference — identifier of the on-chain commitment
    blockchain_record_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    patient: Mapped["Patient"] = relationship(back_populates="medical_records")
    consents: Mapped[list["Consent"]] = relationship(back_populates="record")
