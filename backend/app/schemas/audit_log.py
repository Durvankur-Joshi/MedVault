from datetime import datetime

from pydantic import BaseModel


class AuditLogBase(BaseModel):
    actor_user_id: str
    action: str
    resource_type: str
    resource_id: str
    details: str | None = None


class AuditLogCreate(AuditLogBase):
    pass


class AuditLogResponse(AuditLogBase):
    id: str
    blockchain_tx_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
