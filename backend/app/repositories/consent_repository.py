from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.consent import Consent


def create(
    db: Session,
    *,
    patient_id: str,
    record_id: str,
    permission: str,
    grantee_doctor_id: str | None = None,
    grantee_hospital_id: str | None = None,
    expires_at: datetime | None = None,
) -> Consent:
    """Create a new consent entry."""
    consent = Consent(
        patient_id=patient_id,
        record_id=record_id,
        permission=permission,
        grantee_doctor_id=grantee_doctor_id,
        grantee_hospital_id=grantee_hospital_id,
        expires_at=expires_at,
        status="active",
    )
    db.add(consent)
    db.commit()
    db.refresh(consent)
    return consent


def get_by_id(db: Session, consent_id: str) -> Consent | None:
    """Get a consent entry by its ID."""
    return db.query(Consent).filter(Consent.id == consent_id).first()


def list_for_patient(db: Session, patient_id: str) -> list[Consent]:
    """List all consent entries for a given patient."""
    return (
        db.query(Consent)
        .filter(Consent.patient_id == patient_id)
        .order_by(Consent.created_at.desc())
        .all()
    )


def find_active_consent(
    db: Session,
    *,
    record_id: str,
    grantee_doctor_id: str | None = None,
    grantee_hospital_id: str | None = None,
) -> Consent | None:
    """
    Find an active, non-expired consent for a specific record and grantee.
    Returns None if no valid consent exists.
    """
    query = db.query(Consent).filter(
        Consent.record_id == record_id,
        Consent.status == "active",
    )

    if grantee_doctor_id:
        query = query.filter(Consent.grantee_doctor_id == grantee_doctor_id)
    elif grantee_hospital_id:
        query = query.filter(Consent.grantee_hospital_id == grantee_hospital_id)
    else:
        return None

    consent = query.first()
    if consent is None:
        return None

    # Check expiration — handle both tz-aware and naive datetimes (SQLite stores naive)
    if consent.expires_at:
        expires = consent.expires_at
        now = datetime.now(timezone.utc)
        # If expires_at is naive, assume UTC
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < now:
            return None

    return consent


def revoke(db: Session, consent_id: str) -> Consent | None:
    """Revoke a consent entry (sets status to 'revoked', does not delete)."""
    consent = db.query(Consent).filter(Consent.id == consent_id).first()
    if consent is None:
        return None
    consent.status = "revoked"
    db.commit()
    db.refresh(consent)
    return consent
