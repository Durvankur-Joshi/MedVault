from typing import Optional
from sqlalchemy.orm import Session

from app.models.medical_record import MedicalRecord


def create(
    db: Session,
    *,
    patient_id: str,
    record_type: str,
    fhir_resource_type: Optional[str] = None,
    encrypted_storage_ref: Optional[str] = None,
    record_hash: Optional[str] = None,
    created_by_user_id: Optional[str] = None,
    storage_provider: Optional[str] = "local",
    encryption_version: Optional[str] = "aes-256-gcm-v1",
    blockchain_record_id: Optional[str] = None,
    blockchain_network: Optional[str] = None,
    blockchain_contract_address: Optional[str] = None,
    blockchain_tx_hash: Optional[str] = None,
    blockchain_anchored_at: Optional[str] = None,
    original_document_filename: Optional[str] = None,
    original_document_mime_type: Optional[str] = None,
    original_document_hash: Optional[str] = None,
    original_document_ref: Optional[str] = None,
) -> MedicalRecord:
    """Create a new medical record metadata entry."""
    record = MedicalRecord(
        patient_id=patient_id,
        record_type=record_type,
        fhir_resource_type=fhir_resource_type,
        encrypted_storage_ref=encrypted_storage_ref,
        record_hash=record_hash,
        created_by_user_id=created_by_user_id,
        storage_provider=storage_provider,
        encryption_version=encryption_version,
        blockchain_record_id=blockchain_record_id,
        blockchain_network=blockchain_network,
        blockchain_contract_address=blockchain_contract_address,
        blockchain_tx_hash=blockchain_tx_hash,
        blockchain_anchored_at=blockchain_anchored_at,
        original_document_filename=original_document_filename,
        original_document_mime_type=original_document_mime_type,
        original_document_hash=original_document_hash,
        original_document_ref=original_document_ref,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_blockchain_anchor(
    db: Session,
    record_id: str,
    *,
    blockchain_record_id: str,
    blockchain_network: str,
    blockchain_contract_address: str,
    blockchain_tx_hash: str,
    blockchain_anchored_at: str,
) -> MedicalRecord | None:
    """Update medical record with blockchain anchoring metadata."""
    record = get_by_id(db, record_id)
    if record is None:
        return None
    record.blockchain_record_id = blockchain_record_id
    record.blockchain_network = blockchain_network
    record.blockchain_contract_address = blockchain_contract_address
    record.blockchain_tx_hash = blockchain_tx_hash
    record.blockchain_anchored_at = blockchain_anchored_at
    db.commit()
    db.refresh(record)
    return record


def get_by_id(db: Session, record_id: str) -> MedicalRecord | None:
    """Get a medical record by its ID."""
    return db.query(MedicalRecord).filter(MedicalRecord.id == record_id).first()


def list_by_patient(db: Session, patient_id: str) -> list[MedicalRecord]:
    """List all medical records for a given patient."""
    return (
        db.query(MedicalRecord)
        .filter(MedicalRecord.patient_id == patient_id)
        .order_by(MedicalRecord.created_at.desc())
        .all()
    )


def delete(db: Session, record_id: str) -> bool:
    """Delete a medical record by ID. Returns True if deleted."""
    record = db.query(MedicalRecord).filter(MedicalRecord.id == record_id).first()
    if record is None:
        return False
    db.delete(record)
    db.commit()
    return True
