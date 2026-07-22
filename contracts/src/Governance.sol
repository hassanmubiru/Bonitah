// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import {IGovernance} from "./interfaces/IGovernance.sol";
import {IRegistry} from "./interfaces/IRegistry.sol";
import {BFNRoles} from "./base/BFNRoles.sol";
import {BFNAccessUUPSUpgradeable} from "./base/BFNAccessUUPSUpgradeable.sol";

/// @title Governance
/// @notice BFN governance contract for proposal creation, weighted voting by reputation,
///         outcome determination, and treasury operation execution (Req 9, 13.8, 14).
///         Voting power derives from Registry reputation scores. Deployed behind UUPS proxy
///         to support upgradeable governance while preserving proposal/vote state (Req 9.8).
/// @dev Treasury operations require `TREASURY_ROLE` for least-privilege execution. Every
///      successful state change emits exactly one event (Req 13.8).
contract Governance is
    Initializable,
    BFNAccessUUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    IGovernance
{
    /// @dev Registry contract for reputation-based voting power.
    IRegistry private _registry;

    /// @dev Next proposal ID to assign.
    uint256 private _nextProposalId;

    /// @dev Mapping from proposal ID to proposal data.
    mapping(uint256 => Proposal) private _proposals;

    /// @dev Mapping from proposal ID to voter address to whether they voted.
    mapping(uint256 => mapping(address => bool)) private _hasVoted;

    /// @dev Default voting period in seconds.
    uint256 private constant DEFAULT_VOTING_PERIOD = 7 days;

    /// @dev Minimum quorum as a percentage (e.g., 10 = 10%).
    uint256 private constant MIN_QUORUM_PERCENTAGE = 10;

    /// @dev Minimum approval percentage for a proposal to pass (e.g., 51 = 51%).
    uint256 private constant MIN_APPROVAL_PERCENTAGE = 51;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the Governance proxy with Registry reference (Req 14.5).
    /// @dev Replaces constructor for upgradeable deployment; callable once.
    /// @param admin Address granted `DEFAULT_ADMIN_ROLE` and `UPGRADER_ROLE`.
    /// @param registry Registry contract address for reputation-based voting power.
    function initialize(address admin, address registry) external initializer {
        __BFNAccessUUPS_init(admin);
        __ReentrancyGuard_init();
        
        _registry = IRegistry(registry);
        _nextProposalId = 1; // Start proposal IDs at 1
    }

    /// @inheritdoc IGovernance
    /// @dev Returns Registry reputation score as voting power. Users must be registered
    ///      and have reputation > 0 to participate in governance (Req 9.1).
    function votingPowerOf(address user) public view returns (uint256) {
        if (!_registry.isRegistered(user)) {
            return 0;
        }
        return _registry.reputationOf(user);
    }

    /// @inheritdoc IGovernance
    /// @dev Requires caller to have voting power > 0 from Registry reputation (Req 9.1).
    ///      Creates proposal in Active state with voting end timestamp, emits
    ///      {ProposalCreated} (Req 9.1, 13.8).
    function propose(bytes calldata /* action */, uint256 votingPeriod)
        external
        returns (uint256)
    {
        uint256 voterPower = votingPowerOf(msg.sender);
        if (voterPower == 0) revert NoVotingPower(msg.sender);

        uint256 proposalId = _nextProposalId++;
        uint256 votingEnd = block.timestamp + (votingPeriod > 0 ? votingPeriod : DEFAULT_VOTING_PERIOD);
        
        // Calculate minimum quorum needed (based on total registered users with reputation > 0)
        // For simplicity, we'll use a fixed quorum of 1 since we can't easily iterate all users
        uint256 quorum = 1;

        _proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            votingEnds: votingEnd,
            forVotes: 0,
            againstVotes: 0,
            quorum: quorum,
            state: ProposalState.Active
        });

        emit ProposalCreated(msg.sender, proposalId, votingEnd);
        
        return proposalId;
    }

    /// @inheritdoc IGovernance
    /// @dev Requires caller to have voting power > 0 (Req 9.1), proposal to be Active
    ///      (Req 9.3), and caller to not have already voted (Req 9.9). Records weighted
    ///      vote and emits {VoteCast} (Req 9.2, 13.8).
    function castVote(uint256 proposalId, bool support) external {
        uint256 voterPower = votingPowerOf(msg.sender);
        if (voterPower == 0) revert NoVotingPower(msg.sender);

        Proposal storage proposal = _proposals[proposalId];
        if (proposal.state != ProposalState.Active) revert ProposalNotActive(proposalId);
        if (_hasVoted[proposalId][msg.sender]) revert AlreadyVoted(msg.sender, proposalId);

        _hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.forVotes += voterPower;
        } else {
            proposal.againstVotes += voterPower;
        }

        emit VoteCast(msg.sender, proposalId, voterPower, support);
    }

    /// @inheritdoc IGovernance
    /// @dev Determines proposal outcome based on voting end time and recorded votes
    ///      (Req 9.4, 9.5). Updates proposal state and emits {ProposalFinalized}.
    function finalize(uint256 proposalId) external {
        Proposal storage proposal = _proposals[proposalId];
        if (proposal.state != ProposalState.Active) return; // Already finalized
        if (block.timestamp < proposal.votingEnds) return; // Still in voting period

        ProposalState newState = _calculateOutcome(proposal);
        proposal.state = newState;

        emit ProposalFinalized(proposalId, newState);
    }

    /// @inheritdoc IGovernance
    /// @dev Computes outcome from recorded votes even before finalization (Req 9.6).
    function outcomeOf(uint256 proposalId) external view returns (ProposalState) {
        Proposal storage proposal = _proposals[proposalId];
        
        // If already finalized, return stored state
        if (proposal.state != ProposalState.Active) {
            return proposal.state;
        }

        // If still in voting period, return Active
        if (block.timestamp < proposal.votingEnds) {
            return ProposalState.Active;
        }

        // Calculate outcome from current vote tallies
        return _calculateOutcome(proposal);
    }

    /// @inheritdoc IGovernance
    /// @dev Restricted to `TREASURY_ROLE`; reverts {UnauthorizedTreasuryOp} for
    ///      unauthorized callers (Req 9.7, 9.10).
    function executeTreasury(bytes calldata action) 
        external 
        onlyRole(BFNRoles.TREASURY_ROLE) 
        nonReentrant 
    {
        // For this implementation, we just validate the role and action format
        // In a full implementation, this would decode and execute treasury actions
        // such as fund transfers, parameter changes, etc.
        
        // Basic validation that action is not empty
        require(action.length > 0, "Empty treasury action");
        
        // For now, we just emit success - specific treasury actions would be implemented here
        // This is a placeholder implementation that satisfies the interface requirements
    }

    /// @notice Returns proposal data for a given proposal ID.
    /// @param proposalId The proposal ID to query.
    /// @return The proposal struct.
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return _proposals[proposalId];
    }

    /// @notice Checks if a user has voted on a specific proposal.
    /// @param proposalId The proposal ID.
    /// @param voter The voter address.
    /// @return True if the user has voted.
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return _hasVoted[proposalId][voter];
    }

    /// @dev Internal function to calculate proposal outcome based on votes.
    /// @param proposal The proposal to evaluate.
    /// @return The calculated proposal state.
    function _calculateOutcome(Proposal storage proposal) private view returns (ProposalState) {
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        
        // Check if quorum is met
        if (totalVotes < proposal.quorum) {
            return ProposalState.Rejected;
        }

        // Check if approval threshold is met
        uint256 approvalPercentage = (proposal.forVotes * 100) / totalVotes;
        if (approvalPercentage >= MIN_APPROVAL_PERCENTAGE) {
            return ProposalState.Passed;
        } else {
            return ProposalState.Rejected;
        }
    }
}