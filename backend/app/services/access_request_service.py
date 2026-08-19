from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.access_request import AccessRequest
from app.models.user import User
from app.repositories import (
    access_request_repository,
    consent_repository,
    doctor_repository,
    medical_record_repository,
    patient_repository,
)
from app.services import audit_service


def create_request(
    db: Session,
    *,
    current_user: User,
    patient_id: str,
    record_id: str | None = None,
    reason: str | None = None,
) -> AccessRequest:
    """
    Create an access request. Only doctors and hospital admins can create requests.
    The requester's profile ID is determined from their user account.
    """
    if current_user.role not in ("doctor", "hospital_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors and hospital admins can create access requests",
        )

    # Verify target patient exists
    from app.models.patient import Patient

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    # Verify record exists if specified
    if record_id:
        record = medical_record_repository.get_by_id(db, record_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Record not found",
            )
        if record.patient_id != patient_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Record does not belong to the specified patient",
            )

    requester_doctor_id = None
    requester_hospital_id = None

    if current_user.role == "doctor":
        doctor = doctor_repository.get_by_user_id(db, current_user.id)
        if doctor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Doctor profile not found",
            )
        requester_doctor_id = doctor.id

    access_req = access_request_repository.create(
        db,
        patient_id=patient_id,
        record_id=record_id,
        requester_doctor_id=requester_doctor_id,
        requester_hospital_id=requester_hospital_id,
        reason=reason,
    )

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="access.requested",
        resource_type="access_request",
        resource_id=access_req.id,
        details=f"patient_id={patient_id}",
    )

    return access_req


def list_requests(db: Session, *, current_user: User) -> list[AccessRequest]:
    """
    List access requests.
    - Patient: sees requests concerning their records.
    - Doctor: sees their own requests.
    """
    if current_user.role == "patient":
        patient = patient_repository.get_by_user_id(db, current_user.id)
        if patient is None:
            return []
        return access_request_repository.list_for_patient(db, patient.id)

    elif current_user.role == "doctor":
        doctor = doctor_repository.get_by_user_id(db, current_user.id)
        if doctor is None:
            return []
        return access_request_repository.list_for_requester(db, doctor_id=doctor.id)

    return []


def get_request(
    db: Session, *, current_user: User, request_id: str
) -> AccessRequest:
    """Get a single access request with authorization check."""
    access_req = access_request_repository.get_by_id(db, request_id)
    if access_req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access request not found",
        )

    # Patient who is the target can view
    if current_user.role == "patient":
        patient = patient_repository.get_by_user_id(db, current_user.id)
        if patient is None or access_req.patient_id != patient.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this request",
            )
        return access_req

    # Doctor who is the requester can view
    if current_user.role == "doctor":
        doctor = doctor_repository.get_by_user_id(db, current_user.id)
        if doctor and access_req.requester_doctor_id == doctor.id:
            return access_req

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this request",
    )


def approve_request(
    db: Session, *, current_user: User, request_id: str
) -> AccessRequest:
    """
    Approve an access request. Only the patient who owns the targeted record
    can approve. Approval creates a Consent entry.
    """
    access_req = access_request_repository.get_by_id(db, request_id)
    if access_req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access request not found",
        )

    if current_user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can approve access requests",
        )

    patient = patient_repository.get_by_user_id(db, current_user.id)
    if patient is None or access_req.patient_id != patient.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only approve requests for your own records",
        )

    if access_req.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request is already {access_req.status}",
        )

    # Update status to approved
    access_request_repository.update_status(db, request_id, "approved")

    # Create consent if a specific record was requested
    if access_req.record_id:
        consent_repository.create(
            db,
            patient_id=patient.id,
            record_id=access_req.record_id,
            permission="read",
            grantee_doctor_id=access_req.requester_doctor_id,
            grantee_hospital_id=access_req.requester_hospital_id,
        )

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="access.approved",
        resource_type="access_request",
        resource_id=request_id,
    )

    # Refresh to get updated status
    return access_request_repository.get_by_id(db, request_id)


def deny_request(
    db: Session, *, current_user: User, request_id: str
) -> AccessRequest:
    """
    Deny an access request. Only the patient who owns the targeted record
    can deny. Denial does NOT create a Consent entry.
    """
    access_req = access_request_repository.get_by_id(db, request_id)
    if access_req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access request not found",
        )

    if current_user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can deny access requests",
        )

    patient = patient_repository.get_by_user_id(db, current_user.id)
    if patient is None or access_req.patient_id != patient.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only deny requests for your own records",
        )

    if access_req.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request is already {access_req.status}",
        )

    access_request_repository.update_status(db, request_id, "denied")

    audit_service.log_event(
        db,
        actor_user_id=current_user.id,
        action="access.denied",
        resource_type="access_request",
        resource_id=request_id,
    )

    return access_request_repository.get_by_id(db, request_id)
