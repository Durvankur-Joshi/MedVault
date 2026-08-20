"""Tests for patient search and record metadata endpoints."""

from app.models.medical_record import MedicalRecord
from tests.conftest import (
    _auth_headers,
    _create_doctor_profile,
    _create_patient_profile,
    _create_user,
)


# ──────────────────────────────────────────────────────────────
# Patient Search — GET /api/patients/search?q=...
# ──────────────────────────────────────────────────────────────


def test_search_patients_by_name(client, db):
    """Doctor can search patients by display name (case-insensitive)."""
    doctor_user = _create_user(db, "doc@test.com", "pass123", "doctor")
    _create_doctor_profile(db, doctor_user)

    p1_user = _create_user(db, "rahul@test.com", "pass123", "patient")
    p1 = _create_patient_profile(db, p1_user)
    # Set a human-readable display name
    p1.display_name = "Rahul Sharma"
    db.commit()

    p2_user = _create_user(db, "priya@test.com", "pass123", "patient")
    p2 = _create_patient_profile(db, p2_user)
    p2.display_name = "Priya Patel"
    db.commit()

    headers = _auth_headers(doctor_user)

    # Search for "rahul" (case-insensitive)
    resp = client.get("/api/patients/search?q=rahul", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["display_name"] == "Rahul Sharma"
    assert data[0]["id"] == p1.id

    # Search for "a" matches both (but query too short — min 2 chars)
    resp2 = client.get("/api/patients/search?q=a", headers=headers)
    assert resp2.status_code == 422  # FastAPI query validation

    # Search for "pr" (partial match)
    resp3 = client.get("/api/patients/search?q=pr", headers=headers)
    assert resp3.status_code == 200
    assert len(resp3.json()) == 1
    assert resp3.json()[0]["display_name"] == "Priya Patel"


def test_search_patients_no_pii_exposure(client, db):
    """Search results must contain ONLY id and display_name — no email, no address."""
    doctor_user = _create_user(db, "doc2@test.com", "pass123", "doctor")
    _create_doctor_profile(db, doctor_user)

    p_user = _create_user(db, "sensitive@test.com", "pass123", "patient")
    p = _create_patient_profile(db, p_user)
    p.display_name = "Sensitive Patient"
    db.commit()

    headers = _auth_headers(doctor_user)
    resp = client.get("/api/patients/search?q=Sensitive", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    result = data[0]

    # Only id and display_name should be present
    assert set(result.keys()) == {"id", "display_name"}
    # Ensure email is NOT in the response
    assert "email" not in result
    assert "sensitive@test.com" not in str(result)


def test_search_patients_forbidden_for_patient_role(client, db):
    """Patient role should be forbidden from searching other patients."""
    patient_user = _create_user(db, "patient1@test.com", "pass123", "patient")
    _create_patient_profile(db, patient_user)

    headers = _auth_headers(patient_user)
    resp = client.get("/api/patients/search?q=test", headers=headers)
    assert resp.status_code == 403


def test_search_patients_unauthenticated(client, db):
    """Unauthenticated requests must return 401."""
    resp = client.get("/api/patients/search?q=test")
    assert resp.status_code == 401


def test_search_patients_no_results(client, db):
    """Search with no matches returns empty list."""
    doctor_user = _create_user(db, "doc3@test.com", "pass123", "doctor")
    _create_doctor_profile(db, doctor_user)

    headers = _auth_headers(doctor_user)
    resp = client.get("/api/patients/search?q=zzzznonexistent", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


# ──────────────────────────────────────────────────────────────
# Patient Records — GET /api/patients/{patient_id}/records
# ──────────────────────────────────────────────────────────────


def test_get_patient_records_metadata(client, db):
    """Doctor can list non-sensitive record metadata for a patient."""
    doctor_user = _create_user(db, "doc4@test.com", "pass123", "doctor")
    _create_doctor_profile(db, doctor_user)

    p_user = _create_user(db, "patient4@test.com", "pass123", "patient")
    patient = _create_patient_profile(db, p_user)

    import uuid

    # Create a test medical record
    record = MedicalRecord(
        id=str(uuid.uuid4()),
        patient_id=patient.id,
        record_type="observation",
        fhir_resource_type="Observation",
        encrypted_storage_ref="local://secret_path.enc",
        record_hash="abc123hash",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    headers = _auth_headers(doctor_user)
    resp = client.get(f"/api/patients/{patient.id}/records", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    rec = data[0]
    assert rec["id"] == record.id
    assert rec["record_type"] == "observation"
    assert rec["fhir_resource_type"] == "Observation"
    assert "created_at" in rec

    # Must NOT expose sensitive fields
    assert "encrypted_storage_ref" not in rec
    assert "record_hash" not in rec
    assert "encryption_version" not in rec
    assert "storage_provider" not in rec


def test_get_patient_records_not_found(client, db):
    """Non-existent patient_id should return 404."""
    doctor_user = _create_user(db, "doc5@test.com", "pass123", "doctor")
    _create_doctor_profile(db, doctor_user)

    headers = _auth_headers(doctor_user)
    resp = client.get(
        "/api/patients/00000000-0000-0000-0000-000000000000/records",
        headers=headers,
    )
    assert resp.status_code == 404


def test_get_patient_records_forbidden_for_patient(client, db):
    """Patient role should be forbidden from listing another patient's records via this endpoint."""
    patient_user = _create_user(db, "patient5@test.com", "pass123", "patient")
    patient = _create_patient_profile(db, patient_user)

    headers = _auth_headers(patient_user)
    resp = client.get(f"/api/patients/{patient.id}/records", headers=headers)
    assert resp.status_code == 403
