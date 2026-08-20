"""
Patient service — patient search and record metadata retrieval for doctors.

Security:
- Patient search returns ONLY id and display_name (zero PII).
- Record listing returns ONLY non-sensitive metadata (no decryption, no keys, no storage paths).
- Searching and listing do NOT grant access or modify consent state.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

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
        action="patient.searched",
        resource_type="patient",
        resource_id=current_user.id,
        details=f"query_length={len(cleaned)}",
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
        action="patient.records_listed",
        resource_type="patient",
        resource_id=patient_id,
        details=f"record_count={len(records)}",
    )

    return records
