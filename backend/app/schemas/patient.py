from datetime import datetime
from pydantic import BaseModel


class PatientSearchResult(BaseModel):
    """Minimal patient identity for search results — zero PII exposure."""

    id: str
    display_name: str

    model_config = {"from_attributes": True}


class PatientRecordSummary(BaseModel):
    """
    Non-sensitive record metadata for doctor-side record selection.
    Does NOT include decrypted content, encryption keys, or storage paths.
    """

    id: str
    record_type: str
    fhir_resource_type: str | None = None
    original_document_filename: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DoctorSearchResult(BaseModel):
    """Public doctor profile for patient consent selection — zero internal secrets."""

    id: str
    user_id: str
    display_name: str
    specialization: str | None = None
    license_number: str
    hospital_name: str | None = None
    wallet_address: str | None = None

    model_config = {"from_attributes": True}
