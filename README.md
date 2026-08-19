# MedVault

**Privacy-first decentralized medical history ledger** — built for HackNexus'26.

Patients control access to their medical records. Medical records are encrypted, stored off-chain, and referenced by blockchain metadata. The blockchain manages record integrity, consent, revocation, and audit events. Zero-knowledge proofs enable authorization without exposing sensitive credentials or PII.

---

## Architecture Overview

```
Patient
  ↓
Next.js Frontend (Real JWT Authentication)
  ↓
FastAPI Backend (Ownership & Consent Authorization)
  ↓
FHIR Normalization (Phase 3)
  ↓
AES-256-GCM Encryption (Phase 3)
  ↓
IPFS / Secure Off-Chain Storage (Phase 3)
  ↓
Blockchain Record Registry (hashes only — Phase 4)
  ↓
Consent Smart Contract (Phase 4)
  ↓
ZK Authorization Proof (Phase 5)
  ↓
Hospital / Doctor Access
```

**Critical rule:** Medical records are **never stored on-chain**. The blockchain only contains cryptographic commitments, consent state, minimal metadata, and audit events.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, App Router |
| Backend | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic |
| Auth & Security | bcrypt password hashing, JWT Bearer tokens, RBAC |
| Database | PostgreSQL 16 (Local Docker Compose / Supabase) |
| Testing | pytest (40 unit & integration tests) |
| Blockchain | Solidity, EVM Testnet *(Phase 4)* |
| ZK Proofs | Noir *(Phase 5)* |
| Storage | IPFS *(Phase 3)* |
| Encryption | AES-256-GCM *(Phase 3)* |
| Data Format | HL7 FHIR *(Phase 3)* |

---

## Repository Structure

```
medvault/
├── frontend/          # Next.js application
│   ├── app/           # App Router pages (/login, /register, /dashboard, /records, /consent, /access-requests, /audit)
│   ├── components/    # Layout shell, protected route guard, navigation
│   ├── lib/           # Centralized API client (auto JWT header attachment)
│   ├── hooks/         # Real useAuth authentication hook
│   ├── types/         # TypeScript domain types
│   └── public/        # Static assets
│
├── backend/           # FastAPI application
│   ├── alembic/       # Alembic database migrations
│   ├── app/
│   │   ├── main.py    # Application entry point & router registration
│   │   ├── api/       # Route handlers (auth, records, consent, access_requests, audit, health, roles)
│   │   ├── core/      # Config, database, security (bcrypt, JWT), dependencies
│   │   ├── models/    # SQLAlchemy models (User, Patient, Doctor, Hospital, MedicalRecord, Consent, AccessRequest, AuditLog)
│   │   ├── schemas/   # Pydantic validation schemas
│   │   ├── services/  # Service layer (authorization rules, audit logging)
│   │   └── repositories/ # Data access layer
│   ├── tests/         # Complete pytest suite (40 automated tests)
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

# Run backend tests (40 tests)
pytest tests/ -v

# Start FastAPI dev server
uvicorn app.main:app --reload --port 8000
```

The backend will be available at **http://localhost:8000**.
Interactive OpenAPI Swagger docs: **http://localhost:8000/docs**.

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
- [x] Test suite (40 automated tests with SQLite in-memory isolation)
- [x] Updated API, Architecture, and Security documentation

### 🔲 Phase 3 — Data Pipeline (Future)
- [ ] FHIR resource normalization
- [ ] AES-256-GCM encryption for records
- [ ] IPFS / secure off-chain storage
- [ ] Record hash generation pipeline

### 🔲 Phase 4 — Blockchain (Future)
- [ ] Solidity smart contracts (RecordRegistry, ConsentManager, AuditTrail)
- [ ] EVM testnet deployment
- [ ] ethers.js frontend integration
- [ ] Wallet authentication (MetaMask)

### 🔲 Phase 5 — Privacy (Future)
- [ ] Noir ZK circuits for authorization
- [ ] On-chain proof verification
- [ ] Privacy-preserving access control

---

## License

Built for HackNexus'26.
