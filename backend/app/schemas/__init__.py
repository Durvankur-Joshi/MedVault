# Pydantic schemas for request/response validation
from app.schemas.health import HealthResponse
from app.schemas.user import UserBase, UserCreate, UserLogin, UserResponse, TokenResponse
from app.schemas.medical_record import (
    MedicalRecordBase,
    MedicalRecordCreate,
    MedicalRecordResponse,
    MedicalRecordDetailResponse,
    IntegrityVerifyResponse,
    BlockchainAnchorResponse,
    BlockchainVerifyResponse,
)
from app.schemas.consent import ConsentBase, ConsentCreate, ConsentResponse
from app.schemas.access_request import AccessRequestBase, AccessRequestCreate, AccessRequestResponse
from app.schemas.audit_log import AuditLogBase, AuditLogCreate, AuditLogResponse
from app.schemas.patient import PatientSearchResult, PatientRecordSummary
from app.schemas.zk import (
    ZKPublicInputs,
    ZKGenerateProofRequest,
    ZKGenerateProofResponse,
    ZKVerifyRequest,
    ZKVerifyResponse,
    ZKStatusResponse,
)
