from sqlalchemy.orm import Session

from app.models.medical_record import MedicalRecord


def create(
    db: Session,
    *,
    patient_id: str,
    record_type: str,
    fhir_resource_type: str | None = None,
) -> MedicalRecord:
    """Create a new medical record metadata entry."""
    record = MedicalRecord(
        patient_id=patient_id,
        record_type=record_type,
        fhir_resource_type=fhir_resource_type,
    )
    db.add(record)
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
