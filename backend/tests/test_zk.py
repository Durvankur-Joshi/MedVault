"""
Phase 5 Tests: Zero-Knowledge Privacy & Authorization (Noir Circuit Integration).

Tests:
1. Valid authorization witness generation & verification.
2. Wrong secret / invalid proof rejection.
3. Tampered record commitment rejection.
4. Tampered authorization commitment rejection.
5. Verification that public inputs contain strictly cryptographic values (Zero PII).
6. Unauthorized roles cannot generate doctor authorization proofs.
7. Doctor cannot generate ZK proof without active patient consent.
8. Medical record decrypted retrieval verifies ZK authorization proof before decryption.
9. ZK status API endpoint returns subsystem status.
"""

from app.services.zk_service import zk_service
from tests.conftest import (
    _auth_headers,
    _create_doctor_profile,
    _create_patient_profile,
    _create_user,
)


def _setup_patient_doctor_with_consent(client, db):
    """Helper: create patient + record + doctor + active consent."""
    p_user = _create_user(db, "zk_patient@test.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, p_user)
    p_headers = _auth_headers(p_user)

    # Patient creates a medical record
    rec_resp = client.post(
        "/api/records",
        json={
            "record_type": "observation",
            "fhir_resource_type": "Observation",
            "fhir_data": {
                "resourceType": "Observation",
                "status": "final",
                "code": {
                    "coding": [{"system": "http://loinc.org", "code": "8480-6", "display": "Systolic blood pressure"}],
                    "text": "Systolic Blood Pressure",
                },
                "valueQuantity": {"value": 128, "unit": "mmHg"},
            },
        },
        headers=p_headers,
    )
    assert rec_resp.status_code == 201
    record_id = rec_resp.json()["id"]

    # Create doctor
    d_user = _create_user(db, "zk_doctor@test.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, d_user)
    d_headers = _auth_headers(d_user)

    # Doctor requests access
    req_resp = client.post(
        "/api/access-requests",
        json={
            "patient_id": patient.id,
            "record_id": record_id,
            "reason": "Diagnostic evaluation",
        },
        headers=d_headers,
    )
    assert req_resp.status_code == 201
    req_id = req_resp.json()["id"]

    # Patient approves request -> creates active consent
    appr_resp = client.patch(f"/api/access-requests/{req_id}/approve", headers=p_headers)
    assert appr_resp.status_code == 200

    return p_user, patient, record_id, p_headers, d_user, doctor, d_headers


# --- TEST 1: Valid Authorization Witness & Verification ---
def test_valid_zk_authorization_proof(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_with_consent(client, db)
    )

    # 1. Generate proof
    resp = client.post(
        "/api/zk/generate-proof",
        json={"record_id": record_id},
        headers=d_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "proof" in data
    assert "record_commitment" in data
    assert "authorization_commitment" in data
    assert "requester_nullifier" in data
    assert data["status"] == "generated"

    # 2. Verify proof
    v_resp = client.post(
        "/api/zk/verify",
        json={
            "proof": data["proof"],
            "record_commitment": data["record_commitment"],
            "authorization_commitment": data["authorization_commitment"],
            "requester_nullifier": data["requester_nullifier"],
        },
        headers=d_headers,
    )
    assert v_resp.status_code == 200
    v_data = v_resp.json()
    assert v_data["valid"] is True
    assert v_data["circuit_name"] == "authorization"
    assert v_data["nullifier"] == data["requester_nullifier"]
    assert "tx_hash" in v_data
    assert v_data["tx_hash"] is not None


# --- TEST 2: Wrong Secret / Tampered Proof Bytes Rejection ---
def test_invalid_zk_proof_rejected(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_with_consent(client, db)
    )

    gen_resp = client.post(
        "/api/zk/generate-proof",
        json={"record_id": record_id},
        headers=d_headers,
    )
    data = gen_resp.json()

    # Tampered proof bytes with invalid evaluation
    invalid_proof = "0x" + b"NOIR_PROOF_V1_BN254:".hex() + "00" * 64

    v_resp = client.post(
        "/api/zk/verify",
        json={
            "proof": invalid_proof,
            "record_commitment": data["record_commitment"],
            "authorization_commitment": data["authorization_commitment"],
            "requester_nullifier": data["requester_nullifier"],
        },
        headers=d_headers,
    )
    assert v_resp.status_code == 200
    assert v_resp.json()["valid"] is False
    assert "failed" in v_resp.json()["details"].lower() or "mismatch" in v_resp.json()["details"].lower()


# --- TEST 3: Tampered Record Commitment Rejection ---
def test_tampered_record_commitment_rejected(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_with_consent(client, db)
    )

    gen_resp = client.post(
        "/api/zk/generate-proof",
        json={"record_id": record_id},
        headers=d_headers,
    )
    data = gen_resp.json()

    # Modified record commitment bytes
    tampered_rec_commit = "0x" + "deadbeef" * 8

    v_resp = client.post(
        "/api/zk/verify",
        json={
            "proof": data["proof"],
            "record_commitment": tampered_rec_commit,
            "authorization_commitment": data["authorization_commitment"],
            "requester_nullifier": data["requester_nullifier"],
        },
        headers=d_headers,
    )
    assert v_resp.status_code == 200
    assert v_resp.json()["valid"] is False
    assert "failed" in v_resp.json()["details"].lower()


# --- TEST 4: Tampered Authorization Commitment Rejection ---
def test_tampered_authorization_commitment_rejected(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_with_consent(client, db)
    )

    gen_resp = client.post(
        "/api/zk/generate-proof",
        json={"record_id": record_id},
        headers=d_headers,
    )
    data = gen_resp.json()

    tampered_auth_commit = "0x" + "cafebebe" * 8

    v_resp = client.post(
        "/api/zk/verify",
        json={
            "proof": data["proof"],
            "record_commitment": data["record_commitment"],
            "authorization_commitment": tampered_auth_commit,
            "requester_nullifier": data["requester_nullifier"],
        },
        headers=d_headers,
    )
    assert v_resp.status_code == 200
    assert v_resp.json()["valid"] is False


# --- TEST 5: Tampered Nullifier Rejection ---
def test_tampered_nullifier_rejected(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_with_consent(client, db)
    )

    gen_resp = client.post(
        "/api/zk/generate-proof",
        json={"record_id": record_id},
        headers=d_headers,
    )
    data = gen_resp.json()

    tampered_nullifier = "0x" + "11223344" * 8

    v_resp = client.post(
        "/api/zk/verify",
        json={
            "proof": data["proof"],
            "record_commitment": data["record_commitment"],
            "authorization_commitment": data["authorization_commitment"],
            "requester_nullifier": tampered_nullifier,
        },
        headers=d_headers,
    )
    assert v_resp.status_code == 200
    assert v_resp.json()["valid"] is False


# --- TEST 6: Replayed Nullifier Rejection ---
def test_replayed_nullifier_rejected(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_with_consent(client, db)
    )

    gen_resp = client.post(
        "/api/zk/generate-proof",
        json={"record_id": record_id},
        headers=d_headers,
    )
    data = gen_resp.json()

    # First verification passes
    v_resp1 = client.post(
        "/api/zk/verify",
        json={
            "proof": data["proof"],
            "record_commitment": data["record_commitment"],
            "authorization_commitment": data["authorization_commitment"],
            "requester_nullifier": data["requester_nullifier"],
        },
        headers=d_headers,
    )
    assert v_resp1.status_code == 200
    assert v_resp1.json()["valid"] is True

    # Second submission with the same nullifier must fail (Replay Protection)
    v_resp2 = client.post(
        "/api/zk/verify",
        json={
            "proof": data["proof"],
            "record_commitment": data["record_commitment"],
            "authorization_commitment": data["authorization_commitment"],
            "requester_nullifier": data["requester_nullifier"],
        },
        headers=d_headers,
    )
    assert v_resp2.status_code == 200
    assert v_resp2.json()["valid"] is False
    assert "nullifier already used" in v_resp2.json()["details"].lower()


# --- TEST 7: Zero PII in Public Inputs ---
def test_zk_public_inputs_contain_zero_pii(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_with_consent(client, db)
    )

    resp = client.post(
        "/api/zk/generate-proof",
        json={"record_id": record_id},
        headers=d_headers,
    )
    data = resp.json()

    # Must contain only cryptographic commitments (0x + 64 hex chars)
    for field in ("record_commitment", "authorization_commitment", "requester_nullifier"):
        val = data[field]
        assert val.startswith("0x"), f"{field} must be hex-encoded"
        assert len(val) == 66, f"{field} must be 32-byte 0x-prefixed hex string"

    # Must NOT contain names, emails, UUIDs, or diagnosis
    raw_str = str(data)
    assert p_user.email not in raw_str
    assert d_user.email not in raw_str
    assert "Blood Count" not in raw_str
    assert "DiagnosticReport" not in raw_str


# --- TEST 8: Patient Cannot Generate Doctor Authorization Proof ---
def test_patient_cannot_generate_zk_proof(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_with_consent(client, db)
    )

    resp = client.post(
        "/api/zk/generate-proof",
        json={"record_id": record_id},
        headers=p_headers,
    )
    assert resp.status_code == 403


# --- TEST 9: Doctor Cannot Generate Proof Without Active Consent ---
def test_doctor_cannot_generate_proof_without_consent(client, db):
    p_user = _create_user(db, "zk_noconsent@test.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, p_user)
    rec_resp = client.post(
        "/api/records", json={"record_type": "lab_test"}, headers=_auth_headers(p_user)
    )
    record_id = rec_resp.json()["id"]

    d_user = _create_user(db, "zk_doc_noconsent@test.com", "pass12345678", "doctor")
    _create_doctor_profile(db, d_user)

    resp = client.post(
        "/api/zk/generate-proof",
        json={"record_id": record_id},
        headers=_auth_headers(d_user),
    )
    assert resp.status_code == 403
    assert "consent" in resp.json()["detail"].lower()


# --- TEST 10: Decrypted Retrieval Seamlessly Verifies ZK Proof ---
def test_decrypted_record_retrieval_with_zk_verification(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_with_consent(client, db)
    )

    # Doctor accesses decrypted record — backend performs ZK authorization proof check
    resp = client.get(f"/api/records/{record_id}/decrypted", headers=d_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == record_id
    assert data["integrity_verified"] is True
    assert data["fhir_data"]["resourceType"] == "Observation"


# --- TEST 11: ZK Subsystem Status ---
def test_zk_status_endpoint(client, db):
    resp = client.get("/api/zk/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["enabled"] is True
    assert data["circuit_name"] == "authorization"
    assert data["supported_curve"] == "BN254"

