// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title IdentityRegistry
 * @dev Manages approved on-chain identities and role assignments for the MedVault platform.
 *
 * CRITICAL SECURITY PRINCIPLE:
 * This contract NEVER stores personally identifiable information (PII) such as patient names,
 * email addresses, phone numbers, Aadhaar numbers, or medical history.
 * Only the Ethereum wallet address and cryptographic role mapping are recorded.
 */
contract IdentityRegistry is AccessControl {
    bytes32 public constant PATIENT_ROLE = keccak256("PATIENT_ROLE");
    bytes32 public constant DOCTOR_ROLE = keccak256("DOCTOR_ROLE");
    bytes32 public constant HOSPITAL_ROLE = keccak256("HOSPITAL_ROLE");
    bytes32 public constant EMERGENCY_PROVIDER_ROLE = keccak256("EMERGENCY_PROVIDER_ROLE");

    struct Identity {
        bytes32 role;
        bool isActive;
        uint256 registeredAt;
    }

    mapping(address => Identity) private _identities;

    event IdentityRegistered(
        address indexed account,
        bytes32 indexed role,
        uint256 timestamp
    );
    event IdentityStatusChanged(
        address indexed account,
        bool indexed isActive,
        uint256 timestamp
    );

    error IdentityAlreadyExists(address account);
    error IdentityNotFound(address account);
    error InvalidRole(bytes32 role);
    error ZeroAddress();

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @dev Register a new wallet identity with an authorized role.
     */
    function registerIdentity(address account, bytes32 role)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (account == address(0)) revert ZeroAddress();
        if (_identities[account].registeredAt != 0) {
            revert IdentityAlreadyExists(account);
        }
        if (
            role != PATIENT_ROLE &&
            role != DOCTOR_ROLE &&
            role != HOSPITAL_ROLE &&
            role != EMERGENCY_PROVIDER_ROLE
        ) {
            revert InvalidRole(role);
        }

        _identities[account] = Identity({
            role: role,
            isActive: true,
            registeredAt: block.timestamp
        });

        _grantRole(role, account);

        emit IdentityRegistered(account, role, block.timestamp);
    }

    /**
     * @dev Toggle the active status of an identity.
     */
    function setIdentityStatus(address account, bool isActive)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (_identities[account].registeredAt == 0) {
            revert IdentityNotFound(account);
        }

        _identities[account].isActive = isActive;

        if (!isActive) {
            _revokeRole(_identities[account].role, account);
        } else {
            _grantRole(_identities[account].role, account);
        }

        emit IdentityStatusChanged(account, isActive, block.timestamp);
    }

    /**
     * @dev Retrieve identity information for a given wallet address.
     */
    function getIdentity(address account)
        external
        view
        returns (
            bytes32 role,
            bool isActive,
            uint256 registeredAt
        )
    {
        Identity memory id = _identities[account];
        if (id.registeredAt == 0) revert IdentityNotFound(account);
        return (id.role, id.isActive, id.registeredAt);
    }

    /**
     * @dev Check if an account has an active identity and role.
     */
    function isIdentityActive(address account, bytes32 role)
        external
        view
        returns (bool)
    {
        Identity memory id = _identities[account];
        return id.isActive && id.role == role && hasRole(role, account);
    }
}
