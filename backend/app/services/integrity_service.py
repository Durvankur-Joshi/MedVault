import hashlib
import hmac
from typing import Any

from app.services import fhir_service


def calculate_record_hash(data: bytes | dict[str, Any] | str) -> str:
    """
    Compute a deterministic SHA-256 integrity hash over medical record data.
    If a dictionary is passed, it is canonicalized first.

    This hash serves as an integrity commitment (to be anchored on-chain in Phase 4)
    and enables tamper detection without exposing plaintext content.
    """
    if isinstance(data, dict):
        canonical_bytes, _ = fhir_service.canonicalize_fhir(data)
    elif isinstance(data, str):
        canonical_bytes = data.encode("utf-8")
    elif isinstance(data, bytes):
        canonical_bytes = data
    else:
        raise TypeError(f"Unsupported data type for integrity hash: {type(data)}")

    return hashlib.sha256(canonical_bytes).hexdigest()


def verify_record_hash(data: bytes | dict[str, Any] | str, expected_hash: str) -> bool:
    """
    Verify whether the calculated SHA-256 hash matches the expected hash.
    Uses constant-time comparison to prevent timing attacks.
    """
    if not expected_hash or not isinstance(expected_hash, str):
        return False
    calculated = calculate_record_hash(data)
    return hmac.compare_digest(calculated.lower(), expected_hash.lower())
