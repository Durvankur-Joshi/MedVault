from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    role: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Password must be at least 8 characters")
    role: Literal["patient", "doctor", "hospital_admin"]
    wallet_address: Optional[str] = Field(None, description="Optional EVM wallet address")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class WalletLinkRequest(BaseModel):
    wallet_address: str = Field(..., pattern=r"^0x[a-fA-F0-9]{40}$", description="Valid 42-character EVM address")


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    wallet_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
