# MedVault

**Privacy-first decentralized medical history ledger** — built for HackNexus'26.

TAGLINE: *"Prove the right to access. Never expose the data."*

Patients control access to their medical records and original diagnostic documents. Medical records are normalized to HL7 FHIR R4, committed with SHA-256 integrity hashes, encrypted with AES-256-GCM, and stored in off-chain object storage. The EVM blockchain smart contracts anchor record integrity, patient commitments, time-bounded granular consent, and revocation events. Zero-knowledge proofs enable authorization without exposing sensitive credentials or PII.

---

## Architecture Overview

```
Doctor / Hospital / Patient
  ↓
Next.js Frontend (Web3 Wallet + JWT Authentication + Encrypted Document & FHIR UI)
  ↓
FastAPI Backend (Ownership, Role-Based Access Control & Blockchain Service)
  ↓
FHIR Normalization (HL7 FHIR R4 Canonicalization) / Document Pipeline (PDF / Images)
  ↓
SHA-256 Integrity Commitment Calculation
  ↓
AES-256-GCM Authenticated Encryption (Random 12-byte Nonce + 16-byte Auth Tag)
  ↓
Off-Chain Encrypted Storage (LocalStorageService / IPFSStorageService)
  ↓
PostgreSQL Ledger (Metadata, Storage References & SHA-256 Integrity Hashes)
  ↓
EVM Blockchain Layer:
├── IdentityRegistry.sol (Decentralized Role Registry)
├── MedicalRecordRegistry.sol (SHA-256 Commitment & Pseudonym Anchor)
└── ConsentManager.sol (Time-Bound, Granular Bitmask Access & Revocation)
  ↓
ZK Authorization Proof (Phase 5)
  ↓
Authorized Doctor / Hospital Decrypted Access
```

**Critical Security Rules:**
1. Medical records, prescription images, and PDF blood reports are **NEVER stored on the blockchain or in plaintext public storage**.
2. The database holds only storage references (`encrypted_storage_ref`), integrity hashes (`record_hash`), and classification metadata.
3. The blockchain holds only 32-byte cryptographic hashes (`bytes32 recordHash`), patient pseudonym commitments (`bytes32 patientCommitment`), and access permissions.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (Turbopack), React 19, TypeScript, Tailwind CSS, Lucide Icons, App Router |
| Backend | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic |
| Auth & Security | bcrypt password hashing, JWT Bearer tokens, RBAC, Web3 Wallet Linking |
| Data Normalization | HL7 FHIR R4 (Observation, Condition, MedicationRequest, Encounter, Patient) |
| Encryption | AES-256-GCM authenticated encryption (256-bit keys, 12-byte random nonces) |
| Integrity | SHA-256 deterministic canonical hash commitments |
| Storage | Off-Chain encrypted object storage (`LocalStorageService`, prepared for `IPFSStorageService`) |
| Database | PostgreSQL 16 (Local Docker Compose / Supabase) |
| Blockchain | Solidity 0.8.24, Hardhat, OpenZeppelin AccessControl, ethers.js |
| Testing | pytest (69 backend tests), Hardhat (16 smart contract tests) — **100% Passing** |
| ZK Proofs | Noir *(Phase 5)* |

---

## Repository Structure

```
medvault/
├── frontend/          # Next.js 16 application
│   ├── app/           # App Router pages (/login, /register, /dashboard, /records, /consent, /access-requests, /audit)
│   ├── components/    # Layout shell, protected route guard, wallet-button, navigation
│   ├── lib/           # Centralized API client (15-25s AbortController timeout, auto JWT header)
│   ├── hooks/         # useAuth & useWallet Web3 hook
│   ├── services/      # Service layer (auth.ts, records.ts, health.ts)
│   ├── types/         # TypeScript domain types (MedicalRecord, Consent, BlockchainAnchor, BlockchainVerify)
│   └── public/        # Static assets
│
├── backend/           # FastAPI application
│   ├── alembic/       # Alembic database migrations (001_initial, 002_phase3_pipeline, 003_phase4_blockchain)
│   ├── app/
│   │   ├── main.py    # Application entry point & router registration
│   │   ├── api/       # Route handlers (auth, records, consent, access_requests, audit, health, roles)
│   │   ├── core/      # Config, database, security (bcrypt, JWT), dependencies
│   │   ├── models/    # SQLAlchemy models (User, Patient, Doctor, Hospital, MedicalRecord, Consent, AccessRequest, AuditLog)
│   │   ├── schemas/   # Pydantic validation schemas
│   │   ├── services/  # Service layer (fhir_service, encryption_service, integrity_service, storage_service, medical_record_service, blockchain_service, auth_service, audit_service)
│   │   └── repositories/ # Data access layer
│   ├── storage/       # Off-chain encrypted blob storage (git-ignored)
│   ├── tests/         # Complete pytest suite (69 automated tests)
│   └── requirements.txt
│
├── blockchain/        # Solidity 0.8.24 smart contracts & Hardhat suite
│   ├── contracts/     # IdentityRegistry.sol, MedicalRecordRegistry.sol, ConsentManager.sol
│   ├── scripts/       # deploy.js
│   ├── test/          # Hardhat unit tests (16 automated tests)
│   └── hardhat.config.js
│
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

### 1. Database
```bash
docker-compose up -d
```

### 2. Blockchain Smart Contracts
```bash
cd blockchain
npm install
npx hardhat test
```

### 3. Backend Setup
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

# Run backend test suite (69 tests)
pytest tests/ -v

# Start FastAPI dev server
uvicorn app.main:app --reload --port 8000
```
Backend API: **http://127.0.0.1:8000**
Interactive OpenAPI Swagger Docs: **http://127.0.0.1:8000/docs**

### 4. Frontend Setup
```bash
cd frontend
cp .env.example .env.local
npm install
npm run build
npm run dev
```
Frontend App: **http://localhost:3000**

---

## Implementation Roadmap Status

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

### ✅ Phase 2 — Core Ledger & Identity
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

### ✅ Phase 3 & 3.5 — Privacy Data Layer & Original Documents
- [x] HL7 FHIR R4 normalization & validation service (`Observation`, `Condition`, `MedicationRequest`, `Encounter`, `Patient`)
- [x] Deterministic JSON canonicalization for verifiable hashing
- [x] SHA-256 cryptographic integrity commitment service (`calculate_record_hash`, `verify_record_hash`)
- [x] AES-256-GCM authenticated encryption service (`encrypt`, `decrypt` with 12-byte random nonce and 16-byte auth tag)
- [x] Off-chain encrypted object storage abstraction (`LocalStorageService`, prepared for `IPFSStorageService`)
- [x] Original medical document support (Prescription images, blood reports, PDF scans encrypted with AES-256-GCM)
- [x] Authorized retrieval and decryption endpoints (`GET /api/records/{id}/decrypted`, `GET /api/records/{id}/document`)
- [x] On-demand cryptographic integrity verification endpoint (`GET /api/records/{id}/verify`)

### ✅ Phase 4 — Blockchain Trust, Record Anchoring, Consent & Audit
- [x] Solidity 0.8.24 smart contracts (`IdentityRegistry.sol`, `MedicalRecordRegistry.sol`, `ConsentManager.sol`)
- [x] Hardhat automated test suite (**16/16 smart contract tests passing**)
- [x] Privacy-preserving pseudonym patient commitment generation (`generate_patient_commitment`)
- [x] Medical record SHA-256 integrity anchoring on smart contracts (`POST /api/records/{id}/anchor`)
- [x] On-chain tamper verification against smart contract (`GET /api/records/{id}/blockchain-verify`)
- [x] Time-bounded, granular bitmask access consent (`VIEW_RECORD`, `VIEW_DOCUMENT`, `VIEW_FHIR`, `DOWNLOAD_DOC`)
- [x] Immediate on-chain consent revocation
- [x] Backend `BlockchainService` abstraction layer with offline fallback simulation
- [x] EVM Wallet Connection hook & top-nav widget (`useWallet`, `WalletButton`)
- [x] User EVM wallet address linking (`PATCH /api/auth/wallet`)
- [x] Frontend UI with Document Upload tab, On-Chain badges, Anchor actions, and Verify modal
- [x] Complete backend test suite (**69/69 automated tests passing**)

### 🔲 Phase 5 — Zero-Knowledge Privacy (Future)
- [ ] Noir ZK circuits for credential-free authorization
- [ ] On-chain proof verification
- [ ] Privacy-preserving access control

---

## License

Built for HackNexus'26.
