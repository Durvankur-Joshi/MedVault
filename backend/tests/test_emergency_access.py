"""
Tests for Phase 6: Emergency Break-Glass Access Protocol.
"""

from tests.conftest import (
    _auth_headers,
    _create_doctor_profile,
    _create_patient_profile,
    _create_user,
)


def test_emergency_access_lifecycle(client, db):
    # 1. Create Patient + Record
    patient_user = _create_user(db, "emergency.pat@test.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, patient_user)
    pat_headers = _auth_headers(patient_user)

    rec_resp = client.post(
        "/api/records",
        json={"record_type": "observation", "fhir_resource_type": "Observation"},
        headers=pat_headers,
    )
    assert rec_resp.status_code == 201
    record_id = rec_resp.json()["id"]

    # 2. Create Doctor
    doctor_user = _create_user(db, "emergency.doc@test.com", "pass12345678", "doctor")
    _create_doctor_profile(db, doctor_user)
    doc_headers = _auth_headers(doctor_user)

    # 3. Doctor requests emergency access
    emerg_resp = client.post(
        "/api/emergency-access",
        json={
            "patient_id": patient.id,
            "record_id": record_id,
            "reason": "Patient unconscious in ER with acute chest pain, immediate medical history required",
        },
        headers=doc_headers,
    )
    assert emerg_resp.status_code == 201
    emerg_data = emerg_resp.json()
    assert emerg_data["status"] == "active"
    assert emerg_data["permission"] == "read"
    assert emerg_data["record_id"] == record_id
    assert emerg_data["audit_event_logged"] is True
    assert emerg_data["blockchain_tx_hash"] is not None

    # 4. Doctor can now retrieve and decrypt the medical record
    detail_resp = client.get(f"/api/records/{record_id}/decrypted", headers=doc_headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["integrity_verified"] is True

    # 5. Verify explicit emergency audit events are present
    audit_resp = client.get("/api/audit", headers=doc_headers)
    assert audit_resp.status_code == 200
    actions = [e["action"] for e in audit_resp.json()]
    assert "emergency.requested" in actions
    assert "emergency.granted" in actions


def test_patient_cannot_trigger_emergency_access(client, db):
    patient_user = _create_user(db, "pat.emerg.fail@test.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, patient_user)
    pat_headers = _auth_headers(patient_user)

    rec_resp = client.post(
        "/api/records",
        json={"record_type": "observation"},
        headers=pat_headers,
    )
    record_id = rec_resp.json()["id"]

    # Patient trying to call emergency-access -> 403 Forbidden
    emerg_resp = client.post(
        "/api/emergency-access",
        json={
            "patient_id": patient.id,
            "record_id": record_id,
            "reason": "Self request invalid",
        },
        headers=pat_headers,
    )
    assert emerg_resp.status_code == 403


def test_emergency_access_fails_for_mismatched_record(client, db):
    pat1_user = _create_user(db, "pat1.em@test.com", "pass12345678", "patient")
    _create_patient_profile(db, pat1_user)

    pat2_user = _create_user(db, "pat2.em@test.com", "pass12345678", "patient")
    pat2 = _create_patient_profile(db, pat2_user)

    # pat1 creates record
    rec_resp = client.post(
        "/api/records",
        json={"record_type": "observation"},
        headers=_auth_headers(pat1_user),
    )
    record_id = rec_resp.json()["id"]

    doc_user = _create_user(db, "doc.em.fail@test.com", "pass12345678", "doctor")
    _create_doctor_profile(db, doc_user)

    # Doctor requests access with pat2's id for pat1's record -> 400 Bad Request
    emerg_resp = client.post(
        "/api/emergency-access",
        json={
            "patient_id": pat2.id,
            "record_id": record_id,
            "reason": "Mismatched patient test",
        },
        headers=_auth_headers(doc_user),
    )
    assert emerg_resp.status_code == 400
