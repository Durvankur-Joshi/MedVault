# MedVault — Security Policy

## Core Principles

1. **Privacy by design** — Medical data is encrypted before it leaves the backend
2. **Minimal on-chain data** — Blockchain stores only hashes, consent state, and audit metadata
3. **Patient sovereignty** — Patients control who can access their records and for how long
4. **Zero-knowledge authorization** — Prove access rights without revealing identity

## Data Classification

### Highly Sensitive (Never On-Chain, Always Encrypted)
- Medical diagnoses
- Prescriptions and medications
- Lab results and imaging
- Treatment plans
- Medical history

### Sensitive (Never On-Chain, Database Protected)
- Patient names and contact information
- Aadhaar numbers and government IDs
- Phone numbers and email addresses
- Physical addresses
- Date of birth

### Public Metadata (May Be On-Chain)
- Record type identifier (e.g., "lab_result", "prescription")
- Cryptographic hash of encrypted record
- Consent grant/revocation timestamps
- Access audit event identifiers
- Patient pseudonym (not real identity)

## Development Rules

### Never Do
- Store medical PII in blockchain transactions
- Log medical record contents
- Hardcode API keys or database credentials
- Commit `.env` files to version control
- Create fake cryptographic implementations
- Create fake ZKP verification
- Create fake blockchain transactions
- Store plaintext medical records as permanent storage
- Expose PII in API error messages

### Always Do
- Use environment variables for all secrets
- Use `.env.example` with placeholder values only
- Encrypt medical records before off-chain storage
- Hash records for blockchain commitments
- Validate consent before granting access
- Log audit events (without PII content)
- Use HTTPS in production

## Environment Variable Security

All sensitive configuration must be stored in environment variables:

| Variable | Contains |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string with credentials |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase API key |
| `CORS_ORIGINS` | Allowed frontend origins |

**Never commit values for these variables.** Only `.env.example` files with placeholders are committed.
