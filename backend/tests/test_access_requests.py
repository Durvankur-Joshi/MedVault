"""Tests 26–32: Access request management."""

from tests.conftest import (
    _auth_headers,
    _create_doctor_profile,
    _create_patient_profile,
    _create_user,
)


def _setup_patient_doctor_record(client, db):
    """Helper: create patient + record + doctor, return all."""
    patient_user = _create_user(db, "patient@ar.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, patient_user)
    patient_headers = _auth_headers(patient_user)

    resp = client.post(
        "/api/records", json={"record_type": "lab_result"}, headers=patient_headers
    )
    record_id = resp.json()["id"]

    doctor_user = _create_user(db, "doctor@ar.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, doctor_user)
    doctor_headers = _auth_headers(doctor_user)

    return patient_user, patient, record_id, patient_headers, doctor_user, doctor, doctor_headers


# --- Test 26: Doctor creates access request ---
def test_doctor_creates_request(client, db):
    p_user, patient, record_id, _, d_user, doctor, d_headers = (
        _setup_patient_doctor_record(client, db)
    )

    resp = client.post(
        "/api/access-requests",
        json={
            "patient_id": patient.id,
            "record_id": record_id,
            "reason": "Need lab results for treatment",
        },
        headers=d_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    assert data["patient_id"] == patient.id


# --- Test 27: Patient sees request ---
def test_patient_sees_request(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_record(client, db)
    )

    client.post(
        "/api/access-requests",
        json={"patient_id": patient.id, "record_id": record_id},
        headers=d_headers,
    )

    resp = client.get("/api/access-requests", headers=p_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


# --- Test 28: Patient approves request ---
def test_patient_approves_request(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_record(client, db)
    )

    create_resp = client.post(
        "/api/access-requests",
        json={"patient_id": patient.id, "record_id": record_id},
        headers=d_headers,
    )
    req_id = create_resp.json()["id"]

    resp = client.patch(f"/api/access-requests/{req_id}/approve", headers=p_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


# --- Test 29: Approval creates consent ---
def test_approval_creates_consent(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_record(client, db)
    )

    create_resp = client.post(
        "/api/access-requests",
        json={"patient_id": patient.id, "record_id": record_id},
        headers=d_headers,
    )
    req_id = create_resp.json()["id"]

    # Approve
    client.patch(f"/api/access-requests/{req_id}/approve", headers=p_headers)

    # Check that consent was created
    resp = client.get("/api/consent", headers=p_headers)
    assert resp.status_code == 200
    consents = resp.json()
    assert len(consents) >= 1
    assert any(c["record_id"] == record_id for c in consents)


# --- Test 30: Patient denies request ---
def test_patient_denies_request(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_record(client, db)
    )

    create_resp = client.post(
        "/api/access-requests",
        json={"patient_id": patient.id, "record_id": record_id},
        headers=d_headers,
    )
    req_id = create_resp.json()["id"]

    resp = client.patch(f"/api/access-requests/{req_id}/deny", headers=p_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "denied"


# --- Test 31: Denial does not create consent ---
def test_denial_does_not_create_consent(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_record(client, db)
    )

    create_resp = client.post(
        "/api/access-requests",
        json={"patient_id": patient.id, "record_id": record_id},
        headers=d_headers,
    )
    req_id = create_resp.json()["id"]

    # Deny
    client.patch(f"/api/access-requests/{req_id}/deny", headers=p_headers)

    # No consent should exist for this record
    resp = client.get("/api/consent", headers=p_headers)
    consents = resp.json()
    assert not any(c["record_id"] == record_id for c in consents)


# --- Test 32: Unauthorized user cannot approve ---
def test_unauthorized_cannot_approve(client, db):
    p_user, patient, record_id, p_headers, d_user, doctor, d_headers = (
        _setup_patient_doctor_record(client, db)
    )

    create_resp = client.post(
        "/api/access-requests",
        json={"patient_id": patient.id, "record_id": record_id},
        headers=d_headers,
    )
    req_id = create_resp.json()["id"]

    # Another patient tries to approve
    other = _create_user(db, "other@ar.com", "pass12345678", "patient")
    _create_patient_profile(db, other)

    resp = client.patch(
        f"/api/access-requests/{req_id}/approve", headers=_auth_headers(other)
    )
    assert resp.status_code == 403
