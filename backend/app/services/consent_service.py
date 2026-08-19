from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.consent import Consent
from app.models.user import User
from app.repositories import (
    consent_repository,
    doctor_repository,
    hospital_repository,
    medical_record_repository,
    patient_repository,
)
from app.services import audit_service

VALID_PERMISSIONS = {"read", "write", "full"}


def grant_consent(
    db: Session,
    *,
    current_user: User,
    record_id: str,
    permission: str,
    grantee_doctor_id: str | None = None,
    grantee_hospital_id: str | None = None,
    expires_at: datetime | None = None,
) -> Consent:
    """
    Grant consent for a specific record.
    Only the patient who owns the record can grant consent.
    Exactly one grantee (doctor OR hospital) must be specified.
    """
    if current_user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can grant consent",
        )

    if permission not in VALID_PERMISSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permission. Must be one of: {', '.join(sorted(VALID_PERMISSIONS))}",
        )

    # Exactly one grantee
    if grantee_doctor_id and grantee_hospital_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Specify either grantee_doctor_id or grantee_hospital_id, not both",
        )
    if not grantee_doctor_id and not grantee_hospital_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one grantee (doctor or hospital) must be specified",
        )

    # Verify the patient owns this record
    patient = patient_repository.get_by_user_id(db, current_user.id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )

    record = medical_record_repository.get_by_id(db, record_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found",
        )
    if record.patient_id != patient.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only grant consent for your own records",
        )

    # Validate grantee exists
    if grantee_doctor_id:
        doctor = doctor_repository.get_by_user_id(db, grantee_doctor_id)
        # Try by doctor ID directly if not found by user_id
        if doctor is None:
            from app.models.doctor import Doctor

            doctor = db.query(Doctor).filter(Doctor.id == grantee_doctor_id).first()
        if doctor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Grantee doctor not found",
            )

    if grantee_hospital_id:
        hospital = hospital_repository.get_by_id(db, grantee_hospital_id)
        if hospital is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Grantee hospital not found",
            )

    consent = consent_repository.create(
        db,
        patient_id=patient.id,
        record_id=record_id,
        permission=permission,
        grantee_doctor_id=grantee_doctor_id,
        grantee_hospital_id=grantee_hospital_id,
        expires_at=expires_at,
    )

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="consent.granted",
        resource_type="consent",
        resource_id=consent.id,
        details=f"record_id={record_id}, permission={permission}",
    )

    return consent


def list_consents(db: Session, *, current_user: User) -> list[Consent]:
    """
    List consents.
    - Patient: sees consents for their own records.
    - Doctor/Hospital: would see consents granted to them (future enhancement).
    """
    if current_user.role == "patient":
        patient = patient_repository.get_by_user_id(db, current_user.id)
        if patient is None:
            return []
        return consent_repository.list_for_patient(db, patient.id)

    return []


def get_consent(db: Session, *, current_user: User, consent_id: str) -> Consent:
    """Get a single consent with authorization check."""
    consent = consent_repository.get_by_id(db, consent_id)
    if consent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consent not found",
        )

    # Patient who owns the record can view
    if current_user.role == "patient":
        patient = patient_repository.get_by_user_id(db, current_user.id)
        if patient is None or consent.patient_id != patient.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this consent",
            )
        return consent

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this consent",
    )


def revoke_consent(db: Session, *, current_user: User, consent_id: str) -> Consent:
    """
    Revoke a consent. Only the patient who granted it can revoke.
    Sets status to 'revoked' — does not delete the record.
    """
    consent = consent_repository.get_by_id(db, consent_id)
    if consent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consent not found",
        )

    if current_user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can revoke consent",
        )

    patient = patient_repository.get_by_user_id(db, current_user.id)
    if patient is None or consent.patient_id != patient.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only revoke your own consent entries",
        )

    if consent.status == "revoked":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent is already revoked",
        )

    revoked = consent_repository.revoke(db, consent_id)

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="consent.revoked",
        resource_type="consent",
        resource_id=consent_id,
    )

    return revoked
