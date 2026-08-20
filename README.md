# MedVault

**Privacy-first decentralized medical history ledger** — built for HackNexus'26.

Patients control access to their medical records. Medical records are normalized to HL7 FHIR R4, committed with SHA-256 integrity hashes, encrypted with AES-256-GCM, and stored in off-chain object storage. The ledger and future blockchain track record integrity, consent, revocation, and audit events. Zero-knowledge proofs enable authorization without exposing sensitive credentials or PII.

---

## Architecture Overview

```
Doctor / Hospital / Patient
  ↓
Next.js Frontend (Real JWT Authentication & Interactive FHIR Forms)
  ↓
FastAPI Backend (Ownership & Consent Authorization)
  ↓
FHIR Normalization (HL7 FHIR R4 Canonicalization)
  ↓
SHA-256 Integrity Commitment Calculation
  ↓
AES-256-GCM Authenticated Encryption (Random 12-byte Nonce + 16-byte Auth Tag)
  ↓
Off-Chain Encrypted Storage (LocalStorageService / IPFSStorageService)
  ↓
PostgreSQL Ledger (Metadata, Storage References & SHA-256 Integrity Hashes)
  ↓
Blockchain Record Registry (hashes only — Phase 4)
  ↓
Consent Smart Contract (Phase 4)
  ↓
ZK Authorization Proof (Phase 5)
  ↓
Hospital / Doctor Access
```

**Critical rule:** Medical records are **never stored in PostgreSQL or on-chain**. The database holds only storage references (`encrypted_storage_ref`), integrity hashes (`record_hash`), and classification metadata (`record_type`, `fhir_resource_type`).

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, App Router |
| Backend | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic |
| Auth & Security | bcrypt password hashing, JWT Bearer tokens, RBAC |
| Data Normalization | HL7 FHIR R4 (Observation, Condition, MedicationRequest, Encounter, Patient) |
| Encryption | AES-256-GCM authenticated encryption (256-bit keys, 12-byte random nonces) |
| Integrity | SHA-256 deterministic canonical hash commitments |
| Storage | Off-chain encrypted object storage (`LocalStorageService`, prepared for `IPFSStorageService`) |
| Database | PostgreSQL 16 (Local Docker Compose / Supabase) |
| Testing | pytest (61 unit & integration tests) |
| Blockchain | Solidity, EVM Testnet *(Phase 4)* |
| ZK Proofs | Noir *(Phase 5)* |

---

## Repository Structure

```
medvault/
├── frontend/          # Next.js application
│   ├── app/           # App Router pages (/login, /register, /dashboard, /records, /consent, /access-requests, /audit)
│   ├── components/    # Layout shell, protected route guard, navigation
│   ├── lib/           # Centralized API client (15-25s AbortController timeout, auto JWT header)
│   ├── hooks/         # Real useAuth authentication hook
│   ├── services/      # Service layer (auth.ts, records.ts, health.ts)
│   ├── types/         # TypeScript domain types
│   └── public/        # Static assets
│
├── backend/           # FastAPI application
│   ├── alembic/       # Alembic database migrations (001_initial, 002_phase3_pipeline)
│   ├── app/
│   │   ├── main.py    # Application entry point & router registration
│   │   ├── api/       # Route handlers (auth, records, consent, access_requests, audit, health, roles)
│   │   ├── core/      # Config, database, security (bcrypt, JWT), dependencies
│   │   ├── models/    # SQLAlchemy models (User, Patient, Doctor, Hospital, MedicalRecord, Consent, AccessRequest, AuditLog)
│   │   ├── schemas/   # Pydantic validation schemas
│   │   ├── services/  # Service layer (fhir_service, encryption_service, integrity_service, storage_service, medical_record_service, auth_service, audit_service)
│   │   └── repositories/ # Data access layer
│   ├── storage/       # Off-chain encrypted blob storage (git-ignored)
│   ├── tests/         # Complete pytest suite (61 automated tests)
│   └── requirements.txt
│
├── blockchain/        # Solidity contracts (Phase 4)
├── zk/                # ZK proof circuits (Phase 5)
│
├── docs/
│   ├── architecture/  # Layered architecture documentation
│   ├── api/           # Complete API documentation
│   └── security/      # Security & privacy policies
│
├── .gitignore
├── docker-compose.yml # Local PostgreSQL 16
└── README.md
```

---

## Local Development Setup

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **PostgreSQL** ≥ 15 (or Docker)
- **npm**

### Database

Start PostgreSQL using Docker Compose:

```bash
docker-compose up -d
```

This starts a PostgreSQL instance on `localhost:5432` with database `medvault`.

---

## Backend Setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Run database migrations
alembic upgrade head

# Run backend tests (61 tests)
pytest tests/ -v

# Start FastAPI dev server
uvicorn app.main:app --reload --port 8000
```

The backend will be available at **http://127.0.0.1:8000**.
Interactive OpenAPI Swagger docs: **http://127.0.0.1:8000/docs**.

---

## Frontend Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The frontend will be available at **http://localhost:3000**.

---

## Current Implementation Status

### ✅ Phase 1 — Foundation
- [x] Monorepo structure
- [x] Next.js frontend with App Router, TypeScript, Tailwind CSS
- [x] Dashboard shell (sidebar, top nav, responsive layout)
- [x] All route pages (landing, login, register, dashboard, records, consent, access requests, audit)
- [x] TypeScript domain types
- [x] Centralized API client
- [x] FastAPI backend with modular architecture
- [x] Health check endpoint
- [x] SQLAlchemy models (User, Patient, Hospital, Doctor, MedicalRecord, Consent, AccessRequest, AuditLog)
- [x] Pydantic schemas

### ✅ Phase 2 — Core Ledger
- [x] Alembic migrations (`backend/alembic/`)
- [x] Real JWT authentication (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`)
- [x] bcrypt password hashing
- [x] Role-based access control (RBAC dependencies)
- [x] Patient profile auto-creation
- [x] Medical Record metadata CRUD (`/api/records`) with strict ownership checks
- [x] Consent management (`/api/consent`) with grant, revoke, and expiry validation
- [x] Access request workflow (`/api/access-requests`) with approve (auto-consent) and deny
- [x] Non-PII audit logging API (`/api/audit`)
- [x] Frontend real JWT authentication (`useAuth`, login & register forms)
- [x] Frontend protected route guards (`ProtectedRoute`, `DashboardShell`)
- [x] Frontend connected pages for records, consent, access requests, and audit

### ✅ Phase 3 — Privacy-Preserving Medical Record Pipeline
- [x] HL7 FHIR R4 normalization & validation service (`Observation`, `Condition`, `MedicationRequest`, `Encounter`, `Patient`)
- [x] Deterministic JSON canonicalization for verifiable hashing
- [x] SHA-256 cryptographic integrity commitment service (`calculate_record_hash`, `verify_record_hash`)
- [x] AES-256-GCM authenticated encryption service (`encrypt`, `decrypt` with 12-byte random nonce and 16-byte auth tag)
- [x] Off-chain encrypted object storage abstraction (`LocalStorageService`, prepared for `IPFSStorageService`)
- [x] Medical record metadata storage in PostgreSQL with `encrypted_storage_ref`, `record_hash`, `encryption_version`, `storage_provider`
- [x] Authorized retrieval and decryption endpoint (`GET /api/records/{id}/decrypted`)
- [x] On-demand cryptographic integrity verification endpoint (`GET /api/records/{id}/verify`)
- [x] Frontend FHIR template selector and custom JSON builder
- [x] Frontend on-demand integrity verification modal & decrypted record inspector
- [x] Comprehensive test suite (**61/61 automated tests passing**)

### 🔲 Phase 4 — Blockchain (Next Phase)
- [ ] Solidity smart contracts (RecordRegistry, ConsentManager, AuditTrail)
- [ ] EVM testnet deployment
- [ ] ethers.js / viem frontend integration
- [ ] Wallet authentication (MetaMask)
- [ ] SHA-256 record commitment anchoring to smart contract

### 🔲 Phase 5 — Zero-Knowledge Privacy (Future)
- [ ] Noir ZK circuits for credential-free authorization
- [ ] On-chain proof verification
- [ ] Privacy-preserving access control

---

## License

Built for HackNexus'26.
