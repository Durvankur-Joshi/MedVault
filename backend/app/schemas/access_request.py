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


class AccessRequestApprove(BaseModel):
    permission: str = "read"
    expires_at: datetime | None = None


class AccessRequestResponse(AccessRequestBase):
    id: str
    status: str
    created_at: datetime
    requester_doctor_name: str | None = None
    requester_doctor_license: str | None = None
    requester_doctor_wallet: str | None = None
    requester_doctor_specialization: str | None = None
    requester_hospital_name: str | None = None
    record_type: str | None = None
    record_title: str | None = None

    model_config = {"from_attributes": True}
