from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.access_request import AccessRequest
from app.models.doctor import Doctor
from app.models.hospital import Hospital
from app.models.medical_record import MedicalRecord
from app.models.user import User
from app.schemas.access_request import (
    AccessRequestApprove,
    AccessRequestCreate,
    AccessRequestResponse,
)
from app.services import access_request_service

router = APIRouter(prefix="/api/access-requests", tags=["access requests"])


def enrich_access_request(db: Session, req: AccessRequest) -> AccessRequestResponse:
    """Enrich an access request with doctor, hospital, record, and ZK verification details."""
    base = AccessRequestResponse.model_validate(req)
    doctor = None
    if req.requester_doctor_id:
        doctor = db.query(Doctor).filter(Doctor.id == req.requester_doctor_id).first()
        if doctor:
            base.requester_doctor_name = doctor.display_name
            base.requester_doctor_license = doctor.license_number
            base.requester_doctor_specialization = doctor.specialization or "General Practice"
            if doctor.user:
                base.requester_doctor_wallet = doctor.user.wallet_address
            if doctor.hospital:
                base.requester_hospital_name = doctor.hospital.name

    if req.requester_hospital_id and not base.requester_hospital_name:
        hosp = db.query(Hospital).filter(Hospital.id == req.requester_hospital_id).first()
        if hosp:
            base.requester_hospital_name = hosp.name

    if req.record_id:
        rec = db.query(MedicalRecord).filter(MedicalRecord.id == req.record_id).first()
        if rec:
            base.record_type = rec.record_type
            base.record_title = (
                rec.original_document_filename
                or rec.fhir_resource_type
                or rec.record_type.replace("_", " ").title()
            )

    # Check ZK authorization verification state for approved requests with active consent
    if req.status == "approved" and req.record_id and doctor and doctor.user_id:
        from app.repositories import consent_repository
        from app.services.zk_service import zk_service

        consent = consent_repository.find_active_consent(
            db, record_id=req.record_id, grantee_doctor_id=doctor.id
        )
        if consent:
            req_secret, auth_secret, rec_salt = zk_service._derive_secrets(
                user_id=doctor.user_id,
                record_id=req.record_id,
                consent_id=consent.id,
            )
            _, _, nullifier = zk_service.compute_commitments(
                requester_secret=req_secret,
                authorization_secret=auth_secret,
                record_secret_salt=rec_salt,
            )
            base.requester_nullifier = nullifier
            if zk_service.is_nullifier_consumed(nullifier):
                base.zk_verified = True

    return base



@router.post(
    "",
    response_model=AccessRequestResponse,
    status_code=201,
    dependencies=[Depends(require_role("doctor", "hospital_admin"))],
)
def create_access_request(
    data: AccessRequestCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AccessRequestResponse:
    """Create an access request. Doctor or hospital admin only."""
    access_req = access_request_service.create_request(
        db,
        current_user=current_user,
        patient_id=data.patient_id,
        record_id=data.record_id,
        reason=data.reason,
    )
    return enrich_access_request(db, access_req)


@router.get("", response_model=list[AccessRequestResponse])
def list_access_requests(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[AccessRequestResponse]:
    """List access requests for the current user."""
    requests = access_request_service.list_requests(db, current_user=current_user)
    return [enrich_access_request(db, r) for r in requests]


@router.get("/{request_id}", response_model=AccessRequestResponse)
def get_access_request(
    request_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AccessRequestResponse:
    """Get a single access request with authorization check."""
    access_req = access_request_service.get_request(
        db, current_user=current_user, request_id=request_id
    )
    return enrich_access_request(db, access_req)


@router.patch(
    "/{request_id}/approve",
    response_model=AccessRequestResponse,
    dependencies=[Depends(require_role("patient"))],
)
def approve_access_request(
    request_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    data: AccessRequestApprove | None = None,
) -> AccessRequestResponse:
    """Approve an access request. Only the owning patient can approve."""
    permission = data.permission if data else "read"
    expires_at = data.expires_at if data else None
    access_req = access_request_service.approve_request(
        db,
        current_user=current_user,
        request_id=request_id,
        permission=permission,
        expires_at=expires_at,
    )
    return enrich_access_request(db, access_req)


@router.patch(
    "/{request_id}/deny",
    response_model=AccessRequestResponse,
    dependencies=[Depends(require_role("patient"))],
)
def deny_access_request(
    request_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AccessRequestResponse:
    """Deny an access request. Only the owning patient can deny."""
    access_req = access_request_service.deny_request(
        db, current_user=current_user, request_id=request_id
    )
    return enrich_access_request(db, access_req)
