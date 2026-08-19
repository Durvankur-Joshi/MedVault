from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.medical_record import MedicalRecord
from app.models.patient import Patient
from app.models.user import User
from app.repositories import (
    consent_repository,
    doctor_repository,
    medical_record_repository,
    patient_repository,
)
from app.services import audit_service


def create_record(
    db: Session,
    *,
    current_user: User,
    record_type: str,
    fhir_resource_type: str | None = None,
) -> MedicalRecord:
    """
    Create a medical record metadata entry.
    Only patients can create records for themselves.
    """
    if current_user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can create medical records",
        )

    patient = patient_repository.get_by_user_id(db, current_user.id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )

    record = medical_record_repository.create(
        db,
        patient_id=patient.id,
        record_type=record_type,
        fhir_resource_type=fhir_resource_type,
    )

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="record.created",
        resource_type="medical_record",
        resource_id=record.id,
        details=f"record_type={record_type}",
    )

    return record


def list_records(db: Session, *, current_user: User) -> list[MedicalRecord]:
    """
    List medical records.
    - Patient: sees own records.
    - Doctor: sees records with active consent granted to them.
    """
    if current_user.role == "patient":
        patient = patient_repository.get_by_user_id(db, current_user.id)
        if patient is None:
            return []
        return medical_record_repository.list_by_patient(db, patient.id)

    elif current_user.role == "doctor":
        doctor = doctor_repository.get_by_user_id(db, current_user.id)
        if doctor is None:
            return []
        # Get records where doctor has active consent
        all_patients = db.query(Patient).all()
        results = []
        for pat in all_patients:
            records = medical_record_repository.list_by_patient(db, pat.id)
            for rec in records:
                consent = consent_repository.find_active_consent(
                    db, record_id=rec.id, grantee_doctor_id=doctor.id
                )
                if consent is not None:
                    results.append(rec)
        return results

    return []


def get_record(db: Session, *, current_user: User, record_id: str) -> MedicalRecord:
    """
    Get a single medical record with authorization check.
    - Patient: can only access own records.
    - Doctor: can access if active consent exists.
    """
    record = medical_record_repository.get_by_id(db, record_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found",
        )

    if current_user.role == "patient":
        patient = patient_repository.get_by_user_id(db, current_user.id)
        if patient is None or record.patient_id != patient.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this record",
            )
        return record

    elif current_user.role == "doctor":
        doctor = doctor_repository.get_by_user_id(db, current_user.id)
        if doctor is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Doctor profile not found",
            )
        consent = consent_repository.find_active_consent(
            db, record_id=record.id, grantee_doctor_id=doctor.id
        )
        if consent is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No active consent for this record",
            )
        return record

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this record",
    )


def delete_record(db: Session, *, current_user: User, record_id: str) -> None:
    """
    Delete a medical record. Only the owning patient can delete.
    """
    record = medical_record_repository.get_by_id(db, record_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found",
        )

    if current_user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can delete their own records",
        )

    patient = patient_repository.get_by_user_id(db, current_user.id)
    if patient is None or record.patient_id != patient.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own records",
        )

    medical_record_repository.delete(db, record_id)

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="record.deleted",
        resource_type="medical_record",
        resource_id=record_id,
    )
