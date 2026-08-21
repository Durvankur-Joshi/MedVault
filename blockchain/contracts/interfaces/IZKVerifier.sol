// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IZKVerifier
 * @notice Interface for the MedVault Zero-Knowledge Authorization Verifier.
 */
interface IZKVerifier {
    function verifyAuthorizationProof(
        bytes calldata proof,
        bytes32 recordCommitment,
        bytes32 authorizationCommitment,
        bytes32 requesterNullifier
    ) external returns (bool);

    function isNullifierUsed(
        bytes32 nullifier
    ) external view returns (bool);
}
