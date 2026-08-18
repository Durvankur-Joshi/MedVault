# MedVault — Zero-Knowledge Proofs

This directory will contain zero-knowledge proof circuits for privacy-preserving authorization.

## Planned Components

- **Authorization Circuit** — Prove a user has valid consent to access a record without revealing their identity or credentials
- **Role Verification** — Prove a user holds a specific role (e.g., Doctor) without exposing their full credential set

## Technology

- **Noir** — ZK DSL for writing circuits
- Target: EVM-compatible verification

## Architectural Rules

- ZK proofs are used to **prove authorization**, not to store or transmit medical data.
- Proofs must never contain PII as public inputs.

## Status

🔲 Not implemented — Phase 1 focuses on the monorepo foundation and backend/frontend scaffolding.
