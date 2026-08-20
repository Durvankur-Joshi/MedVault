// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ConsentManager
 * @dev Patient-governed access authorization and time-bound consent ledger.
 *
 * CRITICAL SECURITY PRINCIPLE:
 * Medical data is NEVER exposed in consent operations.
 * The contract manages mathematical rights of access tied to wallet addresses, record references,
 * permission masks, and verifiable Unix expiration timestamps.
 */
contract ConsentManager {
    // Granular permission bitmasks
    uint8 public constant PERMISSION_VIEW_RECORD = 1;       // 0x01
    uint8 public constant PERMISSION_VIEW_DOCUMENT = 2;     // 0x02
    uint8 public constant PERMISSION_VIEW_FHIR = 4;         // 0x04
    uint8 public constant PERMISSION_DOWNLOAD_DOC = 8;      // 0x08
    uint8 public constant PERMISSION_FULL_ACCESS = 15;      // 0x0F (all permissions)

    struct Consent {
        address patient;
        bytes32 recordId;
        address grantee;
        uint8 permissions;
        uint256 grantedAt;
        uint256 expiresAt;
        bool active;
    }

    // consentId = keccak256(abi.encodePacked(patient, recordId, grantee))
    mapping(bytes32 => Consent) private _consents;

    event ConsentGranted(
        address indexed patient,
        bytes32 indexed recordId,
        address indexed grantee,
        uint8 permissions,
        uint256 expiresAt,
        bytes32 consentId,
        uint256 timestamp
    );

    event ConsentRevoked(
        address indexed patient,
        bytes32 indexed recordId,
        address indexed grantee,
        bytes32 consentId,
        uint256 timestamp
    );

    error InvalidGrantee();
    error InvalidRecordId();
    error InvalidPermissions();
    error InvalidExpiration();
    error ConsentNotFound();
    error ConsentAlreadyRevoked();
    error UnauthorizedRevoker();

    /**
     * @dev Helper to compute unique deterministic consent identifier.
     */
    function computeConsentId(
        address patient,
        bytes32 recordId,
        address grantee
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(patient, recordId, grantee));
    }

    /**
     * @dev Grant fine-grained, time-bounded consent to a doctor or healthcare provider.
     * @param recordId Identifier of the record being shared
     * @param grantee Ethereum address of the doctor/hospital receiving access
     * @param permissions Bitmask of granted capabilities (1=View, 2=Doc, 4=FHIR, 8=Download)
     * @param expiresAt Unix timestamp after which access automatically expires
     */
    function grantConsent(
        bytes32 recordId,
        address grantee,
        uint8 permissions,
        uint256 expiresAt
    ) external returns (bytes32 consentId) {
        if (grantee == address(0)) revert InvalidGrantee();
        if (recordId == bytes32(0)) revert InvalidRecordId();
        if (permissions == 0 || permissions > PERMISSION_FULL_ACCESS) {
            revert InvalidPermissions();
        }
        if (expiresAt <= block.timestamp) revert InvalidExpiration();

        consentId = computeConsentId(msg.sender, recordId, grantee);

        _consents[consentId] = Consent({
            patient: msg.sender,
            recordId: recordId,
            grantee: grantee,
            permissions: permissions,
            grantedAt: block.timestamp,
            expiresAt: expiresAt,
            active: true
        });

        emit ConsentGranted(
            msg.sender,
            recordId,
            grantee,
            permissions,
            expiresAt,
            consentId,
            block.timestamp
        );

        return consentId;
    }

    /**
     * @dev Revoke an existing consent grant immediately.
     * @param recordId Identifier of the record
     * @param grantee Ethereum address of the grantee
     */
    function revokeConsent(bytes32 recordId, address grantee) external {
        bytes32 consentId = computeConsentId(msg.sender, recordId, grantee);
        Consent storage c = _consents[consentId];

        if (c.grantedAt == 0) revert ConsentNotFound();
        if (!c.active) revert ConsentAlreadyRevoked();
        if (c.patient != msg.sender) revert UnauthorizedRevoker();

        c.active = false;

        emit ConsentRevoked(msg.sender, recordId, grantee, consentId, block.timestamp);
    }

    /**
     * @dev Check if active, unexpired consent exists with the required permission.
     * @param patient Address of the record owner
     * @param recordId Identifier of the record
     * @param grantee Address attempting to access the record
     * @param requiredPermission Specific permission bitmask required for the operation
     */
    function isConsentValid(
        address patient,
        bytes32 recordId,
        address grantee,
        uint8 requiredPermission
    ) external view returns (bool) {
        bytes32 consentId = computeConsentId(patient, recordId, grantee);
        Consent memory c = _consents[consentId];

        if (!c.active) return false;
        if (c.expiresAt <= block.timestamp) return false;
        if ((c.permissions & requiredPermission) != requiredPermission) return false;

        return true;
    }

    /**
     * @dev Retrieve full details of a specific consent record.
     */
    function getConsent(
        address patient,
        bytes32 recordId,
        address grantee
    ) external view returns (Consent memory) {
        bytes32 consentId = computeConsentId(patient, recordId, grantee);
        Consent memory c = _consents[consentId];
        if (c.grantedAt == 0) revert ConsentNotFound();
        return c;
    }
}
