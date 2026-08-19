from sqlalchemy.orm import Session

from app.models.doctor import Doctor


def get_by_user_id(db: Session, user_id: str) -> Doctor | None:
    """Get a doctor profile by user ID."""
    return db.query(Doctor).filter(Doctor.user_id == user_id).first()
