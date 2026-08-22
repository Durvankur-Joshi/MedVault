from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories import (
    audit_log_repository,
    doctor_repository,
    patient_repository,
    user_repository,
)

VALID_ROLES = {"patient", "doctor", "hospital_admin"}


def register_user(db: Session, email: str, password: str, role: str) -> User:
    """
    Register a new user.
    - Validates role
    - Rejects duplicate emails (409)
    - Hashes password
    - Creates User record
    - If role is 'patient', auto-creates a Patient profile
    - If role is 'doctor', auto-creates a Doctor profile
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

    # Auto-create role-specific profile
    if role == "patient":
        display_name = email.split("@")[0]
        patient_repository.create(db, user_id=user.id, display_name=display_name)
    elif role == "doctor":
        doctor_repository.get_or_create_for_user(db, user_id=user.id, email=email)

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
    Idempotently ensures profile exists for existing users.
    Uses a generic error message to avoid revealing whether email exists.
    """
    user = user_repository.get_by_email(db, email)

    if user is None or not verify_password(password, user.password_hash):
        if user is not None:
            audit_log_repository.create(
                db,
                actor_user_id=user.id,
                action="user.login_failed",
                resource_type="user",
                resource_id=user.id,
                details="invalid_credentials",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        audit_log_repository.create(
            db,
            actor_user_id=user.id,
            action="user.login_failed",
            resource_type="user",
            resource_id=user.id,
            details="account_deactivated",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated",
        )

    # Safe idempotent profile check for existing accounts
    if user.role == "doctor":
        doctor_repository.get_or_create_for_user(db, user_id=user.id, email=user.email)
    elif user.role == "patient":
        existing_patient = patient_repository.get_by_user_id(db, user.id)
        if existing_patient is None:
            display_name = user.email.split("@")[0]
            patient_repository.create(db, user_id=user.id, display_name=display_name)

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


def update_wallet_address(db: Session, user: User, wallet_address: str) -> User:
    """Link an EVM wallet address to the user account."""
    clean_addr = wallet_address.strip()
    user.wallet_address = clean_addr
    db.commit()
    db.refresh(user)

    audit_log_repository.create(
        db,
        actor_user_id=user.id,
        action="user.wallet_linked",
        resource_type="user",
        resource_id=user.id,
        details=f"wallet={clean_addr[:6]}...{clean_addr[-4:]}",
    )
    return user
