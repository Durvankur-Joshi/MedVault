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
from app.services import audit_service, blockchain_service

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
    blockchain_tx_hash: str | None = None,
    blockchain_network: str | None = None,
    blockchain_contract_address: str | None = None,
    blockchain_consent_id: str | None = None,
) -> Consent:
    """
    Grant consent for a specific record.
    Only the patient who owns the record can grant consent.
    Exactly one grantee (doctor OR hospital) must be specified.
    Synchronizes consent state to the on-chain ConsentManager smart contract.
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
    grantee_wallet = None
    if grantee_doctor_id:
        doctor = doctor_repository.get_by_user_id(db, grantee_doctor_id)
        if doctor is None:
            from app.models.doctor import Doctor
            doctor = db.query(Doctor).filter(Doctor.id == grantee_doctor_id).first()
        if doctor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Grantee doctor not found",
            )
        if doctor.user and doctor.user.wallet_address:
            grantee_wallet = doctor.user.wallet_address

    if grantee_hospital_id:
        hospital = hospital_repository.get_by_id(db, grantee_hospital_id)
        if hospital is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Grantee hospital not found",
            )
        if hospital.user and hospital.user.wallet_address:
            grantee_wallet = hospital.user.wallet_address

    # Convert permission to bitmask: read=1, write=2, full=15
    perm_mask = 1 if permission == "read" else (2 if permission == "write" else 15)
    expires_unix = int(expires_at.timestamp()) if expires_at else int(datetime.now(timezone.utc).timestamp()) + 86400 * 30

    patient_wallet = current_user.wallet_address
    bchain_svc = blockchain_service.get_blockchain_service()

    if bchain_svc.is_real_sepolia():
        if not patient_wallet:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Patient EVM wallet address is required for Sepolia on-chain consent registration.",
            )
        if not grantee_wallet:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Grantee doctor/hospital EVM wallet address is required for Sepolia on-chain consent registration.",
            )
    else:
        patient_wallet = patient_wallet or "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        grantee_wallet = grantee_wallet or "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

    # On-chain consent registration
    if blockchain_tx_hash:
        final_tx_hash = blockchain_tx_hash
        final_network = blockchain_network or "Sepolia"
        final_contract = blockchain_contract_address or bchain_svc.consent_manager_address or "0xDA0bab807633f07f013f94DD0E6A4F96F8742B53"
        final_consent_id = blockchain_consent_id or bchain_svc.generate_record_commitment(record_id)
    else:
        chain_res = bchain_svc.grant_consent_on_chain(
            patient_address=patient_wallet,
            record_id=record_id,
            grantee_address=grantee_wallet,
            permissions=perm_mask,
            expires_at_unix=expires_unix,
        )
        final_tx_hash = chain_res.get("transaction_hash")
        final_network = chain_res.get("blockchain_network")
        final_contract = chain_res.get("contract_address")
        final_consent_id = chain_res.get("consent_id")

    target_doctor_id = doctor.id if grantee_doctor_id else None

    consent = consent_repository.create(
        db,
        patient_id=patient.id,
        record_id=record_id,
        permission=permission,
        grantee_doctor_id=target_doctor_id,
        grantee_hospital_id=grantee_hospital_id,
        expires_at=expires_at,
    )

    # Attach blockchain tracking metadata
    consent.blockchain_consent_id = final_consent_id
    consent.blockchain_network = final_network
    consent.blockchain_contract_address = final_contract
    consent.blockchain_tx_hash = final_tx_hash
    db.commit()
    db.refresh(consent)

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="consent.granted",
        resource_type="consent",
        resource_id=consent.id,
        details=f"record_id={record_id},permission={permission},tx={final_tx_hash}",
    )

    return consent


def list_consents(db: Session, *, current_user: User) -> list[Consent]:
    """
    List consents.
    - Patient: sees consents for their own records.
    - Doctor: sees consents granted to them.
    """
    if current_user.role == "patient":
        patient = patient_repository.get_by_user_id(db, current_user.id)
        if patient is None:
            return []
        return consent_repository.list_for_patient(db, patient.id)

    elif current_user.role == "doctor":
        doctor = doctor_repository.get_or_create_for_user(
            db, user_id=current_user.id, email=current_user.email
        )
        return db.query(Consent).filter(Consent.grantee_doctor_id == doctor.id).all()

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

    # Doctor who was granted access can view
    if current_user.role == "doctor":
        doctor = doctor_repository.get_or_create_for_user(
            db, user_id=current_user.id, email=current_user.email
        )
        if doctor and consent.grantee_doctor_id == doctor.id:
            return consent

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this consent",
    )


def revoke_consent(
    db: Session,
    *,
    current_user: User,
    consent_id: str,
    blockchain_tx_hash: str | None = None,
) -> Consent:
    """
    Revoke an active consent entry. Only the owning patient can revoke.
    Synchronizes on-chain revocation to the ConsentManager contract.
    """
    consent = consent_repository.get_by_id(db, consent_id)
    if consent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consent record not found",
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
            detail="You can only revoke consent for your own records",
        )

    if consent.status == "revoked":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent is already revoked",
        )

    patient_wallet = current_user.wallet_address
    grantee_wallet = None
    if consent.grantee_doctor_id:
        doctor = doctor_repository.get_by_id(db, consent.grantee_doctor_id)
        if doctor and doctor.user and doctor.user.wallet_address:
            grantee_wallet = doctor.user.wallet_address
    elif consent.grantee_hospital_id:
        hospital = hospital_repository.get_by_id(db, consent.grantee_hospital_id)
        if hospital and hospital.user and hospital.user.wallet_address:
            grantee_wallet = hospital.user.wallet_address

    bchain_svc = blockchain_service.get_blockchain_service()

    if not blockchain_tx_hash:
        if bchain_svc.is_real_sepolia():
            if not patient_wallet:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Patient EVM wallet address is required for Sepolia on-chain consent revocation.",
                )
            if not grantee_wallet:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Grantee EVM wallet address is required for Sepolia on-chain consent revocation.",
                )
        else:
            patient_wallet = patient_wallet or "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
            grantee_wallet = grantee_wallet or "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

        chain_res = bchain_svc.revoke_consent_on_chain(
            patient_address=patient_wallet,
            record_id=consent.record_id,
            grantee_address=grantee_wallet,
        )
        final_tx_hash = chain_res.get("transaction_hash")
    else:
        final_tx_hash = blockchain_tx_hash

    revoked = consent_repository.revoke(db, consent_id)
    revoked.blockchain_tx_hash = final_tx_hash
    db.commit()
    db.refresh(revoked)

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="consent.revoked",
        resource_type="consent",
        resource_id=consent_id,
        details=f"tx_hash={final_tx_hash}",
    )

    return revoked
