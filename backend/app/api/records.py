import os
import re
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
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

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".dcm", ".dicom", ".txt", ".bin"}
DISALLOWED_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".js", ".ts", ".py", ".php", ".vbs", ".ps1", ".dll", ".so", ".bin.exe"
}
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB


def sanitize_filename(filename: str) -> str:
    """Sanitize original filename to prevent path traversal and strip dangerous characters."""
    base = os.path.basename(filename)
    clean = re.sub(r"[^\w\.\-\_]", "_", base)
    return clean[:120] if clean else "document.bin"


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
    Phase 3.5, 4 & 6: Upload, validate, and encrypt an original medical document.
    - Validates file type, extension, and max size (25MB)
    - Sanitizes filename to prevent directory traversal
    - Encrypts with AES-256-GCM off-chain
    - Anchors SHA-256 integrity commitment on blockchain
    - Persists safe metadata in PostgreSQL
    """
    raw_filename = file.filename or "medical_document.bin"
    ext = os.path.splitext(raw_filename)[1].lower()

    if ext in DISALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Executable or dangerous file types are not permitted: '{ext}'",
        )

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed types: PDF, JPG, PNG, DICOM, TXT.",
        )

    file_bytes = await file.read()

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)",
        )

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB",
        )

    safe_filename = sanitize_filename(raw_filename)
    content_type = file.content_type or "application/octet-stream"

    record = medical_record_service.create_document_record(
        db,
        current_user=current_user,
        file_bytes=file_bytes,
        filename=safe_filename,
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
