from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import user_repository


def get_user_by_id(db: Session, user_id: str) -> User | None:
    """Get a user by ID through the repository layer."""
    return user_repository.get_by_id(db, user_id)
