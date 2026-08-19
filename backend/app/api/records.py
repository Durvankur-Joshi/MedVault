from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.schemas.medical_record import MedicalRecordCreate, MedicalRecordResponse
from app.services import medical_record_service

router = APIRouter(prefix="/api/records", tags=["medical records"])


@router.post(
    "",
    response_model=MedicalRecordResponse,
    status_code=201,
    dependencies=[Depends(require_role("patient"))],
)
def create_record(
    data: MedicalRecordCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MedicalRecordResponse:
    """Create a medical record metadata entry. Patient only."""
    record = medical_record_service.create_record(
        db,
        current_user=current_user,
        record_type=data.record_type,
        fhir_resource_type=data.fhir_resource_type,
    )
    return MedicalRecordResponse.model_validate(record)


@router.get("", response_model=list[MedicalRecordResponse])
def list_records(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[MedicalRecordResponse]:
    """List medical records for the current user (own records or consented)."""
    records = medical_record_service.list_records(db, current_user=current_user)
    return [MedicalRecordResponse.model_validate(r) for r in records]


@router.get("/{record_id}", response_model=MedicalRecordResponse)
def get_record(
    record_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MedicalRecordResponse:
    """Get a single medical record with authorization check."""
    record = medical_record_service.get_record(
        db, current_user=current_user, record_id=record_id
    )
    return MedicalRecordResponse.model_validate(record)


@router.delete(
    "/{record_id}",
    status_code=204,
    dependencies=[Depends(require_role("patient"))],
)
def delete_record(
    record_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Delete a medical record. Only the owning patient can delete."""
    medical_record_service.delete_record(
        db, current_user=current_user, record_id=record_id
    )
