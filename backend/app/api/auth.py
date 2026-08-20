from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserResponse, WalletLinkRequest
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(
    data: UserCreate,
    db: Annotated[Session, Depends(get_db)],
) -> UserResponse:
    """Register a new user. Supported roles: patient, doctor, hospital_admin."""
    user = auth_service.register_user(db, data.email, data.password, data.role)
    return UserResponse.model_validate(user)


@router.post("/login", response_model=TokenResponse)
def login(
    data: UserLogin,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """Authenticate with email and password, receive a JWT."""
    user, token = auth_service.authenticate_user(db, data.email, data.password)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """Get the currently authenticated user's information."""
    return UserResponse.model_validate(current_user)


@router.patch("/wallet", response_model=UserResponse)
def link_wallet(
    data: WalletLinkRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """Link an EVM wallet address to the authenticated user account."""
    user = auth_service.update_wallet_address(db, current_user, data.wallet_address)
    return UserResponse.model_validate(user)
