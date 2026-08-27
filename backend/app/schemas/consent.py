from datetime import datetime

from pydantic import BaseModel


class ConsentBase(BaseModel):
    record_id: str
    permission: str  # read, write, full
    grantee_doctor_id: str | None = None
    grantee_hospital_id: str | None = None
    expires_at: datetime | None = None
    blockchain_tx_hash: str | None = None
    blockchain_network: str | None = None
    blockchain_contract_address: str | None = None
    blockchain_consent_id: str | None = None


class ConsentCreate(ConsentBase):
    pass


class ConsentRevokeRequest(BaseModel):
    blockchain_tx_hash: str | None = None


class ConsentResponse(ConsentBase):
    id: str
    patient_id: str
    status: str
    blockchain_consent_id: str | None = None
    blockchain_network: str | None = None
    blockchain_contract_address: str | None = None
    blockchain_tx_hash: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

