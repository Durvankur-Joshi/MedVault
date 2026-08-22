from datetime import datetime
from pydantic import BaseModel, Field


class EmergencyAccessRequest(BaseModel):
    patient_id: str = Field(..., description="Target patient UUID")
    record_id: str = Field(..., description="Target medical record UUID")
    reason: str = Field(..., min_length=5, description="Clinical justification for emergency break-glass access")


class EmergencyAccessResponse(BaseModel):
    consent_id: str
    record_id: str
    patient_id: str
    grantee_doctor_id: str
    permission: str
    status: str
    expires_at: datetime
    blockchain_tx_hash: str | None = None
    audit_event_logged: bool = True
    message: str

    model_config = {"from_attributes": True}
