# MedVault — Security & Privacy Policy

## Core Principles

1. **Privacy by design** — Medical data is never stored in plaintext and never stored on public blockchains.
2. **Deterministic Canonicalization** — Clinical data is normalized to HL7 FHIR R4 to ensure reliable, reproducible integrity hashing.
3. **Authenticated Encryption** — Clinical payloads are encrypted using AES-256-GCM with fresh 12-byte random nonces and 16-byte authentication tags.
4. **Minimal metadata** — Databases and blockchain hold only storage references (`encrypted_storage_ref`) and cryptographic commitments (`record_hash`).
5. **Patient sovereignty** — Patients control who can access their records and can revoke permissions at any time.
6. **Defense in depth** — Authentication verifies identity, while service-level authorization verifies record ownership and active consent before decryption.

---

## Phase 3 Cryptographic & Privacy Architecture

### 1. AES-256-GCM Authenticated Encryption
- **Algorithm**: AES (Advanced Encryption Standard) with Galois/Counter Mode (GCM).
- **Key Length**: 256 bits (32 bytes).
- **Nonce/IV**: 96 bits (12 bytes) generated via cryptographically secure random generator (`os.urandom(12)`). Fresh nonce generated for every single record encryption.
- **Authentication Tag**: 128 bits (16 bytes) verified automatically on decryption.
- **Tamper Resistance**: Any alteration to ciphertext or nonce immediately triggers `DecryptionError` and aborts decryption without leaking internal crypto state.
- **Storage Location**: Off-chain object storage (`storage/encrypted/<uuid>.enc` or IPFS). Git-ignored and excluded from version control.

### 2. SHA-256 Cryptographic Commitments & Integrity
- **Algorithm**: SHA-256 over canonicalized FHIR R4 UTF-8 bytes.
- **Verification**: On retrieval, the decrypted payload is hashed and compared to the stored PostgreSQL commitment using constant-time comparison (`hmac.compare_digest`).
- **Blockchain Anchoring (Phase 4)**: This 64-character hex commitment will be anchored to the `MedicalRecordRegistry` smart contract on EVM testnet.

### 3. Key Management Architecture
- **MVP Key Management**: Application-level master encryption key loaded securely from `MEDICAL_RECORD_ENCRYPTION_KEY` environment variable.
- **Production Key Management RoadMap**: Envelope encryption with Hardware Security Modules (HSM) / Key Management Services:
  - AWS KMS
  - Google Cloud KMS
  - Azure Key Vault
  - HashiCorp Vault

### 4. Password Hashing & JWT Authentication
- Passwords are encrypted using **bcrypt** with randomly generated per-user salts (`gensalt()`).
- JWT tokens signed with `HS256` contain minimal identity claims (`sub`, `role`, `exp`). No PII or medical data.

### 5. Non-PII Audit Logging
- Every access, encryption, decryption, verification, and deletion event is recorded:
  - `record.created`, `record.accessed`, `record.verified`, `record.deleted`
  - `consent.granted`, `consent.revoked`
  - `access.requested`, `access.approved`, `access.denied`
- **Audit Sanitization Rule**: Audit details contain only event metadata (e.g. `record_type=observation,fhir=Observation`). Audit logs **never** contain clinical diagnoses, prescriptions, lab values, encryption keys, passwords, or PII.

---

## Environment Variable Security

| Variable | Description | Exposure |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Backend Only |
| `JWT_SECRET_KEY` | Secret key for signing JWTs | Backend Only |
| `MEDICAL_RECORD_ENCRYPTION_KEY` | 32-byte base64 AES-256 key | Backend Only |
| `STORAGE_PATH` | Directory for off-chain encrypted blobs | Backend Only |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role administrative key | Backend Only |
| `SUPABASE_ANON_KEY` | Public anonymous API key | Public |
| `CORS_ORIGINS` | Permitted frontend origins | Backend Only |
| `NEXT_PUBLIC_API_URL` | Backend URL for frontend API client | Frontend Public |

**Never commit `.env` or `.env.local` files with production secrets.**
