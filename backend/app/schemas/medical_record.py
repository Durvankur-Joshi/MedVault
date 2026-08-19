from datetime import datetime

from pydantic import BaseModel


class MedicalRecordBase(BaseModel):
    record_type: str
    fhir_resource_type: str | None = None


class MedicalRecordCreate(MedicalRecordBase):
    pass


class MedicalRecordResponse(MedicalRecordBase):
    id: str
    patient_id: str
    encrypted_storage_ref: str | None = None
    record_hash: str | None = None
    blockchain_record_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
