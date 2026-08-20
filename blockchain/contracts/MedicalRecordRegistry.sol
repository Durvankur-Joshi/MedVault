// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MedicalRecordRegistry
 * @dev Anchors the integrity and existence of off-chain encrypted medical records.
 *
 * CRITICAL SECURITY PRINCIPLE:
 * Medical records are NEVER stored on-chain.
 * Only 32-byte cryptographic hashes (SHA-256) and privacy-preserving pseudonym commitments are stored.
 * This ensures mathematical proof of tamper-evidence while preserving 100% patient privacy.
 */
contract MedicalRecordRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct Record {
        bytes32 recordHash;
        bytes32 patientCommitment;
        bytes32 storageCommitment;
        address anchoredBy;
        uint256 timestamp;
        bool active;
    }

    mapping(bytes32 => Record) private _records;

    event RecordRegistered(
        bytes32 indexed recordId,
        bytes32 indexed recordHash,
        bytes32 indexed patientCommitment,
        bytes32 storageCommitment,
        address anchoredBy,
        uint256 timestamp
    );

    event RecordRevoked(
        bytes32 indexed recordId,
        address indexed revokedBy,
        uint256 timestamp
    );

    error RecordAlreadyExists(bytes32 recordId);
    error RecordNotFound(bytes32 recordId);
    error RecordIsRevoked(bytes32 recordId);
    error UnauthorizedCaller();
    error InvalidHash();
    error ZeroAddress();

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(REGISTRAR_ROLE, initialAdmin);
    }

    /**
     * @dev Anchor a new medical record integrity commitment on-chain.
     * @param recordId Unique 32-byte record identifier (derived from UUID or hash)
     * @param recordHash SHA-256 hash of the canonical FHIR / encrypted document
     * @param patientCommitment Privacy-preserving patient reference
     * @param storageCommitment Hash / reference to off-chain encrypted storage
     */
    function registerRecord(
        bytes32 recordId,
        bytes32 recordHash,
        bytes32 patientCommitment,
        bytes32 storageCommitment
    ) external {
        if (recordId == bytes32(0) || recordHash == bytes32(0)) revert InvalidHash();
        if (_records[recordId].timestamp != 0) revert RecordAlreadyExists(recordId);

        _records[recordId] = Record({
            recordHash: recordHash,
            patientCommitment: patientCommitment,
            storageCommitment: storageCommitment,
            anchoredBy: msg.sender,
            timestamp: block.timestamp,
            active: true
        });

        emit RecordRegistered(
            recordId,
            recordHash,
            patientCommitment,
            storageCommitment,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @dev Verify if a given record's SHA-256 hash matches the on-chain anchored commitment.
     * @param recordId Unique 32-byte record identifier
     * @param expectedHash Recalculated SHA-256 hash to test against
     * @return isValid True if record exists, is active, and hash strictly matches
     * @return timestamp Block timestamp when the record was anchored
     */
    function verifyRecord(bytes32 recordId, bytes32 expectedHash)
        external
        view
        returns (bool isValid, uint256 timestamp)
    {
        Record memory rec = _records[recordId];
        if (rec.timestamp == 0 || !rec.active) {
            return (false, rec.timestamp);
        }
        return (rec.recordHash == expectedHash, rec.timestamp);
    }

    /**
     * @dev Revoke an anchored record. Can be called by the anchorer or admin.
     */
    function revokeRecord(bytes32 recordId) external {
        Record storage rec = _records[recordId];
        if (rec.timestamp == 0) revert RecordNotFound(recordId);
        if (!rec.active) revert RecordIsRevoked(recordId);

        if (rec.anchoredBy != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedCaller();
        }

        rec.active = false;

        emit RecordRevoked(recordId, msg.sender, block.timestamp);
    }

    /**
     * @dev Get complete record anchor metadata.
     */
    function getRecord(bytes32 recordId)
        external
        view
        returns (
            bytes32 recordHash,
            bytes32 patientCommitment,
            bytes32 storageCommitment,
            address anchoredBy,
            uint256 timestamp,
            bool active
        )
    {
        Record memory rec = _records[recordId];
        if (rec.timestamp == 0) revert RecordNotFound(recordId);
        return (
            rec.recordHash,
            rec.patientCommitment,
            rec.storageCommitment,
            rec.anchoredBy,
            rec.timestamp,
            rec.active
        );
    }
}
