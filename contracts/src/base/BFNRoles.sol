// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BFNRoles
/// @notice Canonical role identifiers shared across all Bonitah Financial Network
///         contracts (Req 14.5, 14.9). `DEFAULT_ADMIN_ROLE` (0x00) is provided by
///         OpenZeppelin's AccessControl and grants/revokes every other role.
/// @dev Declared as `internal constant` in a library so every contract references the
///      exact same role hashes without duplicating declarations or increasing bytecode.
library BFNRoles {
    /// @notice May pause/unpause deposit/withdrawal flows.
    bytes32 internal constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    /// @notice May mark Registry users as verified.
    bytes32 internal constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    /// @notice May authorize UUPS implementation upgrades.
    bytes32 internal constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    /// @notice May execute Governance-approved treasury operations.
    bytes32 internal constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    /// @notice May increase Registry reputation scores (granted to Education).
    bytes32 internal constant REPUTATION_ROLE = keccak256("REPUTATION_ROLE");
    /// @notice May issue education certificates.
    bytes32 internal constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
}
