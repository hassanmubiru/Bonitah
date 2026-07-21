// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IRegistry
/// @notice Interface for the BFN Registry contract governing user registration,
///         profile updates, verification, and reputation (Req 3, 13.1, 14).
interface IRegistry {
    /// @notice On-chain profile record for a registered user.
    struct UserProfile {
        bool registered;
        bool verified;
        uint256 reputationScore; // non-negative, init 0
        string ipfsProfileHash;
        uint256 registeredAt;
    }

    /// @notice Emitted exactly once when a wallet registers (Req 3.1, 13.1).
    event UserRegistered(address indexed user, uint256 timestamp);
    /// @notice Emitted when a registered user updates their profile hash (Req 3.3).
    event ProfileUpdated(address indexed user, string ipfsProfileHash);
    /// @notice Emitted when a verifier marks a user verified (Req 3.6).
    event UserVerified(address indexed user, address indexed verifier);
    /// @notice Emitted when a user's reputation increases (Req 3.7, 8.7).
    event ReputationIncreased(address indexed user, uint256 amount, uint256 newScore);

    /// @notice Reverts when an already-registered wallet registers again (Req 3.2).
    error AlreadyRegistered(address user);
    /// @notice Reverts when an unregistered wallet performs a registered-only action (Req 3.4).
    error NotRegistered(address user);
    /// @notice Reverts when a profile update supplies an empty IPFS hash (Req 3.3).
    error EmptyProfileHash();
    /// @notice Reverts when a caller without VERIFIER_ROLE verifies a user (Req 3.10).
    error UnauthorizedVerifier(address caller);

    /// @notice Register the calling wallet as a BFN user (Req 3.1).
    function register() external;

    /// @notice Update the caller's IPFS profile hash (Req 3.3, 3.4).
    function updateProfile(string calldata ipfsProfileHash) external;

    /// @notice Mark a user as verified; restricted to VERIFIER_ROLE (Req 3.6, 3.10).
    function verifyUser(address user) external;

    /// @notice Increase a user's reputation; restricted to REPUTATION_ROLE (Req 8.7).
    function increaseReputation(address user, uint256 amount) external;

    /// @notice Returns true when the wallet is registered.
    function isRegistered(address user) external view returns (bool);

    /// @notice Returns the full profile record for a user.
    function getProfile(address user) external view returns (UserProfile memory);

    /// @notice Returns the current reputation score for a user.
    function reputationOf(address user) external view returns (uint256);
}
