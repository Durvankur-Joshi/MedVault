from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse
from app.services import audit_service

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogResponse])
def list_audit_events(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[AuditLogResponse]:
    """List audit events for the currently authenticated user."""
    events = audit_service.list_events_for_actor(db, current_user.id)
    return [AuditLogResponse.model_validate(e) for e in events]
