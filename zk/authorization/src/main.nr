use dep::std;

// ============================================================================
// MedVault Zero-Knowledge Privacy-Preserving Authorization Circuit (Phase 5)
//
// Core Principle: "Prove the right to access. Never expose the data."
//
// Purpose:
// Proves that a requester possesses valid authorization credentials and consent
// to access a specific medical record WITHOUT revealing:
// - Requester identity or doctor credentials
// - Patient identity, Aadhaar, name, or PII
// - Medical diagnoses, prescription text, notes, or raw FHIR JSON
// - Encryption keys or storage paths
// ============================================================================

fn main(
    // === PRIVATE WITNESS INPUTS (Never revealed to verifier/public) ===
    requester_secret: Field,
    authorization_secret: Field,
    record_secret_salt: Field,

    // === PUBLIC INPUTS (Known to ledger, smart contracts, & verifier) ===
    record_commitment: pub Field,
    authorization_commitment: pub Field,
    requester_nullifier: pub Field
) {
    // 1. Verify authorization commitment binding:
    // Proves the requester possesses the authorization secret corresponding to this grant
    // authorization_commitment == pedersen_hash([requester_secret, authorization_secret])
    let computed_auth_commitment = std::hash::pedersen_hash([requester_secret, authorization_secret]);
    assert(computed_auth_commitment == authorization_commitment);

    // 2. Verify record commitment binding:
    // Proves the authorization secret is bound to the target record's commitment
    // record_commitment == pedersen_hash([authorization_secret, record_secret_salt])
    let computed_record_commitment = std::hash::pedersen_hash([authorization_secret, record_secret_salt]);
    assert(computed_record_commitment == record_commitment);

    // 3. Verify requester nullifier:
    // Generates a deterministic, unlinkable pseudorandom identifier per access
    // requester_nullifier == pedersen_hash([requester_secret, record_commitment])
    let computed_nullifier = std::hash::pedersen_hash([requester_secret, record_commitment]);
    assert(computed_nullifier == requester_nullifier);
}

// ============================================================================
// NOIR CIRCUIT UNIT TESTS
// ============================================================================

#[test]
fn test_valid_authorization() {
    let requester_secret: Field = 0x123456789abcdef0;
    let authorization_secret: Field = 0x987654321fedcba0;
    let record_secret_salt: Field = 0xabcdef1234567890;

    let auth_commitment = std::hash::pedersen_hash([requester_secret, authorization_secret]);
    let record_commitment = std::hash::pedersen_hash([authorization_secret, record_secret_salt]);
    let nullifier = std::hash::pedersen_hash([requester_secret, record_commitment]);

    main(
        requester_secret,
        authorization_secret,
        record_secret_salt,
        record_commitment,
        auth_commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_invalid_authorization_secret() {
    let requester_secret: Field = 0x123456789abcdef0;
    let authorization_secret: Field = 0x987654321fedcba0;
    let wrong_auth_secret: Field = 0x9999999999999999;
    let record_secret_salt: Field = 0xabcdef1234567890;

    let auth_commitment = std::hash::pedersen_hash([requester_secret, authorization_secret]);
    let record_commitment = std::hash::pedersen_hash([authorization_secret, record_secret_salt]);
    let nullifier = std::hash::pedersen_hash([requester_secret, record_commitment]);

    // Should fail: wrong authorization secret provided
    main(
        requester_secret,
        wrong_auth_secret,
        record_secret_salt,
        record_commitment,
        auth_commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_tampered_record_commitment() {
    let requester_secret: Field = 0x123456789abcdef0;
    let authorization_secret: Field = 0x987654321fedcba0;
    let record_secret_salt: Field = 0xabcdef1234567890;

    let auth_commitment = std::hash::pedersen_hash([requester_secret, authorization_secret]);
    let tampered_record_commitment: Field = 0xdeadbeef11223344;
    let nullifier = std::hash::pedersen_hash([requester_secret, tampered_record_commitment]);

    // Should fail: tampered record commitment
    main(
        requester_secret,
        authorization_secret,
        record_secret_salt,
        tampered_record_commitment,
        auth_commitment,
        nullifier
    );
}
