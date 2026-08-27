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


# --- Test 23: Patient deletes record with active consent (Cascades without IntegrityError) ---
def test_patient_deletes_record_with_active_consent(client, db):
    # Patient setup
    p_user = _create_user(db, "p_del_consent@test.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, p_user)
    p_headers = _auth_headers(p_user)

    # Doctor setup
    d_user = _create_user(db, "d_del_consent@test.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, d_user)

    # Create record
    rec_resp = client.post(
        "/api/records",
        json={"record_type": "prescription", "fhir_resource_type": "MedicationRequest"},
        headers=p_headers,
    )
    assert rec_resp.status_code == 201
    record_id = rec_resp.json()["id"]

    # Grant consent for this record
    consent_resp = client.post(
        "/api/consent",
        json={
            "record_id": record_id,
            "grantee_doctor_id": doctor.id,
            "permission": "read",
        },
        headers=p_headers,
    )
    assert consent_resp.status_code == 201
    consent_id = consent_resp.json()["id"]

    # Verify consent exists
    list_consent = client.get("/api/consent", headers=p_headers)
    assert any(c["id"] == consent_id for c in list_consent.json())

    # Delete medical record — must cascade and NOT fail with NotNullViolation on record_id
    del_resp = client.delete(f"/api/records/{record_id}", headers=p_headers)
    assert del_resp.status_code == 204

    # Verify record is gone
    get_rec = client.get(f"/api/records/{record_id}", headers=p_headers)
    assert get_rec.status_code == 404

    # Verify dependent consent is cleanly removed and not orphaned
    list_consent_after = client.get("/api/consent", headers=p_headers)
    assert not any(c["id"] == consent_id for c in list_consent_after.json())
    assert not any(c["record_id"] == record_id for c in list_consent_after.json())


# --- Test 24: Patient deletes record with multiple consents (active + revoked) ---
def test_patient_deletes_record_with_multiple_consents(client, db):
    # Patient setup
    p_user = _create_user(db, "p_del_multi@test.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, p_user)
    p_headers = _auth_headers(p_user)

    # Doctor 1 & Doctor 2
    d_user1 = _create_user(db, "d1_del_multi@test.com", "pass12345678", "doctor")
    doc1 = _create_doctor_profile(db, d_user1)
    d_user2 = _create_user(db, "d2_del_multi@test.com", "pass12345678", "doctor")
    doc2 = _create_doctor_profile(db, d_user2)

    # Create target record and an unrelated record
    rec_resp = client.post("/api/records", json={"record_type": "lab_result"}, headers=p_headers)
    record_id = rec_resp.json()["id"]

    unrelated_rec_resp = client.post("/api/records", json={"record_type": "imaging"}, headers=p_headers)
    unrelated_record_id = unrelated_rec_resp.json()["id"]

    # Consents on target record
    c1 = client.post(
        "/api/consent",
        json={"record_id": record_id, "grantee_doctor_id": doc1.id, "permission": "read"},
        headers=p_headers,
    ).json()["id"]
    c2 = client.post(
        "/api/consent",
        json={"record_id": record_id, "grantee_doctor_id": doc2.id, "permission": "write"},
        headers=p_headers,
    ).json()["id"]
    # Revoke c2
    client.post(f"/api/consent/{c2}/revoke", headers=p_headers)

    # Consent on unrelated record
    unrelated_consent_id = client.post(
        "/api/consent",
        json={"record_id": unrelated_record_id, "grantee_doctor_id": doc1.id, "permission": "read"},
        headers=p_headers,
    ).json()["id"]

    # Delete target record
    del_resp = client.delete(f"/api/records/{record_id}", headers=p_headers)
    assert del_resp.status_code == 204

    # Target record is deleted
    assert client.get(f"/api/records/{record_id}", headers=p_headers).status_code == 404

    # Target record's consents are cleanly removed
    remaining_consents = client.get("/api/consent", headers=p_headers).json()
    remaining_ids = {c["id"] for c in remaining_consents}
    assert c1 not in remaining_ids
    assert c2 not in remaining_ids

    # Unrelated record and its consent remain completely intact
    assert client.get(f"/api/records/{unrelated_record_id}", headers=p_headers).status_code == 200
    assert unrelated_consent_id in remaining_ids


# --- Test 25: Patient deletes record with associated access request ---
def test_patient_deletes_record_with_access_request(client, db):
    p_user = _create_user(db, "p_del_req@test.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, p_user)
    p_headers = _auth_headers(p_user)

    d_user = _create_user(db, "d_del_req@test.com", "pass12345678", "doctor")
    doc = _create_doctor_profile(db, d_user)
    d_headers = _auth_headers(d_user)

    rec_resp = client.post("/api/records", json={"record_type": "observation"}, headers=p_headers)
    record_id = rec_resp.json()["id"]

    # Doctor creates access request for this record
    req_resp = client.post(
        "/api/access-requests",
        json={"patient_id": patient.id, "record_id": record_id, "reason": "Pre-op review"},
        headers=d_headers,
    )
    req_id = req_resp.json()["id"]

    # Patient approves request -> creates consent
    client.patch(f"/api/access-requests/{req_id}/approve", headers=p_headers)

    # Delete medical record
    del_resp = client.delete(f"/api/records/{record_id}", headers=p_headers)
    assert del_resp.status_code == 204

    # Record and associated access request are safely deleted
    assert client.get(f"/api/records/{record_id}", headers=p_headers).status_code == 404
    req_list = client.get("/api/access-requests", headers=d_headers).json()
    assert not any(r["id"] == req_id for r in req_list)



# --- Test 21: Decrypted binary document retrieval succeeds as DocumentReference ---
def test_decrypted_binary_document_retrieval(client, db):
    user = _create_user(db, "patient_doc@test.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)

    # Upload a binary PDF document
    pdf_bytes = b"%PDF-1.4 \x00\xff binary medical scan content \xfe\xdc"
    files = {"file": ("scan_report.pdf", pdf_bytes, "application/pdf")}
    data = {"record_type": "document"}
    upload_resp = client.post("/api/records/upload-document", files=files, data=data, headers=headers)
    assert upload_resp.status_code == 201
    record_id = upload_resp.json()["id"]

    # Retrieve decrypted record
    dec_resp = client.get(f"/api/records/{record_id}/decrypted", headers=headers)
    assert dec_resp.status_code == 200
    dec_data = dec_resp.json()
    assert dec_data["id"] == record_id
    assert dec_data["integrity_verified"] is True
    assert dec_data["fhir_data"]["resourceType"] == "DocumentReference"
    assert dec_data["fhir_data"]["content"][0]["attachment"]["contentType"] == "application/pdf"
    assert dec_data["fhir_data"]["content"][0]["attachment"]["title"] == "scan_report.pdf"



# --- Test 22: Access request enrichment includes ZK verification state ---
def test_access_request_zk_status_persisted(client, db):
    p_user = _create_user(db, "p_zk_state@test.com", "pass12345678", "patient")
    patient = _create_patient_profile(db, p_user)
    p_headers = _auth_headers(p_user)

    rec_resp = client.post(
        "/api/records",
        json={"record_type": "observation", "fhir_resource_type": "Observation"},
        headers=p_headers,
    )
    record_id = rec_resp.json()["id"]

    d_user = _create_user(db, "d_zk_state@test.com", "pass12345678", "doctor")
    doctor = _create_doctor_profile(db, d_user)
    d_headers = _auth_headers(d_user)

    # Doctor requests access & Patient approves
    req_resp = client.post(
        "/api/access-requests",
        json={"patient_id": patient.id, "record_id": record_id, "reason": "Checkup"},
        headers=d_headers,
    )
    req_id = req_resp.json()["id"]
    client.patch(f"/api/access-requests/{req_id}/approve", headers=p_headers)

    # Before ZK verification: zk_verified is False
    list_resp1 = client.get("/api/access-requests", headers=d_headers)
    req_item1 = next(r for r in list_resp1.json() if r["id"] == req_id)
    assert req_item1["zk_verified"] is False

    # Generate and verify ZK proof
    gen_resp = client.post("/api/zk/generate-proof", json={"record_id": record_id}, headers=d_headers)
    p_data = gen_resp.json()
    v_resp = client.post(
        "/api/zk/verify",
        json={
            "proof": p_data["proof"],
            "record_commitment": p_data["record_commitment"],
            "authorization_commitment": p_data["authorization_commitment"],
            "requester_nullifier": p_data["requester_nullifier"],
        },
        headers=d_headers,
    )
    assert v_resp.json()["valid"] is True

    # After ZK verification: zk_verified is True
    list_resp2 = client.get("/api/access-requests", headers=d_headers)
    req_item2 = next(r for r in list_resp2.json() if r["id"] == req_id)
    assert req_item2["zk_verified"] is True
    assert req_item2["requester_nullifier"] == p_data["requester_nullifier"]

