# MedVault — Architecture

## System Architecture

MedVault is designed as a privacy-first medical records platform. The core architectural principle is that **medical data never touches the public blockchain or PostgreSQL in plaintext**. The blockchain serves only as an integrity, consent, and audit layer.

---

## Phase 3 Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                     │
│  - App Router (/dashboard, /records, /consent, etc.)    │
│  - Real JWT Authentication (AuthProvider, ProtectedRoute)│
│  - Interactive FHIR R4 Clinical Record Templates        │
│  - Decrypted Record Inspector & Integrity Verifier      │
│  - Centralized API Client (15-25s AbortController)      │
└────────────────────────────┬────────────────────────────┘
                             │ HTTPS / JSON REST
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Backend                      │
│  - Route Handlers (/api/auth, /api/records, /consent...)│
│  - CORS Middleware (localhost:3000 & 127.0.0.1:3000)    │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│           Authentication & Dependency Layer             │
│  - JWT Verification (get_current_user)                  │
│  - Role Verification (require_role)                     │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                Medical Record Pipeline                  │
│                                                         │
│   1. FHIRService                                        │
│      ├── Validates HL7 FHIR R4 resource structure       │
│      └── Canonicalizes deterministic UTF-8 JSON         │
│                                                         │
│   2. IntegrityService                                   │
│      ├── Computes SHA-256 integrity hash commitment     │
│      └── Verifies hashes in constant time               │
│                                                         │
│   3. EncryptionService                                  │
│      ├── AES-256-GCM authenticated encryption           │
│      ├── 12-byte cryptographically secure random nonce  │
│      └── 16-byte authentication tag verification        │
│                                                         │
│   4. StorageService                                     │
│      ├── LocalStorageService (stores encrypted blobs)   │
│      └── IPFSStorageService (prepared for Phase 4)      │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                      Service Layer                      │
│  - Business Authorization (Ownership & Consent Checks)  │
│  - Non-PII Audit Event Logging                         │
│  - Access Request Approval -> Consent Automation        │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    Repository Layer                     │
│  - Pure Database CRUD Queries                           │
│  - MedicalRecord, Consent, AccessRequest, AuditLog Repos│
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                     SQLAlchemy ORM                      │
│  - Declarative Models (Base, UUIDMixin)                 │
│  - Alembic Schema Migrations (001_initial, 002_phase3)  │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                   │
│  - Stores metadata, storage refs, & SHA-256 hashes only │
│  - Local Docker Compose / Supabase                      │
└─────────────────────────────────────────────────────────┘
```

---

## Core Security Architectural Principle: JWT ≠ Authorization

- **JWT (Authentication)**: Validates *who* the user is and what system role they hold (`patient`, `doctor`, `hospital_admin`).
- **Service Layer (Authorization)**: Validates *whether* the authenticated user has legitimate access to a specific record or resource.
  - A patient can only access and delete their own medical records.
  - A doctor can only access records where an **active, non-expired Consent** has been explicitly granted by the patient.
  - A hospital admin cannot arbitrarily view any patient's records.

A valid JWT alone is **never** sufficient to read or modify medical record data.

---

## What Goes On-Chain vs. Off-Chain

### On-Chain (Blockchain — Phase 4)
- Cryptographic SHA-256 hash of the medical record
- Consent grants, revocations, and expiry timestamps
- Minimal metadata (record type, timestamp, pseudonym)
- Audit events
- Zero-knowledge authorization proofs

### Off-Chain (Encrypted Storage & PostgreSQL)
- Encrypted medical record content (AES-256-GCM binary blobs in `storage/encrypted` or IPFS)
- User accounts, password hashes (bcrypt), and profiles
- Safe record metadata & reference IDs
- Detailed immutable access audit trail

### Never Stored On-Chain, in PostgreSQL, or in Plaintext Audit Logs
- Patient name and government IDs
- Clinical diagnoses, prescriptions, lab values, or medical notes
- Plaintext medical files or encryption keys
- Passwords or raw JWT tokens

---

## Implementation Status

- **Phase 1 — Foundation**: Completed
- **Phase 2 — Core Ledger**: Completed
- **Phase 3 — Data Pipeline**: Completed
  - FHIR R4 normalization & deterministic canonicalization
  - SHA-256 integrity hash calculation & verification
  - AES-256-GCM authenticated encryption (random nonce + auth tag)
  - Off-chain encrypted object storage (`LocalStorageService`, IPFS interface)
  - Metadata & commitment storage in PostgreSQL
  - Authorized retrieval, decryption, and integrity check endpoint
  - Comprehensive test suite (**61/61 automated tests passing**)
- **Phase 4 — Blockchain**: Next Phase (Solidity smart contracts, EVM testnet, SHA-256 anchoring)
- **Phase 5 — Privacy**: Future (Noir ZK circuits)
