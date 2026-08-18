# MedVault

**Privacy-first decentralized medical history ledger** — built for HackNexus'26.

Patients control access to their medical records. Medical records are encrypted, stored off-chain, and referenced by blockchain metadata. The blockchain manages record integrity, consent, revocation, and audit events. Zero-knowledge proofs enable authorization without exposing sensitive credentials or PII.

---

## Architecture Overview

```
Patient
  ↓
Next.js Frontend
  ↓
FastAPI Backend
  ↓
FHIR Normalization
  ↓
AES-256-GCM Encryption
  ↓
IPFS / Secure Off-Chain Storage
  ↓
Blockchain Record Registry (hashes only)
  ↓
Consent Smart Contract
  ↓
ZK Authorization Proof
  ↓
Hospital / Doctor Access
```

**Critical rule:** Medical records are **never stored on-chain**. The blockchain only contains cryptographic commitments, consent state, minimal metadata, and audit events.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS, App Router |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy |
| Database | PostgreSQL (Supabase) |
| Blockchain | Solidity, EVM Testnet *(future)* |
| ZK Proofs | Noir *(future)* |
| Storage | IPFS *(future)* |
| Encryption | AES-256-GCM *(future)* |
| Data Format | FHIR *(future)* |

---

## Repository Structure

```
medvault/
├── frontend/          # Next.js application
│   ├── app/           # App Router pages
│   ├── components/    # Reusable UI components
│   ├── lib/           # Utilities and API client
│   ├── services/      # API service layer
│   ├── hooks/         # Custom React hooks
│   ├── types/         # TypeScript type definitions
│   └── public/        # Static assets
│
├── backend/           # FastAPI application
│   ├── app/
│   │   ├── main.py    # Application entry point
│   │   ├── api/       # Route handlers
│   │   ├── core/      # Config, database, security
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── services/  # Business logic
│   │   └── repositories/  # Data access layer
│   ├── tests/         # Test suite
│   └── requirements.txt
│
├── blockchain/        # Solidity contracts (future)
├── zk/                # ZK proof circuits (future)
│
├── docs/
│   ├── architecture/  # Architecture documentation
│   ├── api/           # API documentation
│   └── security/      # Security policies
│
├── .gitignore
├── docker-compose.yml # Local PostgreSQL
└── README.md
```

---

## Local Development Setup

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **PostgreSQL** ≥ 15 (or Docker)
- **npm** (comes with Node.js)

### Database

Start PostgreSQL using Docker Compose:

```bash
docker-compose up -d
```

This starts a PostgreSQL instance on `localhost:5432` with database `medvault`.

---

## Frontend Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The frontend will be available at **http://localhost:3000**.

### Frontend Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8000` |

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
uvicorn app.main:app --reload --port 8000
```

The backend will be available at **http://localhost:8000**.

Verify it works:

```bash
curl http://localhost:8000/api/health
# → {"status":"ok","service":"medvault-backend"}
```

### Backend Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/medvault` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |

---

## Current Implementation Status

### ✅ Phase 1 — Foundation (Current)
- [x] Monorepo structure
- [x] Next.js frontend with App Router, TypeScript, Tailwind CSS
- [x] Dashboard shell (sidebar, top nav, responsive layout)
- [x] All route pages (landing, login, dashboard, records, consent, access requests, audit)
- [x] TypeScript domain types
- [x] Centralized API client
- [x] Demo authentication context
- [x] FastAPI backend with modular architecture
- [x] Health check endpoint
- [x] SQLAlchemy models (User, Patient, Hospital, Doctor, MedicalRecord, Consent, AccessRequest, AuditLog)
- [x] Pydantic schemas
- [x] PostgreSQL configuration
- [x] Documentation

### 🔲 Phase 2 — Core Backend
- [ ] Alembic migrations
- [ ] User registration and authentication (JWT)
- [ ] CRUD APIs for records, consent, access requests
- [ ] Role-based access control
- [ ] Supabase integration

### 🔲 Phase 3 — Data Pipeline
- [ ] FHIR resource normalization
- [ ] AES-256-GCM encryption for records
- [ ] IPFS / secure off-chain storage
- [ ] Record hash generation

### 🔲 Phase 4 — Blockchain
- [ ] Solidity smart contracts (RecordRegistry, ConsentManager, AuditTrail)
- [ ] EVM testnet deployment
- [ ] ethers.js frontend integration
- [ ] Wallet authentication (MetaMask)

### 🔲 Phase 5 — Privacy
- [ ] Noir ZK circuits for authorization
- [ ] On-chain proof verification
- [ ] Privacy-preserving access control

---

## License

Built for HackNexus'26.
