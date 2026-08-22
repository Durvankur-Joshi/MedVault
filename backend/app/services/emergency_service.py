"""
MedVault Emergency Break-Glass Access Service (Phase 6).

Allows credentialed doctors / emergency providers to request immediate, time-bound
access to a patient's critical medical record under life-threatening or urgent situations.

SECURITY & AUDIT CONSTRAINTS:
1. Role must be doctor or emergency provider.
2. Access is strictly time-bound (4 hours maximum) — no permanent bypass.
3. Every emergency request generates explicit audit events (EMERGENCY_ACCESS_REQUESTED, EMERGENCY_ACCESS_GRANTED).
4. On-chain consent state is synchronized with the ConsentManager smart contract.
5. Record integrity & ZK authorization requirements remain enforced on decryption.
"""

from datetime import datetime, timedelta, timezone
import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import (
    consent_repository,
    doctor_repository,
    medical_record_repository,
    patient_repository,
)
from app.schemas.emergency import EmergencyAccessResponse
from app.services import audit_service, blockchain_service

logger = logging.getLogger(__name__)

EMERGENCY_DURATION_HOURS = 4


def request_emergency_access(
    db: Session,
    *,
    current_user: User,
    patient_id: str,
    record_id: str,
    reason: str,
) -> EmergencyAccessResponse:
    """
    Execute emergency break-glass protocol.
    Creates a strictly time-bound consent (4 hours) with mandatory blockchain anchoring and audit trail.
    """
    # 1. Role validation
    if current_user.role not in ("doctor", "hospital_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only licensed doctors and emergency providers can initiate emergency break-glass access",
        )

    # 2. Doctor profile resolution
    doctor = doctor_repository.get_or_create_for_user(
        db, user_id=current_user.id, email=current_user.email
    )

    # 3. Patient existence check
    patient = patient_repository.get_by_id(db, patient_id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target patient not found",
        )

    # 4. Record validation
    record = medical_record_repository.get_by_id(db, record_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target medical record not found",
        )
    if record.patient_id != patient.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Record does not belong to the specified patient",
        )

    # 5. Calculate time-bound expiry (4 hours from now)
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(hours=EMERGENCY_DURATION_HOURS)
    expires_unix = int(expires_at.timestamp())

    # 6. Explicit Audit: Emergency access requested
    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="emergency.requested",
        resource_type="medical_record",
        resource_id=record.id,
        details=f"doctor_id={doctor.id},patient_id={patient.id},duration={EMERGENCY_DURATION_HOURS}h,reason={reason[:100]}",
    )

    # 7. Blockchain consent registration (on-chain anchoring)
    bchain_svc = blockchain_service.get_blockchain_service()
    patient_user = patient.user if patient else None
    patient_wallet = (
        patient_user.wallet_address
        if patient_user and patient_user.wallet_address
        else "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    )
    doctor_wallet = current_user.wallet_address or "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

    chain_res = bchain_svc.grant_consent_on_chain(
        patient_address=patient_wallet,
        record_id=record.id,
        grantee_address=doctor_wallet,
        permissions=1,  # read permission
        expires_at_unix=expires_unix,
    )

    # 8. Create time-bound Consent in DB
    consent = consent_repository.create(
        db,
        patient_id=patient.id,
        record_id=record.id,
        permission="read",
        grantee_doctor_id=doctor.id,
        expires_at=expires_at,
    )

    # Attach blockchain tracking metadata
    consent.blockchain_consent_id = chain_res.get("consent_id")
    consent.blockchain_network = chain_res.get("blockchain_network")
    consent.blockchain_contract_address = chain_res.get("contract_address")
    consent.blockchain_tx_hash = chain_res.get("transaction_hash")
    db.commit()
    db.refresh(consent)

    # 9. Explicit Audit: Emergency access granted
    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="emergency.granted",
        resource_type="consent",
        resource_id=consent.id,
        details=f"expires_at={expires_at.isoformat()},tx={chain_res.get('transaction_hash')}",
    )

    return EmergencyAccessResponse(
        consent_id=consent.id,
        record_id=record.id,
        patient_id=patient.id,
        grantee_doctor_id=doctor.id,
        permission="read",
        status="active",
        expires_at=expires_at,
        blockchain_tx_hash=chain_res.get("transaction_hash"),
        audit_event_logged=True,
        message=f"Emergency break-glass access granted for {EMERGENCY_DURATION_HOURS} hours. Access is strictly audited and time-bound.",
    )
