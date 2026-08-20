from tests.conftest import (
    _auth_headers,
    _create_doctor_profile,
    _create_patient_profile,
    _create_user,
)
from app.services import storage_service


def test_complete_phase3_record_pipeline(client, db):
    """
    Test full Phase 3 privacy pipeline:
    1. Patient submits valid FHIR Observation
    2. Backend normalizes, hashes, encrypts with AES-256-GCM, stores blob
    3. Metadata is returned
    4. Database does NOT contain plaintext medical content
    5. Patient retrieves decrypted record and verifies integrity
    6. On-demand integrity verification succeeds
    """
    user = _create_user(db, "patient_phase3@example.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, user)
    headers = _auth_headers(user)

    fhir_payload = {
        "resourceType": "Observation",
        "status": "final",
        "code": {
            "coding": [{"system": "http://loinc.org", "code": "8480-6", "display": "Systolic blood pressure"}],
            "text": "Systolic Blood Pressure",
        },
        "valueQuantity": {"value": 128, "unit": "mmHg"},
    }

    # 1. Create Record
    resp = client.post(
        "/api/records",
        json={
            "record_type": "observation",
            "fhir_resource_type": "Observation",
            "fhir_data": fhir_payload,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    meta = resp.json()

    record_id = meta["id"]
    storage_ref = meta["encrypted_storage_ref"]
    record_hash = meta["record_hash"]

    assert meta["patient_id"] == patient.id
    assert meta["record_type"] == "observation"
    assert meta["fhir_resource_type"] == "Observation"
    assert storage_ref.startswith("local://")
    assert len(record_hash) == 64
    assert meta["encryption_version"] == "aes-256-gcm-v1"

    # 2. Verify encrypted file on disk contains ciphertext, not plaintext
    storage_svc = storage_service.get_storage_service()
    raw_disk_bytes = storage_svc.download(storage_ref)
    assert b"Systolic blood pressure" not in raw_disk_bytes
    assert b"128" not in raw_disk_bytes

    # 3. Retrieve Decrypted Record
    dec_resp = client.get(f"/api/records/{record_id}/decrypted", headers=headers)
    assert dec_resp.status_code == 200
    dec_data = dec_resp.json()

    assert dec_data["id"] == record_id
    assert dec_data["integrity_verified"] is True
    assert dec_data["fhir_data"]["resourceType"] == "Observation"
    assert dec_data["fhir_data"]["valueQuantity"]["value"] == 128

    # 4. On-demand Integrity Verification
    verify_resp = client.get(f"/api/records/{record_id}/verify", headers=headers)
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()
    assert v_data["integrity_verified"] is True
    assert v_data["status"] == "verified"
    assert v_data["stored_hash"] == record_hash
    assert v_data["recalculated_hash"] == record_hash


def test_doctor_creates_record_for_patient(client, db):
    """Verify that an authorized doctor can create a record for a patient."""
    patient_user = _create_user(db, "pat_for_doc@example.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, patient_user)

    doctor_user = _create_user(db, "doc_creator@example.com", "pass12345678", "doctor")
    _create_doctor_profile(db, doctor_user)

    fhir_condition = {
        "resourceType": "Condition",
        "clinicalStatus": "active",
        "code": {
            "text": "Type 2 Diabetes Mellitus",
        },
        "subject": {"reference": f"Patient/{patient.id}"},
    }

    doc_headers = _auth_headers(doctor_user)
    resp = client.post(
        "/api/records",
        json={
            "record_type": "condition",
            "fhir_resource_type": "Condition",
            "fhir_data": fhir_condition,
            "patient_id": patient.id,
        },
        headers=doc_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["patient_id"] == patient.id
    assert data["created_by_user_id"] == doctor_user.id


def test_tampered_storage_blob_fails_integrity(client, db):
    """Verify that tampering with the encrypted storage blob fails decryption and integrity checks."""
    user = _create_user(db, "tamper_test@example.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)

    resp = client.post(
        "/api/records",
        json={
            "record_type": "observation",
            "fhir_resource_type": "Observation",
            "fhir_data": {
                "resourceType": "Observation",
                "status": "final",
                "code": {"text": "Glucose Level"},
                "valueQuantity": {"value": 95, "unit": "mg/dL"},
            },
        },
        headers=headers,
    )
    record_id = resp.json()["id"]
    storage_ref = resp.json()["encrypted_storage_ref"]

    # Tamper with storage file on disk
    storage_svc = storage_service.get_storage_service()
    clean_bytes = bytearray(storage_svc.download(storage_ref))
    clean_bytes[-3] ^= 0xAA  # flip bits
    storage_svc.upload(bytes(clean_bytes), reference_id=storage_ref.replace("local://", "").replace(".enc", ""))

    # Attempting to retrieve decrypted record must fail
    dec_resp = client.get(f"/api/records/{record_id}/decrypted", headers=headers)
    assert dec_resp.status_code == 400
    assert "decryption failed" in dec_resp.json()["detail"].lower() or "integrity" in dec_resp.json()["detail"].lower()
