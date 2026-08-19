from sqlalchemy.orm import Session

from app.models.user import User


def get_by_id(db: Session, user_id: str) -> User | None:
    """Get a user by their UUID."""
    return db.query(User).filter(User.id == user_id).first()


def get_by_email(db: Session, email: str) -> User | None:
    """Get a user by email address."""
    return db.query(User).filter(User.email == email).first()


def create(db: Session, *, email: str, password_hash: str, role: str) -> User:
    """Create a new user and persist to the database."""
    user = User(email=email, password_hash=password_hash, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
