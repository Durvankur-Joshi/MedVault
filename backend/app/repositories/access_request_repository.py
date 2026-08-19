from sqlalchemy.orm import Session

from app.models.access_request import AccessRequest


def create(
    db: Session,
    *,
    patient_id: str,
    record_id: str | None = None,
    requester_doctor_id: str | None = None,
    requester_hospital_id: str | None = None,
    reason: str | None = None,
) -> AccessRequest:
    """Create a new access request."""
    request = AccessRequest(
        patient_id=patient_id,
        record_id=record_id,
        requester_doctor_id=requester_doctor_id,
        requester_hospital_id=requester_hospital_id,
        reason=reason,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


def get_by_id(db: Session, request_id: str) -> AccessRequest | None:
    """Get an access request by its ID."""
    return db.query(AccessRequest).filter(AccessRequest.id == request_id).first()


def list_for_patient(db: Session, patient_id: str) -> list[AccessRequest]:
    """List all access requests targeting a given patient."""
    return (
        db.query(AccessRequest)
        .filter(AccessRequest.patient_id == patient_id)
        .order_by(AccessRequest.created_at.desc())
        .all()
    )


def list_for_requester(
    db: Session,
    *,
    doctor_id: str | None = None,
    hospital_id: str | None = None,
) -> list[AccessRequest]:
    """List all access requests made by a specific doctor or hospital."""
    query = db.query(AccessRequest)
    if doctor_id:
        query = query.filter(AccessRequest.requester_doctor_id == doctor_id)
    elif hospital_id:
        query = query.filter(AccessRequest.requester_hospital_id == hospital_id)
    else:
        return []
    return query.order_by(AccessRequest.created_at.desc()).all()


def update_status(db: Session, request_id: str, status: str) -> AccessRequest | None:
    """Update the status of an access request (e.g. approved, denied)."""
    request = db.query(AccessRequest).filter(AccessRequest.id == request_id).first()
    if request is None:
        return None
    request.status = status
    db.commit()
    db.refresh(request)
    return request
