from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.schemas.consent import ConsentCreate, ConsentResponse
from app.services import consent_service

router = APIRouter(prefix="/api/consent", tags=["consent"])


@router.post(
    "",
    response_model=ConsentResponse,
    status_code=201,
    dependencies=[Depends(require_role("patient"))],
)
def grant_consent(
    data: ConsentCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ConsentResponse:
    """Grant consent for a specific record. Patient only."""
    consent = consent_service.grant_consent(
        db,
        current_user=current_user,
        record_id=data.record_id,
        permission=data.permission,
        grantee_doctor_id=data.grantee_doctor_id,
        grantee_hospital_id=data.grantee_hospital_id,
        expires_at=data.expires_at,
    )
    return ConsentResponse.model_validate(consent)


@router.get("", response_model=list[ConsentResponse])
def list_consents(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ConsentResponse]:
    """List consent entries for the current user."""
    consents = consent_service.list_consents(db, current_user=current_user)
    return [ConsentResponse.model_validate(c) for c in consents]


@router.get("/{consent_id}", response_model=ConsentResponse)
def get_consent(
    consent_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ConsentResponse:
    """Get a single consent entry with authorization check."""
    consent = consent_service.get_consent(
        db, current_user=current_user, consent_id=consent_id
    )
    return ConsentResponse.model_validate(consent)


@router.patch(
    "/{consent_id}/revoke",
    response_model=ConsentResponse,
    dependencies=[Depends(require_role("patient"))],
)
def revoke_consent(
    consent_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ConsentResponse:
    """Revoke a consent entry. Only the granting patient can revoke."""
    consent = consent_service.revoke_consent(
        db, current_user=current_user, consent_id=consent_id
    )
    return ConsentResponse.model_validate(consent)
