from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter(prefix="/api", tags=["role-based access"])


@router.get(
    "/patient/profile",
    response_model=UserResponse,
    dependencies=[Depends(require_role("patient"))],
)
def patient_profile(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """Patient-only endpoint. Verifies RBAC architecture."""
    return UserResponse.model_validate(current_user)


@router.get(
    "/doctor/profile",
    response_model=UserResponse,
    dependencies=[Depends(require_role("doctor"))],
)
def doctor_profile(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """Doctor-only endpoint. Verifies RBAC architecture."""
    return UserResponse.model_validate(current_user)


@router.get(
    "/hospital/profile",
    response_model=UserResponse,
    dependencies=[Depends(require_role("hospital_admin"))],
)
def hospital_profile(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """Hospital admin-only endpoint. Verifies RBAC architecture."""
    return UserResponse.model_validate(current_user)
