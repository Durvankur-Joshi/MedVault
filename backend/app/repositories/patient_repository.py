from sqlalchemy.orm import Session

from app.models.patient import Patient


def get_by_id(db: Session, patient_id: str) -> Patient | None:
    """Get a patient profile by its primary key ID."""
    return db.query(Patient).filter(Patient.id == patient_id).first()


def get_by_user_id(db: Session, user_id: str) -> Patient | None:
    """Get a patient profile by user ID."""
    return db.query(Patient).filter(Patient.user_id == user_id).first()


def create(db: Session, *, user_id: str, display_name: str) -> Patient:
    """Create a new patient profile."""
    patient = Patient(user_id=user_id, display_name=display_name)
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient
