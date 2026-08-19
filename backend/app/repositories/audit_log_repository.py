from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def create(
    db: Session,
    *,
    actor_user_id: str,
    action: str,
    resource_type: str,
    resource_id: str,
    details: str | None = None,
) -> AuditLog:
    """Create a new audit log entry."""
    entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def list_for_actor(db: Session, actor_user_id: str) -> list[AuditLog]:
    """List all audit events performed by a specific user."""
    return (
        db.query(AuditLog)
        .filter(AuditLog.actor_user_id == actor_user_id)
        .order_by(AuditLog.created_at.desc())
        .all()
    )


def list_for_resource(
    db: Session, resource_type: str, resource_id: str
) -> list[AuditLog]:
    """List all audit events for a specific resource."""
    return (
        db.query(AuditLog)
        .filter(
            AuditLog.resource_type == resource_type,
            AuditLog.resource_id == resource_id,
        )
        .order_by(AuditLog.created_at.desc())
        .all()
    )
