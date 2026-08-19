"""Tests 10–13: Role-based access control."""

from tests.conftest import _auth_headers, _create_user


# --- Test 10: Patient endpoint ---
def test_patient_endpoint_allowed(client, db):
    user = _create_user(db, "patient@rbac.com", "pass12345678", "patient")
    resp = client.get("/api/patient/profile", headers=_auth_headers(user))
    assert resp.status_code == 200


# --- Test 11: Doctor endpoint ---
def test_doctor_endpoint_allowed(client, db):
    user = _create_user(db, "doctor@rbac.com", "pass12345678", "doctor")
    resp = client.get("/api/doctor/profile", headers=_auth_headers(user))
    assert resp.status_code == 200


# --- Test 12: Hospital admin endpoint ---
def test_hospital_admin_endpoint_allowed(client, db):
    user = _create_user(db, "admin@rbac.com", "pass12345678", "hospital_admin")
    resp = client.get("/api/hospital/profile", headers=_auth_headers(user))
    assert resp.status_code == 200


# --- Test 13: Wrong role → 403 ---
def test_wrong_role_denied(client, db):
    user = _create_user(db, "patient@rbac.com", "pass12345678", "patient")
    headers = _auth_headers(user)

    # Patient trying doctor endpoint
    resp = client.get("/api/doctor/profile", headers=headers)
    assert resp.status_code == 403

    # Patient trying hospital endpoint
    resp = client.get("/api/hospital/profile", headers=headers)
    assert resp.status_code == 403
