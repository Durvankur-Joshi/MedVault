# MedVault — Security Policy

## Core Principles

1. **Privacy by design** — Medical data is never stored in plaintext and never stored on public blockchains.
2. **Minimal metadata** — Phase 2 records and audit events hold only references and non-sensitive metadata.
3. **Patient sovereignty** — Patients control who can access their records and can revoke permissions at any time.
4. **Defense in depth** — Authentication verifies identity, but service-level authorization verifies record ownership and active consent.

---

## Phase 2 Security Architecture

### 1. Password Hashing
- Passwords are encrypted using **bcrypt** with randomly generated per-user salts (`gensalt()`).
- Plaintext passwords are never logged, stored in databases, or included in responses.

### 2. JWT Authentication
- Access tokens are signed using HMAC-SHA256 (`HS256`) with a configurable expiration time (default: 60 minutes).
- Payload contains minimal identity fields:
  - `sub`: User UUID
  - `role`: Account role (`patient`, `doctor`, `hospital_admin`)
  - `exp`: UTC expiration timestamp
- **No medical data, encryption keys, or PII is ever embedded in the JWT payload.**

### 3. Token Storage & Transmission (MVP Architecture)
- In this hackathon MVP frontend, the JWT is stored in `localStorage` and sent via `Authorization: Bearer <token>`.
- **Production Migration Note**: In production deployments, authentication will migrate to secure, signed `HttpOnly`, `SameSite=Strict`, `Secure` cookies to eliminate XSS token extraction vectors.
- Plaintext passwords, medical content, encryption keys, and FHIR payloads are **never stored in localStorage**.

### 4. Role-Based Access Control (RBAC) & Service-Level Authorization
- Routes use FastAPI dependencies (`require_role(...)`) to enforce minimum role capabilities.
- **Service Layer Ownership Checks**:
  - Medical records are strictly scoped to the owning patient.
  - Doctors cannot access patient records unless an **active, non-expired Consent** record exists for that specific record and doctor.
  - Consent revocation immediately invalidates access on subsequent requests.

### 5. Non-PII Audit Logging
- Every major security event is recorded in the `audit_logs` table:
  - `user.registered`, `user.login`
  - `record.created`, `record.deleted`
  - `consent.granted`, `consent.revoked`
  - `access.requested`, `access.approved`, `access.denied`
- **Audit Sanitization Rule**: Audit details contain only event metadata (e.g. `record_type=lab_result`). Audit logs **never** contain clinical diagnoses, prescriptions, lab values, encryption keys, passwords, or PII.

---

## Environment Variable Security

All sensitive credentials must be set via environment variables:

| Variable | Description | Exposure |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Backend Only |
| `JWT_SECRET_KEY` | Secret key for signing JWTs | Backend Only |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role administrative key | Backend Only (Never Frontend) |
| `SUPABASE_ANON_KEY` | Public anonymous API key | Public |
| `CORS_ORIGINS` | Permitted frontend origins | Backend Only |

**Never commit `.env` files with production secrets.**
