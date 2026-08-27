"""Tests 21–25: Consent management."""

from datetime import datetime, timedelta, timezone

from tests.conftest import (
    _auth_headers,
    _create_doctor_profile,
    _create_patient_profile,
    _create_user,
)


def _setup_patient_with_record(client, db):
    """Helper: create patient, create a record, return (user, patient, record_id, headers)."""
    user = _create_user(db, "patient@consent.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, user)
    headers = _auth_headers(user)
    resp = client.post(
        "/api/records", json={"record_type": "lab_result"}, headers=headers
    )
    return user, patient, resp.json()["id"], headers


# --- Test 21: Patient grants consent ---
def test_patient_grants_consent(client, db):
    user, patient, record_id, headers = _setup_patient_with_record(client, db)
    doctor_user = _create_user(db, "doctor@consent.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, doctor_user)

    resp = client.post(
        "/api/consent",
        json={
            "record_id": record_id,
            "permission": "read",
            "grantee_doctor_id": doctor.id,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "active"
    assert data["permission"] == "read"
    assert data["record_id"] == record_id
    assert data["grantee_doctor_id"] == doctor.id


# --- Test 22: Another patient cannot grant consent for someone else's record ---
def test_another_patient_cannot_grant_consent(client, db):
    user1, _, record_id, _ = _setup_patient_with_record(client, db)
    user2 = _create_user(db, "patient2@consent.com", "pass12345678", "patient")
    _create_patient_profile(db, user2)
    doctor_user = _create_user(db, "doctor2@consent.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, doctor_user)

    resp = client.post(
        "/api/consent",
        json={
            "record_id": record_id,
            "permission": "read",
            "grantee_doctor_id": doctor.id,
        },
        headers=_auth_headers(user2),
    )
    assert resp.status_code == 403


# --- Test 23: Patient revokes consent ---
def test_patient_revokes_consent(client, db):
    user, patient, record_id, headers = _setup_patient_with_record(client, db)
    doctor_user = _create_user(db, "doctor@revoke.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, doctor_user)

    create_resp = client.post(
        "/api/consent",
        json={
            "record_id": record_id,
            "permission": "read",
            "grantee_doctor_id": doctor.id,
        },
        headers=headers,
    )
    consent_id = create_resp.json()["id"]

    resp = client.patch(f"/api/consent/{consent_id}/revoke", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "revoked"


# --- Test 24: Expired consent is not considered active ---
def test_expired_consent_not_active(client, db):
    user, patient, record_id, headers = _setup_patient_with_record(client, db)
    doctor_user = _create_user(db, "doctor@expire.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, doctor_user)

    # Create consent that expired in the past
    resp = client.post(
        "/api/consent",
        json={
            "record_id": record_id,
            "permission": "read",
            "grantee_doctor_id": doctor.id,
            "expires_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
        },
        headers=headers,
    )
    assert resp.status_code == 201

    # Doctor should NOT be able to access the record (expired consent)
    resp = client.get(
        f"/api/records/{record_id}", headers=_auth_headers(doctor_user)
    )
    assert resp.status_code == 403


# --- Test 25: Unauthorized user cannot revoke consent ---
def test_unauthorized_cannot_revoke_consent(client, db):
    user, patient, record_id, headers = _setup_patient_with_record(client, db)
    doctor_user = _create_user(db, "doctor@unauth.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, doctor_user)

    create_resp = client.post(
        "/api/consent",
        json={
            "record_id": record_id,
            "permission": "read",
            "grantee_doctor_id": doctor.id,
        },
        headers=headers,
    )
    consent_id = create_resp.json()["id"]

    # Another patient tries to revoke
    user2 = _create_user(db, "patient2@unauth.com", "pass12345678", "patient")
    _create_patient_profile(db, user2)
    resp = client.patch(
        f"/api/consent/{consent_id}/revoke", headers=_auth_headers(user2)
    )
    assert resp.status_code == 403


# --- Test 26: Patient grants consent with client on-chain transaction hash ---
def test_patient_grants_consent_with_real_tx_hash(client, db):
    user, patient, record_id, headers = _setup_patient_with_record(client, db)
    doctor_user = _create_user(db, "doctor_tx@consent.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, doctor_user)

    real_tx_hash = "0x" + "a" * 64
    resp = client.post(
        "/api/consent",
        json={
            "record_id": record_id,
            "permission": "read",
            "grantee_doctor_id": doctor.id,
            "blockchain_tx_hash": real_tx_hash,
            "blockchain_network": "Sepolia",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["blockchain_tx_hash"] == real_tx_hash
    assert data["blockchain_network"] == "Sepolia"


# --- Test 27: Patient revokes consent with client on-chain transaction hash ---
def test_patient_revokes_consent_with_real_tx_hash(client, db):
    user, patient, record_id, headers = _setup_patient_with_record(client, db)
    doctor_user = _create_user(db, "doctor_revtx@consent.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, doctor_user)

    grant_tx_hash = "0x" + "b" * 64
    create_resp = client.post(
        "/api/consent",
        json={
            "record_id": record_id,
            "permission": "read",
            "grantee_doctor_id": doctor.id,
            "blockchain_tx_hash": grant_tx_hash,
        },
        headers=headers,
    )
    consent_id = create_resp.json()["id"]

    revoke_tx_hash = "0x" + "c" * 64
    revoke_resp = client.patch(
        f"/api/consent/{consent_id}/revoke",
        json={"blockchain_tx_hash": revoke_tx_hash},
        headers=headers,
    )
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["status"] == "revoked"
    assert revoke_resp.json()["blockchain_tx_hash"] == revoke_tx_hash

