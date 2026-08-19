from sqlalchemy.orm import Session

from app.repositories import audit_log_repository


def log_event(
    db: Session,
    *,
    actor_user_id: str,
    action: str,
    resource_type: str,
    resource_id: str,
    details: str | None = None,
) -> None:
    """
    Log an audit event. Details must NOT contain PII, medical content,
    passwords, JWT tokens, or encryption keys.
    """
    audit_log_repository.create(
        db,
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
    )


def list_events_for_actor(db: Session, actor_user_id: str):
    """List all audit events for a given actor."""
    return audit_log_repository.list_for_actor(db, actor_user_id)
