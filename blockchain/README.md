# MedVault — Blockchain Trust Layer (Phase 4)

Smart contracts and tooling for MedVault decentralized medical history ledger.

TAGLINE: *"Prove the right to access. Never expose the data."*

---

## Core Security & Privacy Principles

1. **The blockchain is NOT a medical database**: It is the shared trust, integrity, consent, and audit ledger.
2. **Zero Plaintext / PII on Blockchain**:
   - ❌ NO patient names, emails, phone numbers, Aadhaar, SSN, or addresses.
   - ❌ NO raw diagnoses, clinical notes, prescriptions, or doctor comments.
   - ❌ NO raw FHIR JSON documents or encryption keys.
   - ❌ NO prescription images, PDF scans, or diagnostic reports.
3. **What IS on Blockchain**:
   - ✅ 32-byte cryptographic SHA-256 integrity hashes (`bytes32 recordHash`).
   - ✅ Pseudonym patient commitments (`bytes32 patientCommitment = keccak256(patient_id + salt)`).
   - ✅ 32-byte storage commitments (`bytes32 storageCommitment`).
   - ✅ Time-bounded granular access permissions and revocation flags.
   - ✅ Ethereum address role access controls (`IdentityRegistry`).

---

## Smart Contracts

### 1. `IdentityRegistry.sol`
Manages decentralized participant roles using OpenZeppelin `AccessControl`:
- `PATIENT_ROLE`
- `DOCTOR_ROLE`
- `HOSPITAL_ROLE`
- `EMERGENCY_PROVIDER_ROLE`

### 2. `MedicalRecordRegistry.sol`
Anchors 32-byte record integrity commitments off-chain:
- `registerRecord(bytes32 recordId, bytes32 recordHash, bytes32 patientCommitment, bytes32 storageCommitment)`
- `verifyRecord(bytes32 recordId, bytes32 recordHash)`: Returns `bool` indicating whether off-chain data matches on-chain commitment.
- `revokeRecord(bytes32 recordId)`: Revokes record anchor.

### 3. `ConsentManager.sol`
Granular, time-bounded permission manager:
- Bitmask Permissions:
  - `VIEW_RECORD = 1`
  - `VIEW_DOCUMENT = 2`
  - `VIEW_FHIR = 4`
  - `DOWNLOAD_DOC = 8`
  - `FULL_ACCESS = 15`
- Functions:
  - `grantConsent(bytes32 recordId, address grantee, uint8 permissions, uint256 expiresAt)`
  - `revokeConsent(bytes32 recordId, address grantee)`
  - `isConsentValid(address patient, bytes32 recordId, address grantee, uint8 requiredPermission)`

---

## Running Smart Contract Tests

```bash
cd blockchain
npm install
npx hardhat test
```

### Test Suite Summary:
- **16/16 Unit Tests Passing (100%)**
  - `IdentityRegistry`: Role assignment, duplicate prevention, non-admin rejection, status deactivation.
  - `MedicalRecordRegistry`: Integrity anchoring, exact hash verification, tamper detection, duplicate protection, patient revocation.
  - `ConsentManager`: Granular bitmask validation, automatic time-based expiration, patient revocation, unauthorized revocation protection.

---

## Deploying Contracts

### Local Hardhat Node:
```bash
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

### Ethereum Sepolia Testnet:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```
Deployed addresses are automatically saved to `deployments/deployed_addresses.json`.
