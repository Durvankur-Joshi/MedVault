// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IZKVerifier.sol";

/**
 * @title ZKVerifier
 * @notice MedVault Phase 5 ZK authorization verifier.
 *
 * IMPORTANT ARCHITECTURAL NOTE:
 * This contract provides the on-chain verifier interface, commitment validation,
 * and nullifier replay protection. The cryptographic Noir proof verification
 * backend will be connected to a generated Noir UltraVerifier contract in
 * subsequent production hardening.
 *
 * Privacy & Security Invariants:
 * - Proves access authorization without revealing doctor credentials or patient PII.
 * - Public inputs are strictly 32-byte cryptographic commitments and nullifiers.
 * - Zero medical data, diagnosis, prescription, or patient PII is accepted.
 */
contract ZKVerifier is AccessControl, IZKVerifier {
    bytes32 public constant VERIFIER_ADMIN_ROLE =
        keccak256("VERIFIER_ADMIN_ROLE");

    // Tracks consumed nullifiers to prevent proof replay while maintaining anonymity
    mapping(bytes32 => bool) private _usedNullifiers;
    mapping(bytes32 => uint256) private _nullifierTimestamp;

    event ProofVerified(
        bytes32 indexed requesterNullifier,
        bytes32 indexed recordCommitment,
        bytes32 indexed authorizationCommitment,
        uint256 timestamp
    );

    event ProofRejected(
        bytes32 indexed requesterNullifier,
        uint256 timestamp,
        string reason
    );

    error InvalidAdmin();
    error InvalidProofData();
    error InvalidCommitment();
    error NullifierAlreadyUsed(bytes32 nullifier);

    constructor(address admin) {
        if (admin == address(0)) {
            revert InvalidAdmin();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ADMIN_ROLE, admin);
    }

    /**
     * @notice Verify an authorization proof on-chain.
     * @param proof Cryptographic proof bytes
     * @param recordCommitment 32-byte commitment of the target medical record
     * @param authorizationCommitment 32-byte commitment of the active consent grant
     * @param requesterNullifier 32-byte pseudorandom nullifier derived by circuit
     */
    function verifyAuthorizationProof(
        bytes calldata proof,
        bytes32 recordCommitment,
        bytes32 authorizationCommitment,
        bytes32 requesterNullifier
    ) external override returns (bool) {
        if (proof.length == 0) {
            emit ProofRejected(
                requesterNullifier,
                block.timestamp,
                "Empty proof"
            );
            revert InvalidProofData();
        }

        if (
            recordCommitment == bytes32(0) ||
            authorizationCommitment == bytes32(0)
        ) {
            emit ProofRejected(
                requesterNullifier,
                block.timestamp,
                "Invalid commitment"
            );
            revert InvalidCommitment();
        }

        if (requesterNullifier == bytes32(0)) {
            emit ProofRejected(
                requesterNullifier,
                block.timestamp,
                "Invalid nullifier"
            );
            revert InvalidCommitment();
        }

        // Prevent replay of the same authorization proof
        if (_usedNullifiers[requesterNullifier]) {
            emit ProofRejected(
                requesterNullifier,
                block.timestamp,
                "Nullifier already used"
            );
            revert NullifierAlreadyUsed(requesterNullifier);
        }

        /*
         * Structural payload verification:
         * Verifies proof payload length minimum constraint.
         * The Noir-generated UltraVerifier will be hooked here for full
         * cryptographic elliptic curve / polynomial verification.
         */
        if (proof.length < 32) {
            emit ProofRejected(
                requesterNullifier,
                block.timestamp,
                "Proof too short"
            );
            revert InvalidProofData();
        }

        // Mark nullifier as consumed for this access event
        _usedNullifiers[requesterNullifier] = true;
        _nullifierTimestamp[requesterNullifier] = block.timestamp;

        emit ProofVerified(
            requesterNullifier,
            recordCommitment,
            authorizationCommitment,
            block.timestamp
        );

        return true;
    }

    /**
     * @notice Check whether a nullifier has already been consumed.
     */
    function isNullifierUsed(
        bytes32 nullifier
    ) external view override returns (bool) {
        return _usedNullifiers[nullifier];
    }

    /**
     * @notice Get the timestamp when a nullifier was consumed.
     */
    function getNullifierTimestamp(
        bytes32 nullifier
    ) external view returns (uint256) {
        return _nullifierTimestamp[nullifier];
    }

    /**
     * @notice ERC165 interface support inherited from AccessControl.
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}