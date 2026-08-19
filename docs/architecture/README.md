# MedVault — Architecture

## System Architecture

MedVault is designed as a privacy-first medical records platform. The core architectural principle is that **medical data never touches the public blockchain**. The blockchain serves only as an integrity, consent, and audit layer.

---

## Phase 2 Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                     │
│  - App Router (/dashboard, /records, /consent, etc.)    │
│  - Real JWT Authentication (AuthProvider, ProtectedRoute)│
│  - Centralized API Client (Authorization: Bearer <JWT>) │
└────────────────────────────┬────────────────────────────┘
                             │ HTTPS / JSON REST
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Backend                      │
│  - Route Handlers (/api/auth, /api/records, /consent...)│
│  - CORS Middleware                                      │
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
│  - Alembic Schema Migrations                            │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                   │
│  - Local: Docker Compose PostgreSQL 16 Alpine           │
│  - Deployment: Supabase Managed PostgreSQL              │
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

## What Goes On-Chain vs. Off-Chain (Future Phases)

### On-Chain (Blockchain — Phase 4)
- Cryptographic SHA-256 hash of the medical record
- Consent grants, revocations, and expiry timestamps
- Minimal metadata (record type, timestamp, pseudonym)
- Audit events
- Zero-knowledge authorization proofs

### Off-Chain (IPFS + PostgreSQL — Phase 2 & Phase 3)
- Encrypted medical record content (FHIR resources in Phase 3)
- User accounts, password hashes (bcrypt), and profiles (Phase 2)
- Safe record metadata & reference IDs (Phase 2)
- Detailed immutable access audit trail (Phase 2)

### Never Stored On-Chain or in Plaintext Audit Logs
- Patient name and government IDs
- Clinical diagnoses, prescriptions, lab values, or medical notes
- Plaintext medical files or encryption keys
- Passwords or raw JWT tokens

---

## Implementation Status

- **Phase 1 — Foundation**: Completed
- **Phase 2 — Core Ledger**: Completed
  - Real JWT authentication (register, login, /me)
  - RBAC dependencies & role validation
  - Medical Record metadata CRUD & ownership authorization
  - Consent management (grant, list, get, revoke, expiry enforcement)
  - Access request workflow (request, approve with auto-consent, deny)
  - Non-PII audit logging API
  - Alembic migrations & database schema
  - Isolated test database suite (40/40 tests passing)
  - Frontend real authentication & protected route guards
- **Phase 3 — Data Pipeline**: Future (FHIR normalization, AES-256-GCM encryption, IPFS off-chain storage)
- **Phase 4 — Blockchain**: Future (Solidity smart contracts, EVM testnet)
- **Phase 5 — Privacy**: Future (Noir ZK circuits)
