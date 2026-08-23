from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ZKPublicInputs(BaseModel):
    """Public inputs for ZK verification — Zero PII or medical data."""

    record_commitment: str = Field(..., description="32-byte public record commitment")
    authorization_commitment: str = Field(..., description="32-byte public authorization commitment")
    requester_nullifier: str = Field(..., description="32-byte public requester nullifier")


class ZKGenerateProofRequest(BaseModel):
    """Request for generating a ZK authorization proof for an authorized record."""

    record_id: str = Field(..., description="Target record UUID")
    consent_id: Optional[str] = Field(None, description="Optional specific consent UUID")


class ZKGenerateProofResponse(BaseModel):
    """Generated ZK proof and public inputs."""

    proof: str = Field(..., description="Cryptographic proof bytes in hex")
    record_commitment: str = Field(..., description="Public record commitment")
    authorization_commitment: str = Field(..., description="Public authorization commitment")
    requester_nullifier: str = Field(..., description="Public requester nullifier")
    circuit_name: str = Field("authorization", description="Noir circuit name")
    generated_at: str
    status: str = Field("generated", description="Proof generation status")


class ZKVerifyRequest(BaseModel):
    """Request to verify a ZK authorization proof."""

    proof: str = Field(..., description="Cryptographic proof bytes in hex")
    record_commitment: str = Field(..., description="Public record commitment")
    authorization_commitment: str = Field(..., description="Public authorization commitment")
    requester_nullifier: str = Field(..., description="Public requester nullifier")


class ZKVerifyResponse(BaseModel):
    """Result of ZK proof verification."""

    valid: bool = Field(..., description="Whether the proof passed verification")
    circuit_name: str = Field("authorization", description="Noir circuit name")
    nullifier: str = Field(..., description="Requester nullifier")
    verified_at: str
    details: str = Field(..., description="Verification details")
    tx_hash: Optional[str] = Field(None, description="On-chain verification transaction hash")
    verification_mode: str = Field("cryptographic_bn254", description="Verification engine and curve")



class ZKStatusResponse(BaseModel):
    """ZK subsystem status and configuration."""

    enabled: bool
    prover_mode: str
    circuit_name: str
    circuit_path: str
    supported_curve: str = "BN254"
