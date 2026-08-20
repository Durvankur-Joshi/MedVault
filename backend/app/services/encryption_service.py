import base64
import os
from typing import Optional

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException, status

from app.core.config import settings

# Nonce size for AES-GCM is standard 12 bytes (96 bits)
GCM_NONCE_BYTES = 12
# Authentication tag size is 16 bytes (128 bits)
GCM_TAG_BYTES = 16
# Minimum payload length = nonce (12) + tag (16) = 28 bytes
MIN_PAYLOAD_BYTES = GCM_NONCE_BYTES + GCM_TAG_BYTES
# Required key length for AES-256 is exactly 32 bytes (256 bits)
KEY_BYTES = 32


class DecryptionError(HTTPException):
    """Raised when decryption or authentication tag verification fails."""

    def __init__(self, detail: str = "Medical record decryption failed: integrity check or authentication tag mismatch") -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def get_encryption_key(configured_key: Optional[str] = None) -> bytes:
    """
    Load and validate the 32-byte (256-bit) AES-256 key from configuration or argument.
    Supports both base64-encoded 32-byte strings and raw 32-byte strings.
    """
    raw = configured_key if configured_key is not None else settings.medical_record_encryption_key
    if not raw:
        raise ValueError("MEDICAL_RECORD_ENCRYPTION_KEY is not configured")

    # Try base64 decoding first
    try:
        decoded = base64.b64decode(raw, validate=True)
        if len(decoded) == KEY_BYTES:
            return decoded
    except Exception:
        pass

    # Fallback to UTF-8 encoded string if exactly 32 bytes
    utf8_bytes = raw.encode("utf-8")
    if len(utf8_bytes) == KEY_BYTES:
        return utf8_bytes

    raise ValueError(
        f"Invalid encryption key length: key must be exactly {KEY_BYTES} bytes (256 bits)"
    )


def encrypt(plaintext: bytes | str, key: Optional[bytes] = None) -> bytes:
    """
    Encrypt plaintext using AES-256-GCM authenticated encryption.
    Generates a cryptographically random 12-byte nonce for each call.

    Format of returned bytes:
        [12-byte Nonce] + [AES-256-GCM Ciphertext with 16-byte Auth Tag]

    Args:
        plaintext: The data to encrypt (bytes or UTF-8 str)
        key: Optional explicit 32-byte key (uses configured key if None)

    Returns:
        bytes: The packaged encrypted payload containing nonce + ciphertext + tag.
    """
    aes_key = key if key is not None else get_encryption_key()
    if isinstance(plaintext, str):
        plaintext_bytes = plaintext.encode("utf-8")
    elif isinstance(plaintext, bytes):
        plaintext_bytes = plaintext
    else:
        raise TypeError(f"Plaintext must be bytes or str, got {type(plaintext)}")

    # Cryptographically secure 12-byte random nonce
    nonce = os.urandom(GCM_NONCE_BYTES)

    aesgcm = AESGCM(aes_key)
    ciphertext_with_tag = aesgcm.encrypt(nonce, plaintext_bytes, None)

    # Package: Nonce (12 bytes) + Ciphertext + Tag (16 bytes)
    return nonce + ciphertext_with_tag


def decrypt(encrypted_payload: bytes, key: Optional[bytes] = None) -> bytes:
    """
    Decrypt an AES-256-GCM encrypted payload and verify the authentication tag.

    Args:
        encrypted_payload: Packaged bytes ([12-byte nonce] + [ciphertext + tag])
        key: Optional explicit 32-byte key (uses configured key if None)

    Returns:
        bytes: The decrypted plaintext bytes.

    Raises:
        DecryptionError: If the payload is corrupted, tampered, or the key is wrong.
    """
    if not isinstance(encrypted_payload, bytes):
        raise TypeError("Encrypted payload must be bytes")

    if len(encrypted_payload) < MIN_PAYLOAD_BYTES:
        raise DecryptionError("Encrypted payload is too short to contain a valid nonce and tag")

    aes_key = key if key is not None else get_encryption_key()

    nonce = encrypted_payload[:GCM_NONCE_BYTES]
    ciphertext_with_tag = encrypted_payload[GCM_NONCE_BYTES:]

    aesgcm = AESGCM(aes_key)
    try:
        decrypted_bytes = aesgcm.decrypt(nonce, ciphertext_with_tag, None)
        return decrypted_bytes
    except InvalidTag:
        raise DecryptionError()
    except Exception:
        raise DecryptionError()
