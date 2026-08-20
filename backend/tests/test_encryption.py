import os
import pytest
from app.services import encryption_service
from app.services.encryption_service import DecryptionError


def test_encrypt_decrypt_round_trip():
    """Verify that plaintext bytes encrypted with AES-256-GCM decrypt to exact original bytes."""
    plaintext = b"Patient diagnosis: Hypertension Stage 2. Sensitive clinical notes."
    encrypted = encryption_service.encrypt(plaintext)

    assert encrypted != plaintext
    assert len(encrypted) >= len(plaintext) + 28  # 12-byte nonce + 16-byte tag

    decrypted = encryption_service.decrypt(encrypted)
    assert decrypted == plaintext


def test_encrypt_string_round_trip():
    """Verify that UTF-8 string plaintext encrypts and decrypts correctly."""
    text = "Medical Prescription: Amoxicillin 500mg TID for 7 days."
    encrypted = encryption_service.encrypt(text)
    decrypted = encryption_service.decrypt(encrypted)
    assert decrypted.decode("utf-8") == text


def test_nonce_uniqueness():
    """Verify that multiple encryptions of the same plaintext use different random nonces."""
    plaintext = b"Identical clinical payload"
    enc1 = encryption_service.encrypt(plaintext)
    enc2 = encryption_service.encrypt(plaintext)

    assert enc1 != enc2
    # Nonces (first 12 bytes) must differ
    assert enc1[:12] != enc2[:12]

    # Both decrypt to the same plaintext
    assert encryption_service.decrypt(enc1) == plaintext
    assert encryption_service.decrypt(enc2) == plaintext


def test_tampered_ciphertext_fails():
    """Verify that altering even a single byte of ciphertext causes DecryptionError."""
    plaintext = b"Confidential Medical Record"
    encrypted = bytearray(encryption_service.encrypt(plaintext))

    # Tamper with a byte in the ciphertext body
    encrypted[-5] ^= 0xFF

    with pytest.raises(DecryptionError):
        encryption_service.decrypt(bytes(encrypted))


def test_tampered_nonce_fails():
    """Verify that altering the nonce causes authentication tag verification failure."""
    plaintext = b"Confidential Medical Record"
    encrypted = bytearray(encryption_service.encrypt(plaintext))

    # Tamper with the nonce (first 12 bytes)
    encrypted[0] ^= 0xFF

    with pytest.raises(DecryptionError):
        encryption_service.decrypt(bytes(encrypted))


def test_wrong_key_fails():
    """Verify that attempting to decrypt with a different 32-byte key fails."""
    key1 = os.urandom(32)
    key2 = os.urandom(32)

    plaintext = b"Patient record encrypted under key1"
    encrypted = encryption_service.encrypt(plaintext, key=key1)

    # Decrypt with correct key works
    assert encryption_service.decrypt(encrypted, key=key1) == plaintext

    # Decrypt with wrong key raises DecryptionError
    with pytest.raises(DecryptionError):
        encryption_service.decrypt(encrypted, key=key2)


def test_invalid_payload_length_fails():
    """Verify that payloads shorter than 28 bytes are rejected safely."""
    with pytest.raises(DecryptionError):
        encryption_service.decrypt(b"short_bytes")
