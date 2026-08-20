"""
Patient API routes — secure patient search and record metadata for doctor-side UX.

Security:
- All endpoints require JWT authentication.
- RBAC restricts access to doctor and hospital_admin roles.
- Patient search returns ONLY id + display_name (zero PII).
- Record listing returns ONLY non-sensitive metadata (no decryption, no keys).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.schemas.patient import PatientRecordSummary, PatientSearchResult
from app.services import patient_service

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get(
    "/search",
    response_model=list[PatientSearchResult],
    dependencies=[Depends(require_role("doctor", "hospital_admin"))],
)
def search_patients(
    q: Annotated[str, Query(min_length=2, max_length=200, description="Patient name search query")],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[PatientSearchResult]:
    """
    Search patients by display name. Returns minimal non-PII results.
    Requires doctor or hospital_admin role.
    """
    patients = patient_service.search_patients(
        db, current_user=current_user, query=q, limit=limit,
    )
    return [PatientSearchResult.model_validate(p) for p in patients]


@router.get(
    "/{patient_id}/records",
    response_model=list[PatientRecordSummary],
    dependencies=[Depends(require_role("doctor", "hospital_admin"))],
)
def get_patient_records(
    patient_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[PatientRecordSummary]:
    """
    List non-sensitive record metadata for a patient.
    Does NOT decrypt records or expose storage paths.
    Requires doctor or hospital_admin role.
    """
    records = patient_service.get_patient_record_summaries(
        db, current_user=current_user, patient_id=patient_id,
    )
    return [PatientRecordSummary.model_validate(r) for r in records]
