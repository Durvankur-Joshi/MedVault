"""Tests 1–9: Authentication endpoints."""

from tests.conftest import _auth_headers, _create_patient_profile, _create_user


# --- Test 1: Registration ---
def test_register_patient(client, db):
    resp = client.post(
        "/api/auth/register",
        json={"email": "newpatient@test.com", "password": "securepass123", "role": "patient"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "newpatient@test.com"
    assert data["role"] == "patient"
    assert data["is_active"] is True
    assert "id" in data


# --- Test 2: Duplicate registration ---
def test_register_duplicate_email(client, db):
    client.post(
        "/api/auth/register",
        json={"email": "dup@test.com", "password": "securepass123", "role": "patient"},
    )
    resp = client.post(
        "/api/auth/register",
        json={"email": "dup@test.com", "password": "otherpass123", "role": "patient"},
    )
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"]


# --- Test 3: Password hashing ---
def test_password_is_hashed(client, db):
    from app.models.user import User

    client.post(
        "/api/auth/register",
        json={"email": "hashtest@test.com", "password": "mypassword123", "role": "patient"},
    )
    user = db.query(User).filter(User.email == "hashtest@test.com").first()
    assert user is not None
    assert user.password_hash != "mypassword123"
    assert user.password_hash.startswith("$2")  # bcrypt prefix


# --- Test 4: Login ---
def test_login_success(client, db):
    client.post(
        "/api/auth/register",
        json={"email": "login@test.com", "password": "securepass123", "role": "patient"},
    )
    resp = client.post(
        "/api/auth/login",
        json={"email": "login@test.com", "password": "securepass123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "login@test.com"


# --- Test 5: Invalid password ---
def test_login_invalid_password(client, db):
    client.post(
        "/api/auth/register",
        json={"email": "badpass@test.com", "password": "securepass123", "role": "patient"},
    )
    resp = client.post(
        "/api/auth/login",
        json={"email": "badpass@test.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.json()["detail"]


# --- Test 6: /auth/me ---
def test_auth_me(client, db):
    user = _create_user(db, "me@test.com", "pass12345678", "patient")
    _create_patient_profile(db, user)
    headers = _auth_headers(user)
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "me@test.com"


# --- Test 7: Invalid JWT ---
def test_invalid_jwt(client):
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert resp.status_code == 401


# --- Test 8: Missing JWT ---
def test_missing_jwt(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401  # HTTPBearer returns 401 when no credentials


# --- Test 9: Inactive user ---
def test_inactive_user(client, db):
    user = _create_user(db, "inactive@test.com", "pass12345678", "patient")
    user.is_active = False
    db.commit()
    headers = _auth_headers(user)
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 401
