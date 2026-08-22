"""
Tests for Phase 6: Document Upload Security & Validation.
"""

import io
from tests.conftest import (
    _auth_headers,
    _create_patient_profile,
    _create_user,
)


def test_valid_pdf_upload_succeeds(client, db):
    user = _create_user(db, "upload.valid@test.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)

    fake_pdf = b"%PDF-1.4 Mock Medical Report Content For Testing"
    resp = client.post(
        "/api/records/upload-document",
        files={"file": ("lab_report.pdf", io.BytesIO(fake_pdf), "application/pdf")},
        data={"record_type": "lab_report"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["original_document_filename"] == "lab_report.pdf"
    assert data["blockchain_tx_hash"] is not None


def test_disallowed_executable_extension_rejected(client, db):
    user = _create_user(db, "upload.exe@test.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)

    malicious_script = b"#!/bin/bash\necho dangerous"
    resp = client.post(
        "/api/records/upload-document",
        files={"file": ("malware.sh", io.BytesIO(malicious_script), "application/x-sh")},
        data={"record_type": "document"},
        headers=headers,
    )
    assert resp.status_code == 400
    assert "not permitted" in resp.json()["detail"]


def test_empty_file_rejected(client, db):
    user = _create_user(db, "upload.empty@test.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)

    resp = client.post(
        "/api/records/upload-document",
        files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"]


def test_filename_sanitization_strips_path_traversal(client, db):
    user = _create_user(db, "upload.traversal@test.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)

    fake_pdf = b"%PDF-1.4 Data"
    resp = client.post(
        "/api/records/upload-document",
        files={"file": ("../../etc/passwd.pdf", io.BytesIO(fake_pdf), "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    # Path traversal should be stripped
    assert "/" not in data["original_document_filename"]
    assert ".." not in data["original_document_filename"]
