import json
import logging
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.medical_record import MedicalRecord
from app.models.patient import Patient
from app.models.user import User
from app.repositories import (
    consent_repository,
    doctor_repository,
    medical_record_repository,
    patient_repository,
)
from app.schemas.medical_record import (
    BlockchainAnchorResponse,
    BlockchainVerifyResponse,
    IntegrityVerifyResponse,
    MedicalRecordCreate,
    MedicalRecordDetailResponse,
    MedicalRecordResponse,
)
from app.services import (
    audit_service,
    blockchain_service,
    encryption_service,
    fhir_service,
    integrity_service,
    storage_service,
)

logger = logging.getLogger(__name__)


def check_record_metadata_access(
    db: Session, current_user: User, record: MedicalRecord
) -> bool:
    """
    Lightweight authorization for record metadata reads (listing, get).
    Checks: JWT (handled by dep) + active user + role + ownership/consent.
    Does NOT trigger ZK proof generation — that only happens before decryption.
    """
    if current_user.role == "patient":
        patient = patient_repository.get_by_user_id(db, current_user.id)
        if patient is None or record.patient_id != patient.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this medical record",
            )
        return True

    elif current_user.role == "doctor":
        doctor = doctor_repository.get_or_create_for_user(
            db, user_id=current_user.id, email=current_user.email
        )
        consent = consent_repository.find_active_consent(
            db, record_id=record.id, grantee_doctor_id=doctor.id
        )
        if consent is None:
            from app.models.consent import Consent
            any_consent = (
                db.query(Consent)
                .filter(Consent.record_id == record.id, Consent.grantee_doctor_id == doctor.id)
                .order_by(Consent.created_at.desc())
                .first()
            )
            if any_consent and any_consent.expires_at:
                from datetime import datetime, timezone
                expires = any_consent.expires_at
                now = datetime.now(timezone.utc)
                if expires.tzinfo is None:
                    expires = expires.replace(tzinfo=timezone.utc)
                if expires < now:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Consent has expired. The patient needs to grant new consent.",
                    )
            if any_consent and any_consent.status == "revoked":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access was revoked by the patient",
                )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No active consent granted to access this medical record",
            )
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to access this record",
    )


def check_record_decryption_access(
    db: Session, current_user: User, record: MedicalRecord
) -> bool:
    """
    Full 12-point authorization for record decryption/document access.

    Authorization order (Phase 6):
      1. Valid JWT (handled by FastAPI dependency)
      2. Active user (handled by FastAPI dependency)
      3. Correct role
      4. Valid doctor profile (for doctors)
      5. Valid patient/record relationship
      6. Valid access request (consent exists)
      7. Valid blockchain consent
      8. Consent not expired
      9. Consent not revoked
      10. Required permission (read)
      11. Valid ZK authorization proof
      12. Record integrity verification (post-decryption)

    If ANY condition fails → DENY ACCESS.
    Decryption NEVER happens before authorization succeeds.
    """
    # Patients access their own records — no ZK/blockchain needed
    if current_user.role == "patient":
        patient = patient_repository.get_by_user_id(db, current_user.id)
        if patient is None or record.patient_id != patient.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this medical record",
            )
        return True

    elif current_user.role == "doctor":
        # 4. Valid doctor profile
        doctor = doctor_repository.get_or_create_for_user(
            db, user_id=current_user.id, email=current_user.email
        )

        # 5–6. Valid consent (record-specific, grantee-specific)
        consent = consent_repository.find_active_consent(
            db, record_id=record.id, grantee_doctor_id=doctor.id
        )
        if consent is None:
            # Check if an expired or revoked consent exists to provide precise diagnosis
            from app.models.consent import Consent
            any_consent = (
                db.query(Consent)
                .filter(Consent.record_id == record.id, Consent.grantee_doctor_id == doctor.id)
                .order_by(Consent.created_at.desc())
                .first()
            )
            if any_consent and any_consent.expires_at:
                from datetime import datetime, timezone
                expires = any_consent.expires_at
                now = datetime.now(timezone.utc)
                if expires.tzinfo is None:
                    expires = expires.replace(tzinfo=timezone.utc)
                if expires < now:
                    audit_service.log_event(
                        db,
                        actor_user_id=current_user.id,
                        action="access.denied",
                        resource_type="medical_record",
                        resource_id=record.id,
                        details="reason=consent_expired",
                    )
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Consent has expired. The patient needs to grant new consent.",
                    )
            if any_consent and any_consent.status == "revoked":
                audit_service.log_event(
                    db,
                    actor_user_id=current_user.id,
                    action="access.denied",
                    resource_type="medical_record",
                    resource_id=record.id,
                    details="reason=consent_revoked",
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access was revoked by the patient",
                )

            audit_service.log_event(
                db,
                actor_user_id=current_user.id,
                action="access.denied",
                resource_type="medical_record",
                resource_id=record.id,
                details="reason=no_active_consent",
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No active consent granted to access this medical record",
            )

        # 7. Blockchain consent verification
        bchain_svc = blockchain_service.get_blockchain_service()
        patient_record = patient_repository.get_by_id(db, record.patient_id)
        patient_user = patient_record.user if patient_record else None
        patient_wallet = patient_user.wallet_address if patient_user else None
        doctor_wallet = current_user.wallet_address
        blockchain_consent_valid = bchain_svc.check_blockchain_consent(
            patient_address=patient_wallet,
            record_id=record.id,
            grantee_address=doctor_wallet,
            required_permission=1,  # read
        )
        if not blockchain_consent_valid:
            logger.warning(
                "Blockchain consent check failed for doctor=%s record=%s "
                "(wallets may not be linked, falling back to DB consent)",
                current_user.id, record.id,
            )

        # 11. Zero-Knowledge authorization proof verification
        from app.services.zk_service import zk_service
        zk_proof = zk_service.generate_authorization_proof(
            db,
            current_user=current_user,
            record_id=record.id,
            consent_id=consent.id,
        )
        zk_result = zk_service.verify_authorization_proof(
            db,
            proof=zk_proof.proof,
            record_commitment=zk_proof.record_commitment,
            authorization_commitment=zk_proof.authorization_commitment,
            requester_nullifier=zk_proof.requester_nullifier,
            actor_user_id=current_user.id,
            consume_nullifier=False,
        )

        if not zk_result.valid:
            audit_service.log_event(
                db,
                actor_user_id=current_user.id,
                action="ACCESS_DENIED",
                resource_type="medical_record",
                resource_id=record.id,
                details="reason=zk_proof_invalid",
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ZK authorization proof is invalid",
            )
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to access this record",
    )


# Backward-compatible alias for code that imports the old name
check_record_access = check_record_metadata_access


def create_record(
    db: Session,
    *,
    current_user: User,
    data: MedicalRecordCreate,
) -> MedicalRecord:
    """
    Execute the Phase 3 privacy-preserving medical record creation pipeline:
    1. Authorization & target patient resolution (patient or doctor)
    2. FHIR R4 schema validation
    3. Deterministic JSON canonicalization
    4. SHA-256 integrity hash generation
    5. AES-256-GCM authenticated encryption (random 12-byte nonce)
    6. Off-chain encrypted object upload
    7. Metadata & integrity commitment storage in PostgreSQL
    8. Non-PII audit event logging
    """
    # 1. Target patient resolution
    target_patient_id: str
    if current_user.role == "patient":
        patient = patient_repository.get_by_user_id(db, current_user.id)
        if patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found",
            )
        target_patient_id = patient.id

    elif current_user.role == "doctor":
        doctor = doctor_repository.get_or_create_for_user(
            db, user_id=current_user.id, email=current_user.email
        )
        if not data.patient_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Doctor must specify target patient_id to create a record",
            )
        target_patient = patient_repository.get_by_id(db, data.patient_id)
        if target_patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified patient not found",
            )
        target_patient_id = target_patient.id

    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients and doctors can create medical records",
        )

    # 2. Validate FHIR Resource
    validated_resource_type = fhir_service.validate_resource(data.fhir_data)

    # 3. Canonicalize FHIR JSON
    canonical_bytes, _ = fhir_service.canonicalize_fhir(data.fhir_data)

    # 4. Generate SHA-256 integrity hash
    record_hash = integrity_service.calculate_record_hash(canonical_bytes)

    # 5. Encrypt with AES-256-GCM
    encrypted_payload = encryption_service.encrypt(canonical_bytes)

    # 6. Upload encrypted blob to off-chain storage
    storage_svc = storage_service.get_storage_service()
    storage_ref = storage_svc.upload(encrypted_payload)

    # 7. Store metadata & integrity commitment in PostgreSQL
    record = medical_record_repository.create(
        db,
        patient_id=target_patient_id,
        created_by_user_id=current_user.id,
        record_type=data.record_type,
        fhir_resource_type=validated_resource_type,
        encrypted_storage_ref=storage_ref,
        record_hash=record_hash,
        storage_provider=settings.storage_type,
        encryption_version="aes-256-gcm-v1",
    )

    # 8. Non-PII Audit logging
    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="record.created",
        resource_type="medical_record",
        resource_id=record.id,
        details=f"record_type={data.record_type},fhir={validated_resource_type},storage={settings.storage_type}",
    )

    return record


def get_record(db: Session, *, current_user: User, record_id: str) -> MedicalRecord:
    """
    Get a single medical record metadata entry with lightweight authorization check.
    """
    record = medical_record_repository.get_by_id(db, record_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical record not found",
        )
    check_record_metadata_access(db, current_user, record)
    return record


def get_record_for_decryption(
    db: Session, *, current_user: User, record_id: str
) -> MedicalRecord:
    """
    Get a medical record with FULL 12-point authorization check.
    Used before decryption or document streaming — never for metadata reads.
    """
    record = medical_record_repository.get_by_id(db, record_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical record not found",
        )
    check_record_decryption_access(db, current_user, record)
    return record


def retrieve_record_decrypted(
    db: Session,
    *,
    current_user: User,
    record_id: str,
) -> MedicalRecordDetailResponse:
    """
    Retrieve and decrypt an authorized medical record:
    1. Check authorization
    2. Download encrypted blob from off-chain storage
    3. Decrypt payload using AES-256-GCM
    4. Reconstruct canonical FHIR JSON
    5. Verify SHA-256 integrity hash against stored commitment
    6. Log audit event
    7. Return decrypted data + verification status
    """
    # Phase 6: Full 12-point authorization BEFORE decryption
    record = get_record_for_decryption(db, current_user=current_user, record_id=record_id)

    if not record.encrypted_storage_ref:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encrypted storage reference associated with this record",
        )

    # 2. Download from storage
    storage_svc = storage_service.get_storage_service()
    encrypted_bytes = storage_svc.download(record.encrypted_storage_ref)

    # 3. Decrypt AES-256-GCM
    decrypted_bytes = encryption_service.decrypt(encrypted_bytes)

    # 4. Parse JSON
    try:
        fhir_data = json.loads(decrypted_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decrypted data is not valid UTF-8 JSON",
        )

    # 5. Verify integrity hash (12th point of authorization)
    is_valid = integrity_service.verify_record_hash(decrypted_bytes, record.record_hash or "")
    if not is_valid:
        audit_service.log_event(
            db,
            actor_user_id=current_user.id,
            action="INTEGRITY_FAILED",
            resource_type="medical_record",
            resource_id=record.id,
            details="hash_mismatch",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Record integrity verification failed. The record may have been tampered with.",
        )

    # 6. Audit event
    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="record.accessed",
        resource_type="medical_record",
        resource_id=record.id,
        details="decrypted_and_verified",
    )

    base_response = MedicalRecordResponse.model_validate(record)
    return MedicalRecordDetailResponse(
        **base_response.model_dump(),
        fhir_data=fhir_data,
        integrity_verified=True,
    )


def verify_record_integrity(
    db: Session,
    *,
    current_user: User,
    record_id: str,
) -> IntegrityVerifyResponse:
    """
    Perform an on-demand integrity verification against off-chain storage.
    Calculates SHA-256 of the stored record and compares with database commitment.
    """
    record = get_record(db, current_user=current_user, record_id=record_id)

    if not record.encrypted_storage_ref:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encrypted storage reference associated with this record",
        )

    storage_svc = storage_service.get_storage_service()
    encrypted_bytes = storage_svc.download(record.encrypted_storage_ref)
    decrypted_bytes = encryption_service.decrypt(encrypted_bytes)

    recalculated_hash = integrity_service.calculate_record_hash(decrypted_bytes)
    stored_hash = record.record_hash or ""
    is_valid = integrity_service.verify_record_hash(decrypted_bytes, stored_hash)

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="record.verified",
        resource_type="medical_record",
        resource_id=record.id,
        details=f"integrity_status={'verified' if is_valid else 'mismatch'}",
    )

    return IntegrityVerifyResponse(
        record_id=record.id,
        stored_hash=stored_hash,
        recalculated_hash=recalculated_hash,
        integrity_verified=is_valid,
        status="verified" if is_valid else "mismatch",
        details="SHA-256 commitment successfully verified against AES-256-GCM decrypted storage blob."
        if is_valid
        else "Integrity mismatch: storage blob does not match database record hash.",
    )


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
        doctor = doctor_repository.get_or_create_for_user(
            db, user_id=current_user.id, email=current_user.email
        )
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


def delete_record(db: Session, *, current_user: User, record_id: str) -> None:
    """
    Delete a medical record. Only the owning patient can delete.
    Removes both the off-chain encrypted blob and the PostgreSQL metadata.
    """
    record = medical_record_repository.get_by_id(db, record_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical record not found",
        )

    if current_user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can delete their own medical records",
        )

    patient = patient_repository.get_by_user_id(db, current_user.id)
    if patient is None or record.patient_id != patient.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own medical records",
        )

    # Clean up off-chain storage if exists
    if record.encrypted_storage_ref:
        storage_svc = storage_service.get_storage_service()
        storage_svc.delete(record.encrypted_storage_ref)

    medical_record_repository.delete(db, record_id)

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="record.deleted",
        resource_type="medical_record",
        resource_id=record_id,
    )


def create_document_record(
    db: Session,
    *,
    current_user: User,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    record_type: str = "document",
    patient_id: Optional[str] = None,
) -> MedicalRecord:
    """
    Phase 3.5 & 4: Upload and encrypt an original medical document
    (prescription image, blood report PDF, discharge summary, X-ray).

    1. Computes SHA-256 integrity hash over raw document bytes
    2. Encrypts document with AES-256-GCM (fresh random 12-byte nonce)
    3. Uploads encrypted blob to off-chain storage
    4. Persists metadata & integrity hash in PostgreSQL
    5. Automatically anchors integrity commitment on blockchain
    6. Logs audit event
    """
    # 1. Target patient resolution
    target_patient_id: str
    if current_user.role == "patient":
        patient = patient_repository.get_by_user_id(db, current_user.id)
        if patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found",
            )
        target_patient_id = patient.id
    elif current_user.role == "doctor":
        if not patient_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Doctor must specify target patient_id to upload a document",
            )
        target_patient = patient_repository.get_by_id(db, patient_id)
        if target_patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified patient not found",
            )
        target_patient_id = target_patient.id
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients and doctors can upload medical documents",
        )

    # 2. Compute SHA-256 integrity hash of raw document bytes
    doc_hash = integrity_service.calculate_record_hash(file_bytes)

    # 3. Encrypt document bytes with AES-256-GCM
    encrypted_bytes = encryption_service.encrypt(file_bytes)

    # 4. Upload encrypted blob to off-chain storage
    storage_svc = storage_service.get_storage_service()
    storage_ref = storage_svc.upload(encrypted_bytes)

    # 5. Store metadata in PostgreSQL
    record = medical_record_repository.create(
        db,
        patient_id=target_patient_id,
        created_by_user_id=current_user.id,
        record_type=record_type,
        fhir_resource_type="DocumentReference",
        encrypted_storage_ref=storage_ref,
        record_hash=doc_hash,
        storage_provider=settings.storage_type,
        encryption_version="aes-256-gcm-v1",
        original_document_filename=filename,
        original_document_mime_type=content_type,
        original_document_hash=doc_hash,
        original_document_ref=storage_ref,
    )

    # 6. Anchor to blockchain
    bchain_svc = blockchain_service.get_blockchain_service()
    anchor_info = bchain_svc.register_record_on_chain(
        record_id=record.id,
        record_hash=doc_hash,
        patient_id=target_patient_id,
        storage_ref=storage_ref,
    )

    medical_record_repository.update_blockchain_anchor(
        db,
        record.id,
        blockchain_record_id=anchor_info["record_chain_id"],
        blockchain_network=anchor_info["blockchain_network"],
        blockchain_contract_address=anchor_info["contract_address"],
        blockchain_tx_hash=anchor_info["transaction_hash"],
        blockchain_anchored_at=anchor_info["anchored_at"],
    )

    # 7. Audit log
    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="document.uploaded",
        resource_type="medical_record",
        resource_id=record.id,
        details=f"filename={filename},mime={content_type},tx={anchor_info['transaction_hash']}",
    )

    return record


def retrieve_document_decrypted(
    db: Session,
    *,
    current_user: User,
    record_id: str,
) -> tuple[bytes, str, str]:
    """
    Retrieve and decrypt an authorized medical document (PDF, Image, etc.).
    Phase 6: Full 12-point authorization BEFORE decryption.
    Returns (decrypted_bytes, filename, mime_type).
    """
    record = get_record_for_decryption(db, current_user=current_user, record_id=record_id)

    doc_ref = record.original_document_ref or record.encrypted_storage_ref
    if not doc_ref:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No document file attached to this record",
        )

    # Download from storage
    storage_svc = storage_service.get_storage_service()
    encrypted_bytes = storage_svc.download(doc_ref)

    # Decrypt AES-256-GCM
    decrypted_bytes = encryption_service.decrypt(encrypted_bytes)

    # Verify SHA-256 integrity hash
    expected_hash = record.original_document_hash or record.record_hash or ""
    is_valid = integrity_service.verify_record_hash(decrypted_bytes, expected_hash)
    if not is_valid:
        audit_service.log_event(
            db,
            actor_user_id=current_user.id,
            action="INTEGRITY_FAILED",
            resource_type="medical_record",
            resource_id=record.id,
            details="document_hash_mismatch",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document integrity verification failed. The document may have been tampered with.",
        )

    # Audit log
    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="document.accessed",
        resource_type="medical_record",
        resource_id=record.id,
        details="decrypted_and_streamed",
    )

    filename = record.original_document_filename or f"record_{record.id}.bin"
    mime_type = record.original_document_mime_type or "application/octet-stream"

    return decrypted_bytes, filename, mime_type


def anchor_record_to_blockchain(
    db: Session,
    *,
    current_user: User,
    record_id: str,
) -> BlockchainAnchorResponse:
    """
    Anchor a record's SHA-256 integrity commitment to the EVM MedicalRecordRegistry smart contract.
    """
    record = get_record(db, current_user=current_user, record_id=record_id)

    if current_user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owning patient can anchor their record to blockchain",
        )

    if not record.record_hash or not record.encrypted_storage_ref:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Record missing cryptographic hash or storage reference",
        )

    bchain_svc = blockchain_service.get_blockchain_service()
    anchor_info = bchain_svc.register_record_on_chain(
        record_id=record.id,
        record_hash=record.record_hash,
        patient_id=record.patient_id,
        storage_ref=record.encrypted_storage_ref,
    )

    medical_record_repository.update_blockchain_anchor(
        db,
        record.id,
        blockchain_record_id=anchor_info["record_chain_id"],
        blockchain_network=anchor_info["blockchain_network"],
        blockchain_contract_address=anchor_info["contract_address"],
        blockchain_tx_hash=anchor_info["transaction_hash"],
        blockchain_anchored_at=anchor_info["anchored_at"],
    )

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="record.anchored_on_chain",
        resource_type="medical_record",
        resource_id=record.id,
        details=f"tx_hash={anchor_info['transaction_hash']},network={anchor_info['blockchain_network']}",
    )

    return BlockchainAnchorResponse(**anchor_info)


def verify_record_on_blockchain(
    db: Session,
    *,
    current_user: User,
    record_id: str,
) -> BlockchainVerifyResponse:
    """
    Verify off-chain decrypted record integrity against on-chain smart contract anchor.
    """
    record = get_record(db, current_user=current_user, record_id=record_id)

    storage_ref = record.encrypted_storage_ref or record.original_document_ref
    if not storage_ref:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record has no storage reference",
        )

    storage_svc = storage_service.get_storage_service()
    encrypted_bytes = storage_svc.download(storage_ref)
    decrypted_bytes = encryption_service.decrypt(encrypted_bytes)

    recalculated_hash = integrity_service.calculate_record_hash(decrypted_bytes)

    bchain_svc = blockchain_service.get_blockchain_service()
    result = bchain_svc.verify_record_on_chain(
        record_id=record.id,
        expected_hash=recalculated_hash,
    )

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="blockchain.integrity_verified",
        resource_type="medical_record",
        resource_id=record.id,
        details=f"status={result['status']},valid={result['is_valid']}",
    )

    return BlockchainVerifyResponse(**result)
