from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class MedicalRecordBase(BaseModel):
    record_type: str
    fhir_resource_type: Optional[str] = "Observation"


class MedicalRecordCreate(BaseModel):
    """
    Schema for creating a medical record through the privacy pipeline.
    Accepts clinical FHIR data to be normalized, hashed, and AES-256-GCM encrypted.
    """

    record_type: str = Field(..., description="Classification (e.g. observation, condition, prescription, encounter)")
    fhir_resource_type: str = Field(default="Observation", description="FHIR R4 resource type (e.g. Observation, Condition, MedicationRequest, Encounter, Patient)")
    fhir_data: dict[str, Any] = Field(
        default_factory=lambda: {
            "resourceType": "Observation",
            "status": "final",
            "code": {"text": "General Clinical Observation"},
            "valueString": "Normal",
        },
        description="FHIR R4 resource dictionary containing clinical data",
    )
    patient_id: Optional[str] = Field(None, description="Target patient ID (required when created by a doctor; optional for patients)")


class MedicalRecordResponse(BaseModel):
    """
    Safe metadata response. Plaintext clinical content, raw ciphertext,
    and encryption keys are NEVER returned in this schema.
    """

    id: str
    patient_id: str
    created_by_user_id: Optional[str] = None
    record_type: str
    fhir_resource_type: Optional[str] = None
    encrypted_storage_ref: Optional[str] = None
    record_hash: Optional[str] = None
    encryption_version: Optional[str] = None
    storage_provider: Optional[str] = None
    blockchain_record_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MedicalRecordDetailResponse(MedicalRecordResponse):
    """
    Detailed response for authorized record retrieval.
    Includes decrypted FHIR data and verified integrity status.
    """

    fhir_data: dict[str, Any]
    integrity_verified: bool


class IntegrityVerifyResponse(BaseModel):
    """
    Response schema for on-demand integrity verification.
    """

    record_id: str
    stored_hash: str
    recalculated_hash: str
    integrity_verified: bool
    status: str
    details: Optional[str] = None
