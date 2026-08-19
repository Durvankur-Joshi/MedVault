"""Tests 14–20: Medical record CRUD and authorization."""

from tests.conftest import (
    _auth_headers,
    _create_doctor_profile,
    _create_patient_profile,
    _create_user,
)


# --- Test 14: Patient creates own record ---
def test_patient_creates_record(client, db):
    user = _create_user(db, "patient@rec.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)

    resp = client.post(
        "/api/records",
        json={"record_type": "lab_result", "fhir_resource_type": "Observation"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["record_type"] == "lab_result"
    assert data["fhir_resource_type"] == "Observation"
    assert "id" in data


# --- Test 15: Patient lists own records ---
def test_patient_lists_own_records(client, db):
    user = _create_user(db, "patient@list.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)

    # Create two records
    client.post("/api/records", json={"record_type": "lab_result"}, headers=headers)
    client.post("/api/records", json={"record_type": "prescription"}, headers=headers)

    resp = client.get("/api/records", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


# --- Test 16: Patient retrieves own record ---
def test_patient_gets_own_record(client, db):
    user = _create_user(db, "patient@get.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)

    create_resp = client.post(
        "/api/records", json={"record_type": "imaging"}, headers=headers
    )
    record_id = create_resp.json()["id"]

    resp = client.get(f"/api/records/{record_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == record_id


# --- Test 17: Patient cannot access another patient's record ---
def test_patient_cannot_access_other_patients_record(client, db):
    user1 = _create_user(db, "patient1@cross.com", "pass12345678", "patient")
    _create_patient_profile(db, user1)
    user2 = _create_user(db, "patient2@cross.com", "pass12345678", "patient")
    _create_patient_profile(db, user2)

    # User1 creates a record
    create_resp = client.post(
        "/api/records",
        json={"record_type": "lab_result"},
        headers=_auth_headers(user1),
    )
    record_id = create_resp.json()["id"]

    # User2 tries to access it
    resp = client.get(f"/api/records/{record_id}", headers=_auth_headers(user2))
    assert resp.status_code == 403


# --- Test 18: Unauthorized doctor cannot access patient record ---
def test_unauthorized_doctor_cannot_access_record(client, db):
    patient_user = _create_user(db, "patient@doc.com", "pass12345678", "patient")
    _create_patient_profile(db, patient_user)
    doctor_user = _create_user(db, "doctor@doc.com", "pass12345678", "doctor")
    _create_doctor_profile(db, doctor_user)

    # Patient creates record
    create_resp = client.post(
        "/api/records",
        json={"record_type": "lab_result"},
        headers=_auth_headers(patient_user),
    )
    record_id = create_resp.json()["id"]

    # Doctor tries to access without consent
    resp = client.get(
        f"/api/records/{record_id}", headers=_auth_headers(doctor_user)
    )
    assert resp.status_code == 403
    assert "No active consent" in resp.json()["detail"]


# --- Test 19: Delete own record ---
def test_patient_deletes_own_record(client, db):
    user = _create_user(db, "patient@del.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)

    create_resp = client.post(
        "/api/records", json={"record_type": "lab_result"}, headers=headers
    )
    record_id = create_resp.json()["id"]

    resp = client.delete(f"/api/records/{record_id}", headers=headers)
    assert resp.status_code == 204

    # Verify it's gone
    resp = client.get(f"/api/records/{record_id}", headers=headers)
    assert resp.status_code == 404


# --- Test 20: Cannot delete another patient's record ---
def test_cannot_delete_other_patients_record(client, db):
    user1 = _create_user(db, "patient1@deldeny.com", "pass12345678", "patient")
    _create_patient_profile(db, user1)
    user2 = _create_user(db, "patient2@deldeny.com", "pass12345678", "patient")
    _create_patient_profile(db, user2)

    create_resp = client.post(
        "/api/records",
        json={"record_type": "lab_result"},
        headers=_auth_headers(user1),
    )
    record_id = create_resp.json()["id"]

    resp = client.delete(
        f"/api/records/{record_id}", headers=_auth_headers(user2)
    )
    assert resp.status_code == 403
