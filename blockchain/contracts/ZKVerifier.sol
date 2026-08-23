// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IZKVerifier.sol";
import "./UltraVerifier.sol";

/**
 * @title ZKVerifier
 * @notice MedVault Phase 5 ZK authorization verifier.
 *
 * Connects the on-chain verifier interface, commitment validation,
 * nullifier replay protection, and the cryptographic Noir UltraVerifier backend.
 *
 * Privacy & Security Invariants:
 * - Proves access authorization without revealing doctor credentials or patient PII.
 * - Public inputs are strictly 32-byte cryptographic commitments and nullifiers.
 * - Zero medical data, diagnosis, prescription, or patient PII is accepted.
 */
contract ZKVerifier is AccessControl, IZKVerifier {
    bytes32 public constant VERIFIER_ADMIN_ROLE =
        keccak256("VERIFIER_ADMIN_ROLE");

    // Cryptographic Noir UltraVerifier contract
    IUltraVerifier public ultraVerifier;

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

    event UltraVerifierUpdated(address indexed newVerifier);

    error InvalidAdmin();
    error InvalidProofData();
    error InvalidCommitment();
    error NullifierAlreadyUsed(bytes32 nullifier);
    error CryptographicVerificationFailed();
    error VerifierNotConfigured();

    constructor(address admin, address _ultraVerifier) {
        if (admin == address(0)) {
            revert InvalidAdmin();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ADMIN_ROLE, admin);

        if (_ultraVerifier != address(0)) {
            ultraVerifier = IUltraVerifier(_ultraVerifier);
        }
    }

    /**
     * @notice Update the cryptographic UltraVerifier contract address.
     * @param _ultraVerifier New UltraVerifier contract address
     */
    function setUltraVerifier(
        address _ultraVerifier
    ) external onlyRole(VERIFIER_ADMIN_ROLE) {
        ultraVerifier = IUltraVerifier(_ultraVerifier);
        emit UltraVerifierUpdated(_ultraVerifier);
    }

    /**
     * @notice Verify an authorization proof on-chain with cryptographic Noir UltraVerifier.
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

        // Cryptographic verification delegation
        if (address(ultraVerifier) == address(0)) {
            emit ProofRejected(
                requesterNullifier,
                block.timestamp,
                "Verifier contract not configured"
            );
            revert VerifierNotConfigured();
        }

        bytes32[] memory publicInputs = new bytes32[](3);
        publicInputs[0] = recordCommitment;
        publicInputs[1] = authorizationCommitment;
        publicInputs[2] = requesterNullifier;

        bool isValid = ultraVerifier.verify(proof, publicInputs);
        if (!isValid) {
            emit ProofRejected(
                requesterNullifier,
                block.timestamp,
                "Cryptographic proof verification failed"
            );
            revert CryptographicVerificationFailed();
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