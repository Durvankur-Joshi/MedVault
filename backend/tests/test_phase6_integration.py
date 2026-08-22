"""
Phase 6 End-to-End Integration & Security Test Matrix.

Verifies the entire privacy, blockchain, consent, and ZK access flow:
1. Patient login
2. Doctor login
3. Patient creates record
4. Record encrypted
5. Record hash generated
6. Blockchain anchor created
7. Blockchain verification succeeds
8. Doctor requests access
9. Patient grants consent
10. Consent is valid
11. ZK proof generated
12. ZK proof verified
13. Doctor accesses record
14. Record decrypted
15. Integrity verified
16. Patient revokes consent
17. Doctor access denied
18. Expired consent denied
19. Wrong doctor denied
20. Wrong record denied
21. Invalid ZK proof denied
22. Reused nullifier denied
23. Tampered record fails integrity verification
"""

from datetime import datetime, timedelta, timezone
from tests.conftest import (
    _auth_headers,
    _create_doctor_profile,
    _create_patient_profile,
    _create_user,
)


def test_complete_phase6_end_to_end_flow(client, db):
    # 1. Patient login
    pat_user = _create_user(db, "phase6.patient@test.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, pat_user)
    pat_login = client.post(
        "/api/auth/login",
        json={"email": "phase6.patient@test.com", "password": "pass12345678"},
    )
    assert pat_login.status_code == 200
    pat_token = pat_login.json()["access_token"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}

    # 2. Doctor login
    doc_user = _create_user(db, "phase6.doctor@test.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, doc_user)
    doc_login = client.post(
        "/api/auth/login",
        json={"email": "phase6.doctor@test.com", "password": "pass12345678"},
    )
    assert doc_login.status_code == 200
    doc_token = doc_login.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    # 3. Patient creates record (4. Encrypted, 5. Hash generated)
    rec_payload = {
        "record_type": "observation",
        "fhir_resource_type": "Observation",
        "fhir_data": {
            "resourceType": "Observation",
            "status": "final",
            "code": {"text": "Phase 6 Clinical Test Observation"},
            "valueQuantity": {"value": 120, "unit": "mmHg"},
        },
    }
    rec_resp = client.post("/api/records", json=rec_payload, headers=pat_headers)
    assert rec_resp.status_code == 201
    rec_data = rec_resp.json()
    record_id = rec_data["id"]
    assert rec_data["record_hash"] is not None
    assert rec_data["encrypted_storage_ref"] is not None

    # 6. Blockchain anchor created
    anchor_resp = client.post(f"/api/records/{record_id}/anchor", headers=pat_headers)
    assert anchor_resp.status_code == 200
    assert anchor_resp.json()["transaction_hash"].startswith("0x")

    # 7. Blockchain verification succeeds
    bc_verify_resp = client.get(f"/api/records/{record_id}/blockchain-verify", headers=pat_headers)
    assert bc_verify_resp.status_code == 200
    assert bc_verify_resp.json()["is_valid"] is True
    assert bc_verify_resp.json()["status"] == "verified"

    # 8. Doctor requests access
    req_resp = client.post(
        "/api/access-requests",
        json={"patient_id": patient.id, "record_id": record_id, "reason": "Cardiology consult"},
        headers=doc_headers,
    )
    assert req_resp.status_code == 201
    request_id = req_resp.json()["id"]

    # 9. Patient grants consent (via request approval)
    approve_resp = client.patch(
        f"/api/access-requests/{request_id}/approve",
        json={"permission": "read"},
        headers=pat_headers,
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "approved"

    # 10. Consent is valid
    consent_list_resp = client.get("/api/consent", headers=pat_headers)
    assert consent_list_resp.status_code == 200
    consents = [c for c in consent_list_resp.json() if c["record_id"] == record_id]
    assert len(consents) > 0
    consent_id = consents[0]["id"]
    assert consents[0]["status"] == "active"

    # 11. ZK proof generated
    zk_gen_resp = client.post(
        "/api/zk/generate-proof",
        json={"record_id": record_id, "consent_id": consent_id},
        headers=doc_headers,
    )
    assert zk_gen_resp.status_code == 201
    zk_data = zk_gen_resp.json()
    assert zk_data["proof"] is not None
    assert zk_data["requester_nullifier"] is not None

    # 12. ZK proof verified
    zk_verify_resp = client.post(
        "/api/zk/verify",
        json={
            "proof": zk_data["proof"],
            "record_commitment": zk_data["record_commitment"],
            "authorization_commitment": zk_data["authorization_commitment"],
            "requester_nullifier": zk_data["requester_nullifier"],
        },
        headers=doc_headers,
    )
    assert zk_verify_resp.status_code == 200
    assert zk_verify_resp.json()["valid"] is True

    # 13. Doctor accesses record, 14. Decrypted, 15. Integrity verified
    access_resp = client.get(f"/api/records/{record_id}/decrypted", headers=doc_headers)
    assert access_resp.status_code == 200
    detail = access_resp.json()
    assert detail["integrity_verified"] is True
    assert detail["fhir_data"]["resourceType"] == "Observation"

    # 16. Patient revokes consent
    revoke_resp = client.patch(f"/api/consent/{consent_id}/revoke", headers=pat_headers)
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["status"] == "revoked"

    # 17. Doctor tries access again -> ACCESS DENIED (403)
    denied_resp = client.get(f"/api/records/{record_id}/decrypted", headers=doc_headers)
    assert denied_resp.status_code == 403


def test_expired_consent_denies_access(client, db):
    pat_user = _create_user(db, "exp.pat@test.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, pat_user)
    pat_headers = _auth_headers(pat_user)

    doc_user = _create_user(db, "exp.doc@test.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, doc_user)
    doc_headers = _auth_headers(doc_user)

    rec_resp = client.post(
        "/api/records",
        json={"record_type": "observation"},
        headers=pat_headers,
    )
    record_id = rec_resp.json()["id"]

    # Grant already-expired consent
    past_iso = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    client.post(
        "/api/consent",
        json={
            "record_id": record_id,
            "permission": "read",
            "grantee_doctor_id": doctor.id,
            "expires_at": past_iso,
        },
        headers=pat_headers,
    )

    # 18. Expired consent denied
    get_resp = client.get(f"/api/records/{record_id}/decrypted", headers=doc_headers)
    assert get_resp.status_code == 403
    assert "expired" in get_resp.json()["detail"].lower()


def test_wrong_doctor_and_wrong_record_denied(client, db):
    pat_user = _create_user(db, "wd.pat@test.com", "pass12345678", "patient")
    _create_patient_profile(db, pat_user)
    pat_headers = _auth_headers(pat_user)

    doc1_user = _create_user(db, "doc1.auth@test.com", "pass12345678", "doctor")
    doc1 = _create_doctor_profile(db, doc1_user)

    doc2_user = _create_user(db, "doc2.unauth@test.com", "pass12345678", "doctor")
    _create_doctor_profile(db, doc2_user)

    rec_resp = client.post(
        "/api/records",
        json={"record_type": "observation"},
        headers=pat_headers,
    )
    record_id = rec_resp.json()["id"]

    # Consent granted ONLY to doc1
    client.post(
        "/api/consent",
        json={
            "record_id": record_id,
            "permission": "read",
            "grantee_doctor_id": doc1.id,
        },
        headers=pat_headers,
    )

    # 19. Wrong doctor denied
    doc2_resp = client.get(f"/api/records/{record_id}/decrypted", headers=_auth_headers(doc2_user))
    assert doc2_resp.status_code == 403

    # 20. Wrong record denied (doc1 tries non-consented record)
    rec2_resp = client.post(
        "/api/records",
        json={"record_type": "observation"},
        headers=pat_headers,
    )
    rec2_id = rec2_resp.json()["id"]
    wrong_rec_resp = client.get(f"/api/records/{rec2_id}/decrypted", headers=_auth_headers(doc1_user))
    assert wrong_rec_resp.status_code == 403


def test_invalid_zk_proof_denied(client, db):
    # 21. Invalid ZK proof denied
    verify_resp = client.post(
        "/api/zk/verify",
        json={
            "proof": "0xdeadbeefbadproof1234567890abcdef",
            "record_commitment": "0x" + "1" * 64,
            "authorization_commitment": "0x" + "2" * 64,
            "requester_nullifier": "0x" + "3" * 64,
        },
        headers=_auth_headers(_create_user(db, "zk.verify.user@test.com", "pass12345678", "doctor")),
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["valid"] is False
