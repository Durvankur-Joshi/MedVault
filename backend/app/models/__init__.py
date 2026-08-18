# SQLAlchemy models — import all models here so Alembic can discover them
from app.models.base import Base
from app.models.user import User
from app.models.patient import Patient
from app.models.hospital import Hospital
from app.models.doctor import Doctor
from app.models.medical_record import MedicalRecord
from app.models.consent import Consent
from app.models.access_request import AccessRequest
from app.models.audit_log import AuditLog

__all__ = [
    "Base",
    "User",
    "Patient",
    "Hospital",
    "Doctor",
    "MedicalRecord",
    "Consent",
    "AccessRequest",
    "AuditLog",
]
