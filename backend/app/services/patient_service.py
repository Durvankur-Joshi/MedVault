"""
Patient service — patient search, doctor search, and record metadata retrieval.

Security:
- Patient search returns ONLY id and display_name (zero PII).
- Doctor search returns public credentials (display_name, specialization, license_number, hospital, wallet).
- Record listing returns ONLY non-sensitive metadata (no decryption, no keys, no storage paths).
- Searching and listing do NOT grant access or modify consent state.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.hospital import Hospital
from app.models.user import User
from app.repositories import medical_record_repository, patient_repository
from app.services import audit_service


def search_patients(
    db: Session,
    *,
    current_user: User,
    query: str,
    limit: int = 20,
):
    """
    Search patients by display_name (case-insensitive substring match).
    Restricted to doctor and hospital_admin roles.
    """
    if current_user.role not in ("doctor", "hospital_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    # Validate search query
    cleaned = query.strip()
    if len(cleaned) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query must be at least 2 characters",
        )

    capped_limit = min(max(limit, 1), 50)

    results = patient_repository.search_by_name(db, cleaned, limit=capped_limit)

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="PATIENT_SEARCHED",
        resource_type="patient",
        resource_id=current_user.id,
        details=f"query_length={len(cleaned)}",
    )

    return results


def search_doctors(
    db: Session,
    *,
    current_user: User,
    query: str,
    limit: int = 20,
):
    """
    Search licensed doctors by display_name, specialization, or license number.
    Accessible to authenticated patients and users.
    Returns safe, public doctor profile info for consent selection.
    """
    cleaned = query.strip()
    if len(cleaned) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query must be at least 2 characters",
        )

    capped_limit = min(max(limit, 1), 50)
    pattern = f"%{cleaned}%"

    doctors = (
        db.query(Doctor)
        .filter(
            (Doctor.display_name.ilike(pattern))
            | (Doctor.specialization.ilike(pattern))
            | (Doctor.license_number.ilike(pattern))
        )
        .limit(capped_limit)
        .all()
    )

    results = []
    for d in doctors:
        hospital_name = d.hospital.name if d.hospital else None
        wallet_address = d.user.wallet_address if d.user else None
        results.append({
            "id": d.id,
            "user_id": d.user_id,
            "display_name": d.display_name,
            "specialization": d.specialization or "General Practice",
            "license_number": d.license_number,
            "hospital_name": hospital_name,
            "wallet_address": wallet_address,
        })

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="DOCTOR_SEARCHED",
        resource_type="doctor",
        resource_id=current_user.id,
        details=f"query={cleaned[:20]}",
    )

    return results


def get_patient_record_summaries(
    db: Session,
    *,
    current_user: User,
    patient_id: str,
):
    """
    Return non-sensitive record metadata for a given patient.
    Restricted to doctor and hospital_admin roles.
    Does NOT decrypt records, expose storage paths, or modify consent state.
    """
    if current_user.role not in ("doctor", "hospital_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    patient = patient_repository.get_by_id(db, patient_id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    records = medical_record_repository.list_by_patient(db, patient_id)

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="PATIENT_RECORDS_LISTED",
        resource_type="patient",
        resource_id=patient_id,
        details=f"record_count={len(records)}",
    )

    return records
