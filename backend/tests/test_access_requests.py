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


# --- Test 33: Doctor profile exists -> 201 and requester_doctor_id == doctor.id ---
def test_doctor_profile_resolution_existing_doctor(client, db):
    from app.models.doctor import Doctor

    p_user = _create_user(db, "p_step8@test.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, p_user)
    rec_resp = client.post(
        "/api/records", json={"record_type": "prescription"}, headers=_auth_headers(p_user)
    )
    record_id = rec_resp.json()["id"]

    doc_user = _create_user(db, "doc_step8@test.com", "pass12345678", "doctor")
    doc_profile = _create_doctor_profile(db, doc_user)

    resp = client.post(
        "/api/access-requests",
        json={
            "patient_id": patient.id,
            "record_id": record_id,
            "reason": "Treatment review",
        },
        headers=_auth_headers(doc_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["requester_doctor_id"] == doc_profile.id
    assert data["status"] == "pending"


# --- Test 34: Doctor user exists without profile -> auto-provisions profile -> 201 ---
def test_doctor_profile_auto_provisioning_on_request(client, db):
    from app.models.doctor import Doctor

    p_user = _create_user(db, "p_noprof@test.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, p_user)
    rec_resp = client.post(
        "/api/records", json={"record_type": "blood_report"}, headers=_auth_headers(p_user)
    )
    record_id = rec_resp.json()["id"]

    # Create doctor user directly without doctor profile
    doc_user = _create_user(db, "doc_noprof@test.com", "pass12345678", "doctor")
    assert db.query(Doctor).filter(Doctor.user_id == doc_user.id).first() is None

    resp = client.post(
        "/api/access-requests",
        json={
            "patient_id": patient.id,
            "record_id": record_id,
            "reason": "Need blood report",
        },
        headers=_auth_headers(doc_user),
    )
    assert resp.status_code == 201
    data = resp.json()

    # Profile should now exist and be linked to the access request
    created_doc = db.query(Doctor).filter(Doctor.user_id == doc_user.id).first()
    assert created_doc is not None
    assert data["requester_doctor_id"] == created_doc.id


# --- Test 35: Idempotency: Multiple requests do not create duplicate doctor profiles ---
def test_doctor_profile_provisioning_is_idempotent(client, db):
    from app.models.doctor import Doctor

    p_user = _create_user(db, "p_idem@test.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, p_user)
    rec_resp = client.post(
        "/api/records", json={"record_type": "x_ray"}, headers=_auth_headers(p_user)
    )
    record_id = rec_resp.json()["id"]

    doc_user = _create_user(db, "doc_idem@test.com", "pass12345678", "doctor")
    headers = _auth_headers(doc_user)

    # First request
    resp1 = client.post(
        "/api/access-requests",
        json={"patient_id": patient.id, "record_id": record_id, "reason": "First request"},
        headers=headers,
    )
    assert resp1.status_code == 201

    # Second request
    resp2 = client.post(
        "/api/access-requests",
        json={"patient_id": patient.id, "record_id": record_id, "reason": "Second request"},
        headers=headers,
    )
    assert resp2.status_code == 201

    # Verify exactly ONE doctor profile exists for doc_user
    doc_profiles = db.query(Doctor).filter(Doctor.user_id == doc_user.id).all()
    assert len(doc_profiles) == 1


# --- Test 36: Patient attempts to create access request -> 403 Forbidden ---
def test_patient_cannot_create_access_request(client, db):
    p1 = _create_user(db, "p_req1@test.com", "pass12345678", "patient")
    _create_patient_profile(db, p1)

    p2 = _create_user(db, "p_req2@test.com", "pass12345678", "patient")
    pat2 = _create_patient_profile(db, p2)

    resp = client.post(
        "/api/access-requests",
        json={"patient_id": pat2.id, "reason": "Unauthorized attempt"},
        headers=_auth_headers(p1),
    )
    assert resp.status_code == 403


# --- Test 37: Doctor requests record belonging to another patient -> 400 Bad Request ---
def test_doctor_requests_mismatched_patient_record(client, db):
    p1 = _create_user(db, "p_owner@test.com", "pass12345678", "patient")
    pat1 = _create_patient_profile(db, p1)
    rec_resp = client.post(
        "/api/records", json={"record_type": "report1"}, headers=_auth_headers(p1)
    )
    record1_id = rec_resp.json()["id"]

    p2 = _create_user(db, "p_other@test.com", "pass12345678", "patient")
    pat2 = _create_patient_profile(db, p2)

    doc_user = _create_user(db, "doc_mismatch@test.com", "pass12345678", "doctor")
    _create_doctor_profile(db, doc_user)

    # Doctor asks for patient2 with patient1's record
    resp = client.post(
        "/api/access-requests",
        json={"patient_id": pat2.id, "record_id": record1_id, "reason": "Mismatch test"},
        headers=_auth_headers(doc_user),
    )
    assert resp.status_code == 400
    assert "does not belong" in resp.json()["detail"]


# --- Test 38: Doctor requests nonexistent record -> 404 Not Found ---
def test_doctor_requests_nonexistent_record(client, db):
    p = _create_user(db, "p_rec404@test.com", "pass12345678", "patient")
    pat = _create_patient_profile(db, p)

    doc = _create_user(db, "doc_rec404@test.com", "pass12345678", "doctor")
    _create_doctor_profile(db, doc)

    resp = client.post(
        "/api/access-requests",
        json={
            "patient_id": pat.id,
            "record_id": "00000000-0000-0000-0000-000000000000",
            "reason": "Nonexistent record",
        },
        headers=_auth_headers(doc),
    )
    assert resp.status_code == 404
    assert "Record not found" in resp.json()["detail"]


# --- Test 39: Doctor requests nonexistent patient -> 404 Not Found ---
def test_doctor_requests_nonexistent_patient(client, db):
    doc = _create_user(db, "doc_pat404@test.com", "pass12345678", "doctor")
    _create_doctor_profile(db, doc)

    resp = client.post(
        "/api/access-requests",
        json={
            "patient_id": "00000000-0000-0000-0000-000000000000",
            "reason": "Nonexistent patient",
        },
        headers=_auth_headers(doc),
    )
    assert resp.status_code == 404
    assert "Patient not found" in resp.json()["detail"]

