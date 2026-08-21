"""
MedVault Zero-Knowledge API Routes (Phase 5).

Endpoints for ZK authorization proof generation, verification, and status checks.

SECURITY:
- No patient PII, doctor identity, or medical content is exposed or accepted as public inputs.
- All operations operate on cryptographic commitments and nullifiers only.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.schemas.zk import (
    ZKGenerateProofRequest,
    ZKGenerateProofResponse,
    ZKStatusResponse,
    ZKVerifyRequest,
    ZKVerifyResponse,
)
from app.services.zk_service import zk_service

router = APIRouter(prefix="/api/zk", tags=["zero-knowledge privacy"])


@router.get("/status", response_model=ZKStatusResponse)
def get_zk_status() -> ZKStatusResponse:
    """Get the current configuration and status of the ZK proof subsystem."""
    return zk_service.get_status()


@router.post(
    "/generate-proof",
    response_model=ZKGenerateProofResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("doctor", "hospital_admin"))],
)
def generate_authorization_proof(
    payload: ZKGenerateProofRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ZKGenerateProofResponse:
    """
    Generate a Zero-Knowledge authorization proof for an authorized medical record.
    Requires active patient consent. Doctor or hospital admin only.
    """
    return zk_service.generate_authorization_proof(
        db,
        current_user=current_user,
        record_id=payload.record_id,
        consent_id=payload.consent_id,
    )


@router.post(
    "/verify",
    response_model=ZKVerifyResponse,
    dependencies=[Depends(get_current_user)],
)
def verify_authorization_proof(
    payload: ZKVerifyRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ZKVerifyResponse:
    """
    Verify a Zero-Knowledge authorization proof against public commitments.
    Returns whether the cryptographic proof is valid.
    """
    return zk_service.verify_authorization_proof(
        db,
        proof=payload.proof,
        record_commitment=payload.record_commitment,
        authorization_commitment=payload.authorization_commitment,
        requester_nullifier=payload.requester_nullifier,
        actor_user_id=current_user.id,
    )
