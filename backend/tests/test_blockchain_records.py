import pytest
from fastapi.testclient import TestClient

from tests.conftest import _auth_headers, _create_patient_profile, _create_user


@pytest.fixture
def auth_patient(db):
    user = _create_user(db, "chain_patient@example.com", "password123", "patient")
    patient = _create_patient_profile(db, user)
    headers = _auth_headers(user)
    return user, patient, headers


def test_link_wallet_address(client: TestClient, auth_patient):
    user, _, headers = auth_patient

    wallet_addr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    res = client.patch("/api/auth/wallet", json={"wallet_address": wallet_addr}, headers=headers)
    assert res.status_code == 200
    assert res.json()["wallet_address"] == wallet_addr

    # Check /me reflects wallet address
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["wallet_address"] == wallet_addr


def test_anchor_record_and_verify_on_blockchain(client: TestClient, auth_patient):
    _, _, headers = auth_patient

    # 1. Create FHIR Record
    fhir_data = {
        "resourceType": "Observation",
        "status": "final",
        "code": {"text": "Blood Glucose Fasting"},
        "valueQuantity": {"value": 95, "unit": "mg/dL"},
    }
    rec_res = client.post(
        "/api/records",
        json={"record_type": "lab_test", "fhir_resource_type": "Observation", "fhir_data": fhir_data},
        headers=headers,
    )
    assert rec_res.status_code == 201
    record_id = rec_res.json()["id"]

    # 2. Anchor to blockchain
    anchor_res = client.post(f"/api/records/{record_id}/anchor", headers=headers)
    assert anchor_res.status_code == 200
    anchor_data = anchor_res.json()
    assert anchor_data["status"] == "anchored"
    assert anchor_data["transaction_hash"].startswith("0x")
    assert anchor_data["record_hash"].replace("0x", "") == rec_res.json()["record_hash"].replace("0x", "")

    # 3. Verify on blockchain
    verify_res = client.get(f"/api/records/{record_id}/blockchain-verify", headers=headers)
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["is_valid"] is True
    assert verify_data["status"] == "verified"
    assert verify_data["expected_hash"] == anchor_data["record_hash"]
