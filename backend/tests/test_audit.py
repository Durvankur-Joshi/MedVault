"""Tests 33–37: Audit logging."""

from tests.conftest import (
    _auth_headers,
    _create_doctor_profile,
    _create_patient_profile,
    _create_user,
)


# --- Test 33: Registration creates audit event ---
def test_registration_creates_audit_event(client, db):
    resp = client.post(
        "/api/auth/register",
        json={"email": "audit@reg.com", "password": "pass12345678", "role": "patient"},
    )
    user_id = resp.json()["id"]

    # Login to get JWT, then check audit
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "audit@reg.com", "password": "pass12345678"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    audit_resp = client.get("/api/audit", headers=headers)
    assert audit_resp.status_code == 200
    events = audit_resp.json()
    actions = [e["action"] for e in events]
    assert "user.registered" in actions


# --- Test 34: Record creation creates audit event ---
def test_record_creation_creates_audit_event(client, db):
    user = _create_user(db, "audit@rec.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)

    client.post("/api/records", json={"record_type": "lab_result"}, headers=headers)

    audit_resp = client.get("/api/audit", headers=headers)
    events = audit_resp.json()
    actions = [e["action"] for e in events]
    assert "record.created" in actions


# --- Test 35: Consent grant creates audit event ---
def test_consent_grant_creates_audit_event(client, db):
    user = _create_user(db, "audit@consent.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)

    rec_resp = client.post(
        "/api/records", json={"record_type": "lab_result"}, headers=headers
    )
    record_id = rec_resp.json()["id"]

    doctor_user = _create_user(db, "doc@audit.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, doctor_user)

    client.post(
        "/api/consent",
        json={
            "record_id": record_id,
            "permission": "read",
            "grantee_doctor_id": doctor.id,
        },
        headers=headers,
    )

    audit_resp = client.get("/api/audit", headers=headers)
    events = audit_resp.json()
    actions = [e["action"] for e in events]
    assert "consent.granted" in actions


# --- Test 36: Consent revoke creates audit event ---
def test_consent_revoke_creates_audit_event(client, db):
    user = _create_user(db, "audit@revoke.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)

    rec_resp = client.post(
        "/api/records", json={"record_type": "lab_result"}, headers=headers
    )
    record_id = rec_resp.json()["id"]

    doctor_user = _create_user(db, "doc@revoke.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, doctor_user)

    consent_resp = client.post(
        "/api/consent",
        json={
            "record_id": record_id,
            "permission": "read",
            "grantee_doctor_id": doctor.id,
        },
        headers=headers,
    )
    consent_id = consent_resp.json()["id"]

    client.patch(f"/api/consent/{consent_id}/revoke", headers=headers)

    audit_resp = client.get("/api/audit", headers=headers)
    events = audit_resp.json()
    actions = [e["action"] for e in events]
    assert "consent.revoked" in actions


# --- Test 37: Access request creates audit event ---
def test_access_request_creates_audit_event(client, db):
    patient_user = _create_user(db, "patient@auditreq.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, patient_user)
    doctor_user = _create_user(db, "doctor@auditreq.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, doctor_user)

    client.post(
        "/api/access-requests",
        json={"patient_id": patient.id},
        headers=_auth_headers(doctor_user),
    )

    audit_resp = client.get("/api/audit", headers=_auth_headers(doctor_user))
    events = audit_resp.json()
    actions = [e["action"] for e in events]
    assert "access.requested" in actions
