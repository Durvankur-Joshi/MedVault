import uuid
from sqlalchemy.orm import Session

from app.models.doctor import Doctor


def get_by_id(db: Session, doctor_id: str) -> Doctor | None:
    """Get a doctor profile by primary key ID."""
    return db.query(Doctor).filter(Doctor.id == doctor_id).first()


def get_by_user_id(db: Session, user_id: str) -> Doctor | None:
    """Get a doctor profile by user ID."""
    return db.query(Doctor).filter(Doctor.user_id == user_id).first()


def create(
    db: Session,
    *,
    user_id: str,
    display_name: str,
    license_number: str,
    specialization: str | None = None,
    hospital_id: str | None = None,
) -> Doctor:
    """Create a new doctor profile."""
    doctor = Doctor(
        user_id=user_id,
        display_name=display_name,
        license_number=license_number,
        specialization=specialization,
        hospital_id=hospital_id,
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


def get_or_create_for_user(
    db: Session,
    user_id: str,
    email: str,
) -> Doctor:
    """
    Idempotently retrieve or provision a Doctor profile for an authenticated doctor User.
    Ensures that existing doctor users without a profile are provisioned gracefully
    without creating duplicates.
    """
    existing = get_by_user_id(db, user_id)
    if existing is not None:
        return existing

    prefix = email.split("@")[0]
    display_name = (
        prefix.replace(".", " ").title()
        if prefix.lower().startswith("dr")
        else f"Dr. {prefix.replace('.', ' ').title()}"
    )

    # Deterministic base license number from user_id
    license_number = f"MED-{user_id[:8].upper()}"

    # Handle any theoretical license number collision
    existing_lic = (
        db.query(Doctor).filter(Doctor.license_number == license_number).first()
    )
    if existing_lic is not None:
        license_number = f"MED-{uuid.uuid4().hex[:8].upper()}"

    return create(
        db,
        user_id=user_id,
        display_name=display_name,
        license_number=license_number,
    )
