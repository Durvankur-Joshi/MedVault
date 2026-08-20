from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.medical_record import (
    BlockchainAnchorResponse,
    BlockchainVerifyResponse,
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


@router.post(
    "/upload-document",
    response_model=MedicalRecordResponse,
    status_code=201,
)
async def upload_document(
    file: Annotated[UploadFile, File(...)],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    record_type: Annotated[str, Form()] = "document",
    patient_id: Annotated[Optional[str], Form()] = None,
) -> MedicalRecordResponse:
    """
    Phase 3.5 & 4: Upload and encrypt an original medical document (PDF, JPG, PNG).
    1. Computes SHA-256 integrity hash
    2. Encrypts with AES-256-GCM
    3. Saves encrypted blob off-chain
    4. Anchors integrity commitment on blockchain
    5. Saves metadata in PostgreSQL
    """
    file_bytes = await file.read()
    filename = file.filename or "medical_document.bin"
    content_type = file.content_type or "application/octet-stream"

    record = medical_record_service.create_document_record(
        db,
        current_user=current_user,
        file_bytes=file_bytes,
        filename=filename,
        content_type=content_type,
        record_type=record_type,
        patient_id=patient_id,
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


@router.get("/{record_id}/document")
def get_document_decrypted(
    record_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    """
    Retrieve, decrypt, and stream an authorized medical document (PDF, PNG, JPG).
    Verifies SHA-256 integrity hash before streaming.
    """
    decrypted_bytes, filename, mime_type = medical_record_service.retrieve_document_decrypted(
        db, current_user=current_user, record_id=record_id
    )
    return Response(
        content=decrypted_bytes,
        media_type=mime_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post("/{record_id}/anchor", response_model=BlockchainAnchorResponse)
def anchor_record(
    record_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BlockchainAnchorResponse:
    """
    Anchor a medical record's SHA-256 integrity commitment to the EVM MedicalRecordRegistry contract.
    Only the owning patient can anchor their record.
    """
    return medical_record_service.anchor_record_to_blockchain(
        db, current_user=current_user, record_id=record_id
    )


@router.get("/{record_id}/blockchain-verify", response_model=BlockchainVerifyResponse)
def verify_blockchain_integrity(
    record_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BlockchainVerifyResponse:
    """
    Verify off-chain decrypted record integrity directly against the on-chain smart contract anchor.
    """
    return medical_record_service.verify_record_on_blockchain(
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
