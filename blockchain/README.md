# MedVault — Blockchain Contracts

This directory will contain Solidity smart contracts for the MedVault platform.

## Planned Contracts

- **RecordRegistry.sol** — On-chain registry of medical record commitments (hashes only, never PII)
- **ConsentManager.sol** — Manages patient consent grants, revocations, and expiry
- **AuditTrail.sol** — Immutable audit log of access events

## Architectural Rules

- **No medical data on-chain.** Only cryptographic commitments, consent state, and audit metadata.
- **No PII on-chain.** No names, diagnoses, prescriptions, Aadhaar numbers, phone numbers, or addresses.
- Medical records are encrypted and stored off-chain (IPFS or secure storage). The blockchain only references them by hash.

## Status

🔲 Not implemented — Phase 1 focuses on the monorepo foundation and backend/frontend scaffolding.
