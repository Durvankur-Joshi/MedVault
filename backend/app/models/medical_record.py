from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class MedicalRecord(UUIDMixin, Base):
    """
    Medical record metadata. The actual medical content is encrypted using AES-256-GCM
    and stored off-chain (local encrypted storage or IPFS). This table holds only
    references, encryption version, and integrity hashes — never raw medical data.
    """

    __tablename__ = "medical_records"

    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id"), nullable=False, index=True
    )

    created_by_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True, index=True
    )

    # Record classification
    record_type: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. observation, condition, medication_request, encounter
    fhir_resource_type: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. Observation, Condition, MedicationRequest

    # Off-chain storage reference — points to the encrypted blob (e.g. local://<id>.enc or ipfs://<CID>)
    encrypted_storage_ref: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Storage provider used (e.g. 'local', 'ipfs')
    storage_provider: Mapped[str | None] = mapped_column(String(50), default="local", nullable=True)

    # Encryption version used (e.g. 'aes-256-gcm-v1')
    encryption_version: Mapped[str | None] = mapped_column(String(20), default="aes-256-gcm-v1", nullable=True)

    # Integrity — SHA-256 hash of the canonical FHIR document before encryption
    record_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Blockchain reference — identifier of the on-chain commitment in Phase 4
    blockchain_record_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    patient: Mapped["Patient"] = relationship(back_populates="medical_records")
    consents: Mapped[list["Consent"]] = relationship(back_populates="record")
