// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ICommunityTreasury
/// @notice Interface for the BFN CommunityTreasury contract managing savings circles,
///         contributions, voting, and investment pools (Req 6, 7, 13.6-13.8, 14).
interface ICommunityTreasury {
    /// @notice A community savings circle.
    struct Circle {
        address creator;
        uint256 maxMembers; // 2..1000
        uint8 approvalThreshold; // 1..100 (percent)
        uint256 memberCount;
        uint256 treasuryBalance;
        bool open;
    }

    /// @notice A recorded contribution with its timestamp.
    struct Contribution {
        uint256 amount;
        uint256 timestamp;
    }

    /// @notice A proposed treasury disbursement action.
    struct TreasuryAction {
        uint256 circleId;
        address to;
        uint256 amount;
        uint256 approvals; // weighted count
        bool executed;
    }

    /// @notice Emitted when a circle or pool is created (Req 6.1, 13.6).
    event PoolCreated(address indexed creator, uint256 indexed poolId, uint256 maxMembers, uint8 approvalThreshold);
    /// @notice Emitted when a member joins a circle (Req 6.2).
    event MemberJoined(uint256 indexed poolId, address indexed member);
    /// @notice Emitted on a successful contribution (Req 6.3, 7.1, 13.7).
    event ContributionMade(address indexed contributor, uint256 indexed poolId, uint256 amount);
    /// @notice Emitted when a member votes on a treasury action (Req 6.4, 13.8).
    event VoteCast(address indexed voter, uint256 indexed actionId);
    /// @notice Emitted when a treasury action executes (Req 6.7).
    event ActionExecuted(uint256 indexed actionId, address indexed to, uint256 amount);

    /// @notice Reverts on invalid circle parameters (Req 6.11).
    error InvalidCircleParams();
    /// @notice Reverts when a non-member performs a member-only action (Req 6.5).
    error NotMember(address caller, uint256 poolId);
    /// @notice Reverts when an already-joined member joins again (Req 6.9).
    error AlreadyMember(address caller, uint256 poolId);
    /// @notice Reverts when joining a closed or full circle (Req 6.9).
    error CircleClosedOrFull(uint256 poolId);
    /// @notice Reverts when an amount of zero is supplied (Req 6.3, 7.2).
    error ZeroAmount();
    /// @notice Reverts when a member votes twice on the same action (Req 6.10).
    error AlreadyVoted(address voter, uint256 actionId);

    /// @notice Create a savings circle with the caller as first member (Req 6.1, 6.11).
    function createCircle(uint256 maxMembers, uint8 approvalThreshold) external returns (uint256 poolId);

    /// @notice Join an open, non-full circle (Req 6.2, 6.9).
    function joinCircle(uint256 poolId) external;

    /// @notice Contribute to a circle treasury (Req 6.3, 6.5).
    function contribute(uint256 poolId, uint256 amount) external;

    /// @notice Propose a treasury disbursement action.
    function proposeAction(uint256 poolId, address to, uint256 amount) external returns (uint256 actionId);

    /// @notice Vote on a treasury action (Req 6.4, 6.7, 6.10).
    function vote(uint256 actionId) external;

    // --- Investment pool interface (Req 7) ---

    /// @notice Contribute to an investment pool (Req 7.1, 7.2).
    function contributeToPool(uint256 poolId, uint256 amount) external;

    /// @notice Ownership share expressed in parts-per-million (Req 7.1).
    function ownershipShare(uint256 poolId, address member) external view returns (uint256 sharePpm);

    /// @notice Yield owed to a member proportional to ownership share (Req 7.6).
    function yieldDistribution(uint256 poolId, address member, uint256 totalYield) external view returns (uint256);

    /// @notice Per-member contribution history for a circle/pool (Req 6.6, 7.3).
    function contributionHistory(uint256 poolId, address member) external view returns (Contribution[] memory);
}
