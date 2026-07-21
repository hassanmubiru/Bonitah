// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IGovernance
/// @notice Interface for the BFN Governance contract managing proposals, weighted
///         voting, outcomes, and treasury permissions (Req 9, 13.8, 14).
interface IGovernance {
    /// @notice Lifecycle states of a proposal.
    enum ProposalState {
        Active,
        Passed,
        Rejected,
        Executed
    }

    /// @notice A governance proposal.
    struct Proposal {
        uint256 id;
        address proposer;
        uint256 votingEnds;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 quorum;
        ProposalState state;
    }

    /// @notice Emitted when a proposal is created (Req 9.1).
    event ProposalCreated(address indexed proposer, uint256 indexed proposalId, uint256 votingEnds);
    /// @notice Emitted when a weighted vote is cast (Req 9.2, 13.8).
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint256 weight, bool support);
    /// @notice Emitted when a proposal is finalized (Req 9.4, 9.5).
    event ProposalFinalized(uint256 indexed proposalId, ProposalState result);

    /// @notice Reverts when the caller has no voting power (Req 9.1).
    error NoVotingPower(address caller);
    /// @notice Reverts when voting on a proposal that is not active (Req 9.3).
    error ProposalNotActive(uint256 proposalId);
    /// @notice Reverts when a voter votes twice on the same proposal (Req 9.9).
    error AlreadyVoted(address voter, uint256 proposalId);
    /// @notice Reverts when a treasury op is invoked without TREASURY_ROLE (Req 9.10).
    error UnauthorizedTreasuryOp(address caller);

    /// @notice Create a proposal in the active voting state (Req 9.1).
    function propose(bytes calldata action, uint256 votingPeriod) external returns (uint256);

    /// @notice Cast a weighted vote on an active proposal (Req 9.2, 9.3, 9.9).
    function castVote(uint256 proposalId, bool support) external;

    /// @notice Finalize a proposal after its voting period (Req 9.4, 9.5).
    function finalize(uint256 proposalId) external;

    /// @notice Determine a proposal outcome from recorded votes (Req 9.6).
    function outcomeOf(uint256 proposalId) external view returns (ProposalState);

    /// @notice Execute a treasury action; restricted to TREASURY_ROLE (Req 9.7, 9.10).
    function executeTreasury(bytes calldata action) external;

    /// @notice Returns the governance voting power of a user.
    function votingPowerOf(address user) external view returns (uint256);
}
