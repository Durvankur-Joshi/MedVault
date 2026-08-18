from datetime import datetime

from pydantic import BaseModel


class ConsentBase(BaseModel):
    patient_id: str
    record_id: str
    permission: str  # read, write, full
    grantee_doctor_id: str | None = None
    grantee_hospital_id: str | None = None
    expires_at: datetime | None = None


class ConsentCreate(ConsentBase):
    pass


class ConsentResponse(ConsentBase):
    id: str
    status: str
    blockchain_consent_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
