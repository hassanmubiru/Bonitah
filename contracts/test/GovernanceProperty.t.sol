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
    
    /// **Property 24: Proposal outcome is determined by recorded votes**
    /// **Validates: Requirements 9.4, 9.5, 9.6**
    function testProperty24_ProposalOutcomeDeterminedByRecordedVotes(
        uint8 forVoterCount,
        uint8 againstVoterCount,
        uint256 votingPeriod,
        uint256 seed
    ) public {
        // Bound inputs to reasonable ranges
        forVoterCount = uint8(bound(forVoterCount, 0, 7)); // Max 7 users have reputation
        againstVoterCount = uint8(bound(againstVoterCount, 0, 7));
        votingPeriod = bound(votingPeriod, 1 hours, 30 days);
        seed = bound(seed, 0, type(uint64).max);
        
        // Skip test if no voters (trivial case)
        if (forVoterCount == 0 && againstVoterCount == 0) return;
        
        // Ensure we don't double-vote by using distinct voter sets
        if (forVoterCount + againstVoterCount > 7) {
            // Adjust counts to fit within available voters with reputation
            if (forVoterCount > 4) forVoterCount = 4;
            if (againstVoterCount > 7 - forVoterCount) againstVoterCount = 7 - forVoterCount;
        }
        
        // Create proposal with user who has voting power
        address proposer = users[0]; // User 0 has reputation 10
        vm.prank(proposer);
        uint256 proposalId = governance.propose("test outcome determination", votingPeriod);
        
        IGovernance.Proposal memory initialProposal = governance.getProposal(proposalId);
        
        // Track expected vote tallies
        uint256 expectedForVotes = 0;
        uint256 expectedAgainstVotes = 0;
        
        // Cast FOR votes using first N users with reputation
        for (uint8 i = 0; i < forVoterCount; i++) {
            address voter = users[i];
            uint256 voterPower = governance.votingPowerOf(voter);
            if (voterPower > 0) {
                vm.prank(voter);
                governance.castVote(proposalId, true);
                expectedForVotes += voterPower;
            }
        }
        
        // Cast AGAINST votes using remaining users with reputation
        for (uint8 i = 0; i < againstVoterCount; i++) {
            uint8 voterIndex = forVoterCount + i;
            if (voterIndex >= users.length) break;
            
            address voter = users[voterIndex];
            uint256 voterPower = governance.votingPowerOf(voter);
            if (voterPower > 0) {
                vm.prank(voter);
                governance.castVote(proposalId, false);
                expectedAgainstVotes += voterPower;
            }
        }
        
        // Verify votes were recorded correctly during voting period
        IGovernance.Proposal memory proposalWithVotes = governance.getProposal(proposalId);
        assertEq(proposalWithVotes.forVotes, expectedForVotes, "For votes should match expected tally");
        assertEq(proposalWithVotes.againstVotes, expectedAgainstVotes, "Against votes should match expected tally");
        
        // Test Requirement 9.6: outcomeOf should compute result from recorded votes even before finalization
        assertEq(
            uint256(governance.outcomeOf(proposalId)),
            uint256(IGovernance.ProposalState.Active),
            "During voting period, outcomeOf should return Active"
        );
        
        // Fast forward past voting period
        vm.warp(initialProposal.votingEnds + 1);
        
        // Calculate expected outcome based on contract logic
        uint256 totalVotes = expectedForVotes + expectedAgainstVotes;
        IGovernance.ProposalState expectedOutcome;
        
        if (totalVotes < initialProposal.quorum) {
            // Requirement 9.5: Rejected if quorum not met
            expectedOutcome = IGovernance.ProposalState.Rejected;
        } else {
            // Check approval threshold (51% from contract MIN_APPROVAL_PERCENTAGE)
            uint256 approvalPercentage = (expectedForVotes * 100) / totalVotes;
            if (approvalPercentage >= 51) {
                // Requirement 9.4: Passed if quorum met and approval threshold reached
                expectedOutcome = IGovernance.ProposalState.Passed;
            } else {
                // Requirement 9.5: Rejected if approval threshold not met
                expectedOutcome = IGovernance.ProposalState.Rejected;
            }
        }
        
        // Test Requirement 9.6: outcomeOf computes result from recorded votes after voting period
        IGovernance.ProposalState computedOutcome = governance.outcomeOf(proposalId);
        assertEq(
            uint256(computedOutcome),
            uint256(expectedOutcome),
            "outcomeOf should compute correct outcome from recorded votes"
        );
        
        // Verify proposal is still Active before finalization
        proposalWithVotes = governance.getProposal(proposalId);
        assertEq(
            uint256(proposalWithVotes.state),
            uint256(IGovernance.ProposalState.Active),
            "Proposal should remain Active until finalized"
        );
        
        // Test Requirements 9.4/9.5: finalize should mark proposal with correct outcome
        governance.finalize(proposalId);
        
        IGovernance.Proposal memory finalizedProposal = governance.getProposal(proposalId);
        assertEq(
            uint256(finalizedProposal.state),
            uint256(expectedOutcome),
            "Finalized proposal state should match expected outcome (Req 9.4, 9.5)"
        );
        
        // Test Requirement 9.6: outcomeOf should agree with finalized state
        IGovernance.ProposalState postFinalizeOutcome = governance.outcomeOf(proposalId);
        assertEq(
            uint256(postFinalizeOutcome),
            uint256(finalizedProposal.state),
            "outcomeOf should agree with finalized state (Req 9.6)"
        );
        
        // Verify that outcome determination is deterministic and consistent
        // Multiple calls to outcomeOf should return the same result
        for (uint8 i = 0; i < 3; i++) {
            assertEq(
                uint256(governance.outcomeOf(proposalId)),
                uint256(expectedOutcome),
                "outcomeOf should be deterministic and consistent"
            );
        }
        
        // Edge case: Verify finalize is idempotent - calling again should not change state
        IGovernance.ProposalState stateBeforeSecondFinalize = governance.outcomeOf(proposalId);
        governance.finalize(proposalId);
        IGovernance.ProposalState stateAfterSecondFinalize = governance.outcomeOf(proposalId);
        assertEq(
            uint256(stateBeforeSecondFinalize),
            uint256(stateAfterSecondFinalize),
            "finalize should be idempotent"
        );
    }
    
    /// **Property 25: Upgrade preserves governance state**
    /// **Validates: Requirements 9.8**
    function testProperty25_UpgradePreservesGovernanceState(
        uint8 proposalCount,
        uint256 seed
    ) public {
        // Bound inputs properly to avoid overflow
        proposalCount = uint8(bound(proposalCount, 1, 3)); // Test with 1-3 proposals to avoid stack depth
        seed = bound(seed, 0, type(uint128).max); // Reasonable seed range
        
        // Arrays to store expected state
        uint256[] memory proposalIds = new uint256[](proposalCount);
        
        // Create proposals and cast some votes
        for (uint8 p = 0; p < proposalCount; p++) {
            // Use different proposers with voting power, avoid overflow
            uint256 proposerIdx = (seed + p) % 7; // Only users 0-6 have reputation
            address proposer = users[proposerIdx];
            uint256 proposerPower = governance.votingPowerOf(proposer);
            
            if (proposerPower == 0) continue; // Skip if no voting power
            
            // Create proposal
            bytes memory testAction = abi.encode("proposal", p);
            uint256 votingPeriod = 7 days;
            
            vm.prank(proposer);
            uint256 proposalId = governance.propose(testAction, votingPeriod);
            proposalIds[p] = proposalId;
            
            // Cast some votes on this proposal
            for (uint8 v = 0; v < 4 && v < users.length; v++) { // Limit voters
                address voter = users[v];
                uint256 voterPower = governance.votingPowerOf(voter);
                
                if (voterPower == 0) continue;
                
                // Use simple pattern for voting, avoid overflow
                uint256 voteDecision = (seed + p + v) % 6;
                bool shouldVote = voteDecision < 4; // 2/3 chance to vote
                if (!shouldVote) continue;
                
                bool voteSupport = (voteDecision % 2) == 0;
                
                vm.prank(voter);
                governance.castVote(proposalId, voteSupport);
            }
        }
        
        // Record state before upgrade
        IGovernance.Proposal[] memory proposalsBeforeUpgrade = new IGovernance.Proposal[](proposalCount);
        for (uint8 p = 0; p < proposalCount; p++) {
            if (proposalIds[p] != 0) {
                proposalsBeforeUpgrade[p] = governance.getProposal(proposalIds[p]);
            }
        }
        
        // Perform upgrade to new implementation
        Governance newImplementation = new Governance();
        
        vm.prank(admin); // Admin has UPGRADER_ROLE
        governance.upgradeToAndCall(address(newImplementation), "");
        
        // Verify all state is preserved after upgrade
        for (uint8 p = 0; p < proposalCount; p++) {
            if (proposalIds[p] == 0) continue; // Skip uninitialized proposals
            
            IGovernance.Proposal memory proposalAfterUpgrade = governance.getProposal(proposalIds[p]);
            IGovernance.Proposal memory proposalBeforeUpgrade = proposalsBeforeUpgrade[p];
            
            // Verify core proposal data is preserved (Req 9.8)
            assertEq(
                proposalAfterUpgrade.id, 
                proposalBeforeUpgrade.id, 
                "Proposal ID should be preserved across upgrade"
            );
            assertEq(
                proposalAfterUpgrade.proposer, 
                proposalBeforeUpgrade.proposer, 
                "Proposer should be preserved across upgrade"
            );
            assertEq(
                proposalAfterUpgrade.votingEnds, 
                proposalBeforeUpgrade.votingEnds, 
                "Voting end time should be preserved across upgrade"
            );
            assertEq(
                uint256(proposalAfterUpgrade.state), 
                uint256(proposalBeforeUpgrade.state), 
                "Proposal state should be preserved across upgrade"
            );
            
            // Verify vote tallies are preserved (Req 9.8)
            assertEq(
                proposalAfterUpgrade.forVotes, 
                proposalBeforeUpgrade.forVotes, 
                "For votes should be preserved across upgrade"
            );
            assertEq(
                proposalAfterUpgrade.againstVotes, 
                proposalBeforeUpgrade.againstVotes, 
                "Against votes should be preserved across upgrade"
            );
        }
        
        // Verify functionality still works after upgrade by creating a new proposal
        address testProposer = users[0]; // Has voting power
        if (governance.votingPowerOf(testProposer) > 0) {
            vm.prank(testProposer);
            uint256 newProposalId = governance.propose("post-upgrade test", 7 days);
            
            assertTrue(newProposalId != 0, "New proposals should be creatable after upgrade");
        }
    }
}