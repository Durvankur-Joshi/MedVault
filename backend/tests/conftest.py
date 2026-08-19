"""
Test configuration and fixtures for MedVault backend tests.

Uses SQLite in-memory database for isolation — models use only standard
SQLAlchemy types (String, DateTime, Text, Boolean), no PostgreSQL-specific features.
"""

import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Set test JWT secret before importing app modules
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing"
os.environ["DATABASE_URL"] = "sqlite://"

from app.core.database import get_db  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.models.doctor import Doctor  # noqa: E402
from app.models.hospital import Hospital  # noqa: E402
from app.models.patient import Patient  # noqa: E402
from app.models.user import User  # noqa: E402

# In-memory SQLite engine for tests
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Provide an isolated test database session per request."""
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Override the database dependency for all tests
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def reset_database():
    """Create all tables before each test and drop them after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    """Provide a test database session."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    """Provide a FastAPI test client."""
    return TestClient(app)


def _create_user(db: Session, email: str, password: str, role: str) -> User:
    """Helper to create a user directly in the database."""
    user = User(
        id=str(uuid.uuid4()),
        email=email,
        password_hash=hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_patient_profile(db: Session, user: User) -> Patient:
    """Helper to create a patient profile for a user."""
    patient = Patient(
        id=str(uuid.uuid4()),
        user_id=user.id,
        display_name=user.email.split("@")[0],
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


def _create_doctor_profile(
    db: Session, user: User, license_number: str | None = None
) -> Doctor:
    """Helper to create a doctor profile for a user."""
    doctor = Doctor(
        id=str(uuid.uuid4()),
        user_id=user.id,
        display_name=user.email.split("@")[0],
        license_number=license_number or f"LIC-{uuid.uuid4().hex[:8]}",
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


def _create_hospital(db: Session, name: str = "Test Hospital") -> Hospital:
    """Helper to create a hospital."""
    hospital = Hospital(
        id=str(uuid.uuid4()),
        name=name,
        registration_number=f"REG-{uuid.uuid4().hex[:8]}",
    )
    db.add(hospital)
    db.commit()
    db.refresh(hospital)
    return hospital


def _auth_headers(user: User) -> dict[str, str]:
    """Generate Authorization headers with a valid JWT for the given user."""
    token = create_access_token(user.id, user.role)
    return {"Authorization": f"Bearer {token}"}
