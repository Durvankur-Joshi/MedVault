# MedVault — Architecture

## System Architecture

MedVault is designed as a privacy-first medical records platform. The core architectural principle is that **medical data never touches the blockchain**. The blockchain serves only as an integrity and consent layer.

## Data Flow

```
Patient (Browser)
    │
    ▼
┌─────────────────────┐
│   Next.js Frontend   │  UI, forms, dashboards
│   (App Router)       │  Role-based views
└─────────┬───────────┘
          │ HTTPS / REST
          ▼
┌─────────────────────┐
│   FastAPI Backend    │  Authentication, authorization
│                     │  Business logic, validation
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  FHIR Normalization  │  Convert medical data to
│                     │  standardized FHIR resources
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  AES-256-GCM        │  Encrypt FHIR resources
│  Encryption         │  Patient-controlled keys
└─────────┬───────────┘
          │
          ├──────────────────────────────────┐
          ▼                                  ▼
┌─────────────────────┐      ┌──────────────────────────┐
│  IPFS / Secure      │      │  PostgreSQL               │
│  Off-Chain Storage   │      │  (Metadata, references,   │
│  (Encrypted blobs)   │      │   user accounts)          │
└─────────┬───────────┘      └──────────────────────────┘
          │
          ▼
┌─────────────────────┐
│  Blockchain          │  Record hash commitments
│  Record Registry     │  Consent state
│  (EVM)               │  Audit trail
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Consent Smart       │  Grant / revoke / expire
│  Contract            │  Per-record permissions
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  ZK Authorization    │  Prove access right
│  (Noir circuits)     │  Without revealing identity
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Hospital / Doctor   │  Decrypt and view record
│  Access              │  With valid consent proof
└─────────────────────┘
```

## What Goes On-Chain vs. Off-Chain

### On-Chain (Blockchain)
- Cryptographic hash of the medical record
- Consent grants, revocations, and expiry timestamps
- Minimal metadata (record type, timestamp, patient pseudonym)
- Audit events (who accessed what, when)
- Zero-knowledge authorization proofs

### Off-Chain (IPFS + PostgreSQL)
- Encrypted medical record content (FHIR resources)
- User profiles and credentials
- Session data
- Encryption keys (patient-controlled)
- Detailed access logs

### Never On-Chain
- Patient name
- Diagnosis or medical report contents
- Prescriptions
- Aadhaar number
- Phone number
- Address
- Any other PII

## Component Responsibilities

| Component | Responsibility |
|---|---|
| **Next.js Frontend** | User interface, role-based dashboards, consent management UI |
| **FastAPI Backend** | REST API, authentication, authorization, business logic |
| **PostgreSQL** | User accounts, metadata, references to encrypted records |
| **FHIR Engine** | Normalize medical data into interoperable FHIR resources |
| **Encryption Layer** | AES-256-GCM encryption of medical records before storage |
| **IPFS** | Decentralized storage of encrypted medical record blobs |
| **Blockchain** | Immutable record registry, consent management, audit trail |
| **ZK Circuits** | Privacy-preserving proof of authorization |

## Security Model

1. **Data at rest**: All medical records encrypted with AES-256-GCM before leaving the backend
2. **Data in transit**: HTTPS everywhere
3. **Access control**: Smart contract-managed consent with ZK proof verification
4. **Key management**: Patient-controlled encryption keys (future: key splitting / MPC)
5. **Audit**: Immutable on-chain audit trail of all access events
6. **Privacy**: Zero-knowledge proofs ensure authorization without identity disclosure

## Current Phase

Phase 1 implements the monorepo foundation:
- Frontend shell with routing and demo auth
- Backend with health check and database models
- No blockchain, no ZKP, no encryption, no IPFS
- These will be integrated in subsequent phases
