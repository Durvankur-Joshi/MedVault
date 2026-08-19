from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories import audit_log_repository, patient_repository, user_repository

VALID_ROLES = {"patient", "doctor", "hospital_admin"}


def register_user(db: Session, email: str, password: str, role: str) -> User:
    """
    Register a new user.
    - Validates role
    - Rejects duplicate emails (409)
    - Hashes password
    - Creates User record
    - If role is 'patient', also creates a Patient profile
    """
    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(sorted(VALID_ROLES))}",
        )

    existing = user_repository.get_by_email(db, email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    hashed = hash_password(password)
    user = user_repository.create(db, email=email, password_hash=hashed, role=role)

    # Auto-create a Patient profile for patient users
    if role == "patient":
        display_name = email.split("@")[0]
        patient_repository.create(db, user_id=user.id, display_name=display_name)

    # Audit event — no PII in details
    audit_log_repository.create(
        db,
        actor_user_id=user.id,
        action="user.registered",
        resource_type="user",
        resource_id=user.id,
        details=f"role={role}",
    )

    return user


def authenticate_user(db: Session, email: str, password: str) -> tuple[User, str]:
    """
    Authenticate a user by email and password.
    Returns (user, access_token) on success.
    Uses a generic error message to avoid revealing whether email exists.
    """
    user = user_repository.get_by_email(db, email)

    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated",
        )

    token = create_access_token(user.id, user.role)

    # Audit event — no PII in details
    audit_log_repository.create(
        db,
        actor_user_id=user.id,
        action="user.login",
        resource_type="user",
        resource_id=user.id,
    )

    return user, token
