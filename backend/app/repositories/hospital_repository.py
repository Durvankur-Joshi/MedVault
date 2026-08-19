from sqlalchemy.orm import Session

from app.models.hospital import Hospital


def get_by_id(db: Session, hospital_id: str) -> Hospital | None:
    """Get a hospital by ID."""
    return db.query(Hospital).filter(Hospital.id == hospital_id).first()
