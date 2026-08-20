from datetime import datetime, timezone
import pytest

from app.services.blockchain_service import BlockchainService


def test_pseudonym_patient_commitment():
    svc = BlockchainService()
    p1 = "patient-uuid-1"
    p2 = "patient-uuid-2"

    c1 = svc.generate_patient_commitment(p1)
    c1_again = svc.generate_patient_commitment(p1)
    c2 = svc.generate_patient_commitment(p2)

    assert c1.startswith("0x")
    assert len(c1) == 66
    assert c1 == c1_again, "Commitment must be deterministic for identical patient"
    assert c1 != c2, "Different patients must produce different pseudonym commitments"


def test_record_commitment_generation():
    svc = BlockchainService()
    r_id = "record-uuid-test"
    rec_c = svc.generate_record_commitment(r_id)

    assert rec_c.startswith("0x")
    assert len(rec_c) == 66


def test_register_and_verify_record_on_chain():
    svc = BlockchainService()
    record_id = "rec-uuid-101"
    record_hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    patient_id = "pat-uuid-202"
    storage_ref = "local://test-encrypted-file.enc"

    res = svc.register_record_on_chain(record_id, record_hash, patient_id, storage_ref)

    assert res["status"] == "anchored"
    assert res["transaction_hash"].startswith("0x")
    assert len(res["transaction_hash"]) == 66

    # Verify matching hash
    ver = svc.verify_record_on_chain(record_id, record_hash)
    assert ver["is_valid"] is True
    assert ver["status"] == "verified"

    # Verify tampered hash
    tampered_hash = "1111111111111111111111111111111111111111111111111111111111111111"
    ver_bad = svc.verify_record_on_chain(record_id, tampered_hash)
    assert ver_bad["is_valid"] is False
    assert ver_bad["status"] == "tampered"


def test_on_chain_consent_lifecycle():
    svc = BlockchainService()
    patient_addr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    doctor_addr = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    other_addr = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
    record_id = "rec-uuid-consent-test"

    # 1. Grant consent (View=1 | Doc=2 = 3)
    future_expiry = int(datetime.now(timezone.utc).timestamp()) + 3600
    grant_res = svc.grant_consent_on_chain(
        patient_address=patient_addr,
        record_id=record_id,
        grantee_address=doctor_addr,
        permissions=3,
        expires_at_unix=future_expiry,
    )
    assert grant_res["status"] == "granted_on_chain"
    assert grant_res["transaction_hash"].startswith("0x")

    # 2. Check valid consent
    assert svc.check_blockchain_consent(patient_addr, record_id, doctor_addr, required_permission=1) is True
    assert svc.check_blockchain_consent(patient_addr, record_id, doctor_addr, required_permission=2) is True
    assert svc.check_blockchain_consent(patient_addr, record_id, doctor_addr, required_permission=4) is False
    assert svc.check_blockchain_consent(patient_addr, record_id, other_addr, required_permission=1) is False

    # 3. Revoke consent
    revoke_res = svc.revoke_consent_on_chain(patient_addr, record_id, doctor_addr)
    assert revoke_res["status"] == "revoked_on_chain"

    # 4. Access must now be denied
    assert svc.check_blockchain_consent(patient_addr, record_id, doctor_addr, required_permission=1) is False
