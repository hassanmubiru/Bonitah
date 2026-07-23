// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Governance} from "../src/Governance.sol";
import {Registry} from "../src/Registry.sol";
import {IGovernance} from "../src/interfaces/IGovernance.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";

/// @title GovernancePropertyTest
/// @notice Property-based tests for Governance contract (Task 7.2).
/// **Validates: Requirements 9.1, 9.2, 9.3**
contract GovernancePropertyTest is Test {
    Governance public governance;
    Registry public registry;
    
    address public admin = address(0x1);
    address public reputationManager = address(0x2);
    
    // Track users and their reputation for property testing
    address[] public users;
    mapping(address => uint256) public userReputation;
    
    function setUp() public {
        // Deploy Registry proxy
        Registry registryImpl = new Registry();
        bytes memory registryData = abi.encodeWithSelector(Registry.initialize.selector, admin);
        ERC1967Proxy registryProxy = new ERC1967Proxy(address(registryImpl), registryData);
        registry = Registry(address(registryProxy));
        
        // Deploy Governance proxy
        Governance governanceImpl = new Governance();
        bytes memory governanceData = abi.encodeWithSelector(
            Governance.initialize.selector, 
            admin, 
            address(registry)
        );
        ERC1967Proxy governanceProxy = new ERC1967Proxy(address(governanceImpl), governanceData);
        governance = Governance(address(governanceProxy));
        
        // Grant reputation role
        vm.startPrank(admin);
        registry.grantRole(BFNRoles.REPUTATION_ROLE, reputationManager);
        vm.stopPrank();
        
        // Initialize some users with varying reputation for property testing
        _initializeUsers();
    }
    
    function _initializeUsers() internal {
        for (uint256 i = 0; i < 10; i++) {
            address user = address(uint160(0x1000 + i));
            users.push(user);
            
            // Register user
            vm.prank(user);
            registry.register();
            
            // Give some users reputation (others remain at 0)
            if (i < 7) {
                uint256 reputation = (i + 1) * 10; // 10, 20, 30, ..., 70
                vm.prank(reputationManager);
                registry.increaseReputation(user, reputation);
                userReputation[user] = reputation;
            }
        }
    }
    
    /// **Property 23: Governance proposal and weighted voting correctness**
    /// **Validates: Requirements 9.1, 9.2, 9.3**
    function testProperty23_GovernanceProposalAndWeightedVotingCorrectness(
        uint8 proposerIndex,
        uint8 voterIndex,
        bool voteSupport,
        uint256 votingPeriod
    ) public {
        // Bound inputs
        proposerIndex = uint8(bound(proposerIndex, 0, users.length - 1));
        voterIndex = uint8(bound(voterIndex, 0, users.length - 1));
        votingPeriod = bound(votingPeriod, 1 hours, 30 days);
        
        address proposer = users[proposerIndex];
        address voter = users[voterIndex];
        uint256 proposerPower = governance.votingPowerOf(proposer);
        uint256 voterPower = governance.votingPowerOf(voter);
        
        bytes memory testAction = abi.encode("test_action", block.timestamp);
        
        // Test proposal creation (Req 9.1)
        if (proposerPower == 0) {
            // Should revert for users with no voting power
            vm.prank(proposer);
            vm.expectRevert(abi.encodeWithSelector(IGovernance.NoVotingPower.selector, proposer));
            governance.propose(testAction, votingPeriod);
            return;
        }
        
        // Create proposal - should succeed for users with voting power
        vm.prank(proposer);
        uint256 proposalId = governance.propose(testAction, votingPeriod);
        
        // Verify proposal was created correctly (Req 9.1)
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(proposal.proposer, proposer, "Proposer should be recorded correctly");
        assertEq(uint256(proposal.state), uint256(IGovernance.ProposalState.Active), "Proposal should be Active");
        assertGt(proposal.votingEnds, block.timestamp, "Voting should end in the future");
        assertEq(proposal.forVotes, 0, "Initial for votes should be 0");
        assertEq(proposal.againstVotes, 0, "Initial against votes should be 0");
        
        // Test voting (Req 9.2, 9.3)
        if (voterPower == 0) {
            // Should revert for users with no voting power (Req 9.1)
            vm.prank(voter);
            vm.expectRevert(abi.encodeWithSelector(IGovernance.NoVotingPower.selector, voter));
            governance.castVote(proposalId, voteSupport);
            return;
        }
        
        // Record initial vote counts
        uint256 initialForVotes = proposal.forVotes;
        uint256 initialAgainstVotes = proposal.againstVotes;
        
        // Vote should succeed for users with voting power on active proposal (Req 9.2, 9.3)
        vm.prank(voter);
        governance.castVote(proposalId, voteSupport);
        
        // Verify vote was recorded correctly with proper weighting (Req 9.2)
        proposal = governance.getProposal(proposalId);
        assertTrue(governance.hasVoted(proposalId, voter), "Voter should be marked as having voted");
        
        if (voteSupport) {
            assertEq(proposal.forVotes, initialForVotes + voterPower, "For votes should increase by voter power");
            assertEq(proposal.againstVotes, initialAgainstVotes, "Against votes should remain unchanged");
        } else {
            assertEq(proposal.forVotes, initialForVotes, "For votes should remain unchanged");
            assertEq(proposal.againstVotes, initialAgainstVotes + voterPower, "Against votes should increase by voter power");
        }
        
        // Test double voting prevention (Req 9.9 - part of 9.3 requirement validation)
        vm.prank(voter);
        vm.expectRevert(abi.encodeWithSelector(IGovernance.AlreadyVoted.selector, voter, proposalId));
        governance.castVote(proposalId, !voteSupport);
        
        // Test voting after proposal becomes inactive (Req 9.3)
        // Fast forward past voting period
        vm.warp(proposal.votingEnds + 1);
        governance.finalize(proposalId);
        
        // Ensure proposal is no longer active
        proposal = governance.getProposal(proposalId);
        assertTrue(
            proposal.state != IGovernance.ProposalState.Active, 
            "Proposal should no longer be active after finalization"
        );
        
        // Attempt to vote on finalized proposal should fail (Req 9.3)
        address anotherVoter = users[(voterIndex + 1) % users.length];
        if (governance.votingPowerOf(anotherVoter) > 0 && !governance.hasVoted(proposalId, anotherVoter)) {
            vm.prank(anotherVoter);
            vm.expectRevert(abi.encodeWithSelector(IGovernance.ProposalNotActive.selector, proposalId));
            governance.castVote(proposalId, true);
        }
    }
    
    /// Property test focusing on voting power derivation from reputation (Req 9.1)
    function testProperty23_VotingPowerCorrectnessFromReputation(uint8 userIndex) public {
        userIndex = uint8(bound(userIndex, 0, users.length - 1));
        address user = users[userIndex];
        
        uint256 expectedPower = userReputation[user];
        uint256 actualPower = governance.votingPowerOf(user);
        
        assertEq(actualPower, expectedPower, "Voting power should equal user reputation");
        
        // Test that unregistered users have no voting power
        address unregistered = address(0x9999);
        assertEq(governance.votingPowerOf(unregistered), 0, "Unregistered users should have no voting power");
    }
    
    /// Property test for proposal state transitions and outcome determination
    function testProperty23_ProposalStateAndOutcomeCorrectness(
        uint8 forVotersCount,
        uint8 againstVotersCount,
        uint256 votingPeriod
    ) public {
        forVotersCount = uint8(bound(forVotersCount, 0, 4));
        againstVotersCount = uint8(bound(againstVotersCount, 0, 4));
        votingPeriod = bound(votingPeriod, 1 hours, 7 days);
        
        // Skip if no voters
        if (forVotersCount == 0 && againstVotersCount == 0) return;
        
        // Create proposal with a user who has voting power
        address proposer = users[0]; // Has reputation 10
        vm.prank(proposer);
        uint256 proposalId = governance.propose("test", votingPeriod);
        
        uint256 totalForVotes = 0;
        uint256 totalAgainstVotes = 0;
        
        // Cast for votes
        for (uint8 i = 0; i < forVotersCount && i < users.length; i++) {
            address voter = users[i];
            uint256 voterPower = governance.votingPowerOf(voter);
            if (voterPower > 0) {
                vm.prank(voter);
                governance.castVote(proposalId, true);
                totalForVotes += voterPower;
            }
        }
        
        // Cast against votes (use different voters)
        for (uint8 i = 0; i < againstVotersCount && (forVotersCount + i) < users.length; i++) {
            address voter = users[forVotersCount + i];
            uint256 voterPower = governance.votingPowerOf(voter);
            if (voterPower > 0) {
                vm.prank(voter);
                governance.castVote(proposalId, false);
                totalAgainstVotes += voterPower;
            }
        }
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        
        // Verify vote tallies are correct (Req 9.2)
        assertEq(proposal.forVotes, totalForVotes, "For votes should match total weighted votes");
        assertEq(proposal.againstVotes, totalAgainstVotes, "Against votes should match total weighted votes");
        
        // Test outcome calculation during voting period
        assertEq(
            uint256(governance.outcomeOf(proposalId)), 
            uint256(IGovernance.ProposalState.Active),
            "Outcome should be Active during voting period"
        );
        
        // Fast forward past voting period and check outcome
        vm.warp(proposal.votingEnds + 1);
        
        IGovernance.ProposalState expectedOutcome;
        uint256 totalVotes = totalForVotes + totalAgainstVotes;
        
        if (totalVotes < proposal.quorum) {
            expectedOutcome = IGovernance.ProposalState.Rejected;
        } else {
            uint256 approvalPercentage = (totalForVotes * 100) / totalVotes;
            if (approvalPercentage >= 51) { // MIN_APPROVAL_PERCENTAGE from contract
                expectedOutcome = IGovernance.ProposalState.Passed;
            } else {
                expectedOutcome = IGovernance.ProposalState.Rejected;
            }
        }
        
        assertEq(
            uint256(governance.outcomeOf(proposalId)),
            uint256(expectedOutcome),
            "Outcome calculation should be deterministic based on votes"
        );
        
        // Finalize and verify state matches outcome
        governance.finalize(proposalId);
        proposal = governance.getProposal(proposalId);
        assertEq(
            uint256(proposal.state),
            uint256(expectedOutcome),
            "Finalized state should match calculated outcome"
        );
    }
}