# MedVault — Zero-Knowledge Medical History Ledger

**Privacy-first decentralized medical history ledger** — built for HackNexus'26.

> **"MedVault does not put healthcare data on the blockchain. It puts trust, consent, integrity, and verifiable authorization between healthcare institutions on a privacy-preserving decentralized layer."**

TAGLINE: *"Prove the right to access. Never expose the data."*

Patients maintain sovereign control over their medical records and diagnostic files. Clinical data is normalized to HL7 FHIR R4, committed via SHA-256 integrity hashes, encrypted with AES-256-GCM, and stored in off-chain encrypted storage. EVM smart contracts on Ethereum Sepolia anchor cryptographic commitments, patient pseudonym IDs, time-bounded granular consent, and immediate revocation events. Zero-Knowledge authorization circuits enable verified record sharing between healthcare providers without exposing credentials, diagnoses, or patient PII.

---

## Architecture Overview

```
Doctor / Hospital / Patient
  ↓
Next.js Frontend (MetaMask Sepolia + JWT Auth + Structured Clinical Form & In-App Document Viewer)
  ↓
FastAPI Backend (Ownership, Role-Based Access Control & Blockchain Service)
  ↓
FHIR Normalization (HL7 FHIR R4 Canonicalization) / Document Pipeline (PDF / Diagnostic Images)
  ↓
SHA-256 Integrity Commitment Calculation
  ↓
AES-256-GCM Authenticated Encryption (Random 12-byte Nonce + 16-byte Auth Tag)
  ↓
Off-Chain Encrypted Storage (LocalStorageService / IPFS Storage Abstraction)
  ↓
PostgreSQL Ledger (Metadata, Storage References & SHA-256 Integrity Hashes)
  ↓
EVM Blockchain Layer (Ethereum Sepolia Testnet):
├── IdentityRegistry.sol (0xD7ACd2a9FD159E69Bb102A1ca21C9a3e3A5F771B)
├── MedicalRecordRegistry.sol (0x7EF2e0048f5bAeDe046f6BF797943daF4ED8CB47)
├── ConsentManager.sol (0xDA0bab807633f07f013f94DD0E6A4F96F8742B53)
└── ZKVerifier.sol (0x358AA13c52544ECCEF6B0ADD0f801012ADAD5eE3)
  ↓
Noir Zero-Knowledge Authorization Proof (BN254 Pedersen Circuit)
  ↓
Authorized Doctor / Hospital Decrypted Clinical Access
```

**Critical Security Invariants:**
1. Medical records, prescription images, and PDF blood reports are **NEVER stored on the blockchain or in plaintext public storage**.
2. The database holds only off-chain encrypted storage pointers (`encrypted_storage_ref`), integrity hashes (`record_hash`), and classification metadata.
3. The blockchain holds strictly 32-byte cryptographic commitments (`bytes32 recordHash`), patient pseudonym commitments (`bytes32 patientCommitment`), and access permissions.
4. Zero-Knowledge circuits prove authorization using private witness secrets without ever revealing patient names, diagnoses, prescriptions, or doctor credentials.

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
| Storage | Off-Chain encrypted object storage (`LocalStorageService`, pluggable `StorageService` abstraction) |
| Database | PostgreSQL 16 (Local Docker Compose / Supabase) |
| Blockchain | Solidity 0.8.24, Hardhat, OpenZeppelin AccessControl, ethers.js, Sepolia Testnet |
| ZK Circuits | Noir BN254 circuit (`zk/authorization`), `ZKVerifier.sol`, `zk_service.py` |
| Testing | pytest (104 backend tests), Hardhat (20 smart contract tests) — **100% Passing** |

---

## Smart Contract Deployments (Sepolia Testnet)

| Contract | Network | Deployed Address | Etherscan Link |
|---|---|---|---|
| **IdentityRegistry** | Sepolia (11155111) | `0xD7ACd2a9FD159E69Bb102A1ca21C9a3e3A5F771B` | [View Contract](https://sepolia.etherscan.io/address/0xD7ACd2a9FD159E69Bb102A1ca21C9a3e3A5F771B) |
| **MedicalRecordRegistry** | Sepolia (11155111) | `0x7EF2e0048f5bAeDe046f6BF797943daF4ED8CB47` | [View Contract](https://sepolia.etherscan.io/address/0x7EF2e0048f5bAeDe046f6BF797943daF4ED8CB47) |
| **ConsentManager** | Sepolia (11155111) | `0xDA0bab807633f07f013f94DD0E6A4F96F8742B53` | [View Contract](https://sepolia.etherscan.io/address/0xDA0bab807633f07f013f94DD0E6A4F96F8742B53) |
| **ZKVerifier** | Sepolia (11155111) | `0x358AA13c52544ECCEF6B0ADD0f801012ADAD5eE3` | [View Contract](https://sepolia.etherscan.io/address/0x358AA13c52544ECCEF6B0ADD0f801012ADAD5eE3) |

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

# Run backend test suite (104 tests)
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
- [x] Centralized API client with categorized error handling
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
- [x] Off-chain encrypted object storage abstraction (`LocalStorageService`, pluggable `StorageService`)
- [x] Original medical document support (Prescription images, blood reports, PDF scans encrypted with AES-256-GCM)
- [x] Authorized retrieval and decryption endpoints (`GET /api/records/{id}/decrypted`, `GET /api/records/{id}/document`)
- [x] On-demand cryptographic integrity verification endpoint (`GET /api/records/{id}/verify`)

### ✅ Phase 4 — Blockchain Trust, Record Anchoring, Consent & Audit
- [x] Solidity 0.8.24 smart contracts (`IdentityRegistry.sol`, `MedicalRecordRegistry.sol`, `ConsentManager.sol`)
- [x] Hardhat automated test suite (**20/20 smart contract tests passing**)
- [x] Privacy-preserving pseudonym patient commitment generation (`generate_patient_commitment`)
- [x] Medical record SHA-256 integrity anchoring on smart contracts (`POST /api/records/{id}/anchor`)
- [x] On-chain tamper verification against smart contract (`GET /api/records/{id}/blockchain-verify`)
- [x] Time-bounded, granular bitmask access consent (`VIEW_RECORD`, `VIEW_DOCUMENT`, `VIEW_FHIR`, `DOWNLOAD_DOC`)
- [x] Immediate on-chain consent revocation
- [x] Backend `BlockchainService` abstraction layer with offline fallback simulation
- [x] EVM Wallet Connection hook & top-nav widget (`useWallet`, `WalletButton`)
- [x] User EVM wallet address linking (`PATCH /api/auth/wallet`)
- [x] Frontend UI with Document Upload tab, On-Chain badges, Anchor actions, and Verify modal

### ✅ Phase 5 — Zero-Knowledge Authorization & Privacy (Noir BN254)
- [x] Noir Zero-Knowledge circuit (`zk/authorization/src/main.nr`) proving authorization bindings
- [x] Deterministic BN254 Pedersen commitment generation & witness derivation
- [x] Nullifier replay protection in smart contract (`ZKVerifier.sol`)
- [x] ZK proof generation & verification API endpoints (`/api/zk/generate-proof`, `/api/zk/verify`)
- [x] Strict 13-stage pre-decryption authorization pipeline enforcing active consent and ZK proof validity
- [x] Complete test suite (**104/104 backend tests passing**)

### ✅ Phase 6 — Web3 UX, Sepolia Testnet & Security Hardening
- [x] Clickable Sepolia Etherscan transaction & wallet explorer links (`BlockchainTxLink`)
- [x] Client-side Web3 signing for patient consent & record anchoring via MetaMask
- [x] Accurate Sepolia network detection (`11155111` / `0xaa36a7`) with 1-click network switcher
- [x] Structured clinical medical record form generating valid FHIR R4 payloads
- [x] Patient doctor search by display name, specialty, and license ID (`GET /api/patients/doctors/search`)
- [x] Granular consent modal dialog with bitmask permissions and duration selection
- [x] Doctor blockchain identity modal verifying live `IdentityRegistry.sol` on-chain status
- [x] In-app decrypted PDF viewer and high-res image lightbox with SHA-256 integrity badges
- [x] Hardhat fallback address elimination in real Sepolia mode

---

## License

Built for HackNexus'26.
