from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.schemas.emergency import EmergencyAccessRequest, EmergencyAccessResponse
from app.services import emergency_service

router = APIRouter(prefix="/api/emergency-access", tags=["emergency access"])


@router.post(
    "",
    response_model=EmergencyAccessResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("doctor", "hospital_admin"))],
)
def request_emergency_access(
    data: EmergencyAccessRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> EmergencyAccessResponse:
    """
    Emergency Break-Glass Protocol:
    Allows credentialed emergency providers to request immediate, strictly time-bound (4hr)
    access to a patient's critical medical record. Generates explicit blockchain and database audit logs.
    """
    return emergency_service.request_emergency_access(
        db,
        current_user=current_user,
        patient_id=data.patient_id,
        record_id=data.record_id,
        reason=data.reason,
    )
