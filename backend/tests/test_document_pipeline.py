import io
import pytest
from fastapi.testclient import TestClient

from tests.conftest import _auth_headers, _create_patient_profile, _create_user


@pytest.fixture
def auth_patient_with_token(db):
    user = _create_user(db, "doc_patient@example.com", "password123", "patient")
    patient = _create_patient_profile(db, user)
    headers = _auth_headers(user)
    return user, patient, headers


def test_upload_and_stream_encrypted_document(client: TestClient, auth_patient_with_token):
    _, _, headers = auth_patient_with_token

    # Synthetic PDF document
    pdf_content = b"%PDF-1.4 ... Synthetic Blood Report with Cholesterol: 180 mg/dL ..."
    files = {
        "file": ("blood_report.pdf", io.BytesIO(pdf_content), "application/pdf")
    }
    data = {
        "record_type": "blood_report"
    }

    # 1. Upload & encrypt document
    res = client.post("/api/records/upload-document", files=files, data=data, headers=headers)
    assert res.status_code == 201, res.text
    record_data = res.json()

    assert record_data["record_type"] == "blood_report"
    assert record_data["original_document_filename"] == "blood_report.pdf"
    assert record_data["original_document_mime_type"] == "application/pdf"
    assert record_data["blockchain_tx_hash"] is not None
    assert record_data["blockchain_tx_hash"].startswith("0x")

    record_id = record_data["id"]

    # 2. Retrieve, decrypt and stream document
    doc_res = client.get(f"/api/records/{record_id}/document", headers=headers)
    assert doc_res.status_code == 200
    assert doc_res.content == pdf_content
    assert "application/pdf" in doc_res.headers["content-type"]
    assert "blood_report.pdf" in doc_res.headers["content-disposition"]


def test_upload_and_stream_prescription_image(client: TestClient, auth_patient_with_token):
    _, _, headers = auth_patient_with_token

    # Synthetic image document
    img_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR...Synthetic Prescription Image..."
    files = {
        "file": ("rx_image.png", io.BytesIO(img_content), "image/png")
    }
    data = {
        "record_type": "prescription"
    }

    res = client.post("/api/records/upload-document", files=files, data=data, headers=headers)
    assert res.status_code == 201
    record_id = res.json()["id"]

    doc_res = client.get(f"/api/records/{record_id}/document", headers=headers)
    assert doc_res.status_code == 200
    assert doc_res.content == img_content
