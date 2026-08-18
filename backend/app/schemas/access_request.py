from datetime import datetime

from pydantic import BaseModel


class AccessRequestBase(BaseModel):
    patient_id: str
    record_id: str | None = None
    requester_doctor_id: str | None = None
    requester_hospital_id: str | None = None
    reason: str | None = None


class AccessRequestCreate(AccessRequestBase):
    pass


class AccessRequestResponse(AccessRequestBase):
    id: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
