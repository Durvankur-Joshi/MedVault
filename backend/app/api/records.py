from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.medical_record import (
    IntegrityVerifyResponse,
    MedicalRecordCreate,
    MedicalRecordDetailResponse,
    MedicalRecordResponse,
)
from app.services import medical_record_service

router = APIRouter(prefix="/api/records", tags=["medical records"])


@router.post(
    "",
    response_model=MedicalRecordResponse,
    status_code=201,
)
def create_record(
    data: MedicalRecordCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MedicalRecordResponse:
    """
    Create a privacy-preserving medical record.
    - Patient: creates record for self.
    - Doctor: creates record for specified patient.
    The payload is validated against FHIR R4, canonicalized, hashed with SHA-256,
    encrypted with AES-256-GCM, and stored off-chain.
    Only safe metadata is stored in PostgreSQL and returned here.
    """
    record = medical_record_service.create_record(
        db,
        current_user=current_user,
        data=data,
    )
    return MedicalRecordResponse.model_validate(record)


@router.get("", response_model=list[MedicalRecordResponse])
def list_records(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[MedicalRecordResponse]:
    """
    List medical records metadata.
    - Patient: lists own records.
    - Doctor: lists records where active consent is granted.
    """
    records = medical_record_service.list_records(db, current_user=current_user)
    return [MedicalRecordResponse.model_validate(r) for r in records]


@router.get("/{record_id}", response_model=MedicalRecordResponse)
def get_record_metadata(
    record_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MedicalRecordResponse:
    """Get metadata for a single medical record with authorization check."""
    record = medical_record_service.get_record(
        db, current_user=current_user, record_id=record_id
    )
    return MedicalRecordResponse.model_validate(record)


@router.get("/{record_id}/decrypted", response_model=MedicalRecordDetailResponse)
def get_record_decrypted(
    record_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MedicalRecordDetailResponse:
    """
    Retrieve and decrypt a medical record with cryptographic integrity verification.
    Requires patient ownership or active doctor consent.
    """
    return medical_record_service.retrieve_record_decrypted(
        db, current_user=current_user, record_id=record_id
    )


@router.get("/{record_id}/verify", response_model=IntegrityVerifyResponse)
def verify_record_integrity(
    record_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> IntegrityVerifyResponse:
    """
    Perform on-demand cryptographic integrity verification.
    Verifies that the off-chain storage blob matches the SHA-256 commitment in PostgreSQL.
    """
    return medical_record_service.verify_record_integrity(
        db, current_user=current_user, record_id=record_id
    )


@router.delete(
    "/{record_id}",
    status_code=204,
)
def delete_record(
    record_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Delete a medical record and its off-chain encrypted blob. Patient owner only."""
    medical_record_service.delete_record(
        db, current_user=current_user, record_id=record_id
    )
