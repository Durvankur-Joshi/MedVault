from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.schemas.access_request import AccessRequestCreate, AccessRequestResponse
from app.services import access_request_service

router = APIRouter(prefix="/api/access-requests", tags=["access requests"])


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
    return AccessRequestResponse.model_validate(access_req)


@router.get("", response_model=list[AccessRequestResponse])
def list_access_requests(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[AccessRequestResponse]:
    """List access requests for the current user."""
    requests = access_request_service.list_requests(db, current_user=current_user)
    return [AccessRequestResponse.model_validate(r) for r in requests]


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
    return AccessRequestResponse.model_validate(access_req)


@router.patch(
    "/{request_id}/approve",
    response_model=AccessRequestResponse,
    dependencies=[Depends(require_role("patient"))],
)
def approve_access_request(
    request_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AccessRequestResponse:
    """Approve an access request. Only the owning patient can approve."""
    access_req = access_request_service.approve_request(
        db, current_user=current_user, request_id=request_id
    )
    return AccessRequestResponse.model_validate(access_req)


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
    return AccessRequestResponse.model_validate(access_req)
