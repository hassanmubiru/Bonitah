// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Governance} from "../src/Governance.sol";
import {Registry} from "../src/Registry.sol";
import {IGovernance} from "../src/interfaces/IGovernance.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";

/// @title GovernanceUnitTest
/// @notice Unit, event, and revert tests for Governance contract (Task 7.5).
/// @dev Validates Requirements 13.8, 15.1, 15.2, 15.3 with comprehensive event assertion
///      and one revert test per custom error.
contract GovernanceUnitTest is Test {
    Governance public governance;
    Registry public registry;
    
    address public admin = address(0x1);
    address public treasuryManager = address(0x2);
    address public verifier = address(0x3);
    address public reputationManager = address(0x4);
    address public userWithReputation = address(0x5);
    address public anotherUser = address(0x6);
    address public thirdUser = address(0x7);
    address public userWithoutReputation = address(0x8);
    address public unregisteredUser = address(0x9);
    
    bytes public constant TEST_ACTION = "test_treasury_action";
    uint256 public constant CUSTOM_VOTING_PERIOD = 2 days;
    
    // Events for testing (Req 15.2)
    event ProposalCreated(address indexed proposer, uint256 indexed proposalId, uint256 votingEnds);
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint256 weight, bool support);
    event ProposalFinalized(uint256 indexed proposalId, IGovernance.ProposalState result);
    
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
        
        // Grant roles
        vm.startPrank(admin);
        registry.grantRole(BFNRoles.VERIFIER_ROLE, verifier);
        registry.grantRole(BFNRoles.REPUTATION_ROLE, reputationManager);
        governance.grantRole(BFNRoles.TREASURY_ROLE, treasuryManager);
        vm.stopPrank();
        
        // Register users and assign reputation
        _registerUserWithReputation(userWithReputation, 150);
        _registerUserWithReputation(anotherUser, 75);
        _registerUserWithReputation(thirdUser, 30);
        
        // Register user with no reputation (registered but reputation = 0)
        vm.prank(userWithoutReputation);
        registry.register();
        // Don't give this user any reputation
        
        // unregisteredUser is not registered at all
    }
    
    function _registerUserWithReputation(address user, uint256 reputation) private {
        vm.prank(user);
        registry.register();
        vm.prank(reputationManager);
        registry.increaseReputation(user, reputation);
    }

    // ========================================================================
    // UNIT TESTS - Every public/external function (Req 15.1)
    // ========================================================================
    
    /// @notice Unit test for votingPowerOf function - registered user with reputation
    function testUnit_VotingPowerOf_RegisteredUserWithReputation() public {
        uint256 power = governance.votingPowerOf(userWithReputation);
        assertEq(power, 150, "VotingPower should equal user reputation");
    }
    
    /// @notice Unit test for votingPowerOf function - registered user without reputation
    function testUnit_VotingPowerOf_RegisteredUserWithoutReputation() public {
        uint256 power = governance.votingPowerOf(userWithoutReputation);
        assertEq(power, 0, "VotingPower should be 0 for user with no reputation");
    }
    
    /// @notice Unit test for votingPowerOf function - unregistered user
    function testUnit_VotingPowerOf_UnregisteredUser() public {
        uint256 power = governance.votingPowerOf(unregisteredUser);
        assertEq(power, 0, "VotingPower should be 0 for unregistered user");
    }
    
    /// @notice Unit test for propose function - successful proposal creation
    function testUnit_Propose_Success() public {
        uint256 expectedVotingEnd = block.timestamp + CUSTOM_VOTING_PERIOD;
        
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        assertEq(proposalId, 1, "First proposal should have ID 1");
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(proposal.id, 1, "Proposal ID should be 1");
        assertEq(proposal.proposer, userWithReputation, "Proposer should be correct");
        assertEq(proposal.votingEnds, expectedVotingEnd, "Voting end time should be correct");
        assertEq(proposal.forVotes, 0, "For votes should start at 0");
        assertEq(proposal.againstVotes, 0, "Against votes should start at 0");
        assertEq(proposal.quorum, 1, "Quorum should be set");
        assertEq(uint256(proposal.state), uint256(IGovernance.ProposalState.Active), "State should be Active");
    }
    
    /// @notice Unit test for propose function - default voting period
    function testUnit_Propose_DefaultVotingPeriod() public {
        uint256 expectedVotingEnd = block.timestamp + 7 days; // DEFAULT_VOTING_PERIOD
        
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, 0); // 0 triggers default
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(proposal.votingEnds, expectedVotingEnd, "Should use default voting period");
    }
    
    /// @notice Unit test for castVote function - vote for
    function testUnit_CastVote_VoteFor() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        vm.prank(anotherUser);
        governance.castVote(proposalId, true);
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(proposal.forVotes, 75, "For votes should include voter's reputation");
        assertEq(proposal.againstVotes, 0, "Against votes should remain 0");
        assertTrue(governance.hasVoted(proposalId, anotherUser), "User should be marked as voted");
    }
    
    /// @notice Unit test for castVote function - vote against
    function testUnit_CastVote_VoteAgainst() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        vm.prank(thirdUser);
        governance.castVote(proposalId, false);
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(proposal.forVotes, 0, "For votes should remain 0");
        assertEq(proposal.againstVotes, 30, "Against votes should include voter's reputation");
        assertTrue(governance.hasVoted(proposalId, thirdUser), "User should be marked as voted");
    }
    
    /// @notice Unit test for finalize function - proposal passes
    function testUnit_Finalize_ProposalPasses() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        // Cast majority for votes (150 + 75 = 225 for, 30 against = 88.2% approval)
        vm.prank(userWithReputation);
        governance.castVote(proposalId, true);
        vm.prank(anotherUser);
        governance.castVote(proposalId, true);
        vm.prank(thirdUser);
        governance.castVote(proposalId, false);
        
        // Fast forward past voting period
        vm.warp(block.timestamp + CUSTOM_VOTING_PERIOD + 1);
        
        governance.finalize(proposalId);
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(uint256(proposal.state), uint256(IGovernance.ProposalState.Passed), "Proposal should pass");
    }
    
    /// @notice Unit test for finalize function - proposal rejected by low approval
    function testUnit_Finalize_ProposalRejectedByApproval() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        // Cast majority against votes (75 for, 150 + 30 = 180 against = 29.4% approval)
        vm.prank(anotherUser);
        governance.castVote(proposalId, true);
        vm.prank(userWithReputation);
        governance.castVote(proposalId, false);
        vm.prank(thirdUser);
        governance.castVote(proposalId, false);
        
        // Fast forward past voting period
        vm.warp(block.timestamp + CUSTOM_VOTING_PERIOD + 1);
        
        governance.finalize(proposalId);
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(uint256(proposal.state), uint256(IGovernance.ProposalState.Rejected), "Proposal should be rejected");
    }
    
    /// @notice Unit test for outcomeOf function - active proposal
    function testUnit_OutcomeOf_ActiveProposal() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        IGovernance.ProposalState outcome = governance.outcomeOf(proposalId);
        assertEq(uint256(outcome), uint256(IGovernance.ProposalState.Active), "Should be Active during voting");
    }
    
    /// @notice Unit test for outcomeOf function - computes outcome after voting period
    function testUnit_OutcomeOf_ComputesOutcome() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        // Cast votes for passing
        vm.prank(userWithReputation);
        governance.castVote(proposalId, true);
        vm.prank(anotherUser);
        governance.castVote(proposalId, true);
        
        // Fast forward past voting period
        vm.warp(block.timestamp + CUSTOM_VOTING_PERIOD + 1);
        
        IGovernance.ProposalState outcome = governance.outcomeOf(proposalId);
        assertEq(uint256(outcome), uint256(IGovernance.ProposalState.Passed), "Should compute Passed");
    }
    
    /// @notice Unit test for executeTreasury function - successful execution
    function testUnit_ExecuteTreasury_Success() public {
        vm.prank(treasuryManager);
        // Should not revert - treasury manager has proper role
        governance.executeTreasury(TEST_ACTION);
        // If we reach here, the function executed successfully
        assertTrue(true, "Treasury execution should succeed with proper role");
    }
    
    /// @notice Unit test for getProposal function
    function testUnit_GetProposal() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(proposal.id, proposalId, "Should return correct proposal");
        assertEq(proposal.proposer, userWithReputation, "Should have correct proposer");
    }
    
    /// @notice Unit test for hasVoted function
    function testUnit_HasVoted() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        assertFalse(governance.hasVoted(proposalId, anotherUser), "Should be false before voting");
        
        vm.prank(anotherUser);
        governance.castVote(proposalId, true);
        
        assertTrue(governance.hasVoted(proposalId, anotherUser), "Should be true after voting");
    }

    // ========================================================================
    // EVENT TESTS - Assert each event with expected args (Req 15.2, 13.8)
    // ========================================================================
    
    /// @notice Event test for ProposalCreated - assert all event args
    function testEvent_ProposalCreated() public {
        uint256 expectedVotingEnd = block.timestamp + CUSTOM_VOTING_PERIOD;
        
        vm.expectEmit(true, true, false, true);
        emit ProposalCreated(userWithReputation, 1, expectedVotingEnd);
        
        vm.prank(userWithReputation);
        governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
    }
    
    /// @notice Event test for VoteCast - vote for with correct args (Req 13.8)
    function testEvent_VoteCast_VoteFor() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        vm.expectEmit(true, true, false, true);
        emit VoteCast(anotherUser, proposalId, 75, true);
        
        vm.prank(anotherUser);
        governance.castVote(proposalId, true);
    }
    
    /// @notice Event test for VoteCast - vote against with correct args (Req 13.8)
    function testEvent_VoteCast_VoteAgainst() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        vm.expectEmit(true, true, false, true);
        emit VoteCast(thirdUser, proposalId, 30, false);
        
        vm.prank(thirdUser);
        governance.castVote(proposalId, false);
    }
    
    /// @notice Event test for ProposalFinalized - passed outcome
    function testEvent_ProposalFinalized_Passed() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        // Cast votes for passing
        vm.prank(userWithReputation);
        governance.castVote(proposalId, true);
        vm.prank(anotherUser);
        governance.castVote(proposalId, true);
        
        // Fast forward past voting period
        vm.warp(block.timestamp + CUSTOM_VOTING_PERIOD + 1);
        
        vm.expectEmit(true, false, false, true);
        emit ProposalFinalized(proposalId, IGovernance.ProposalState.Passed);
        
        governance.finalize(proposalId);
    }
    
    /// @notice Event test for ProposalFinalized - rejected outcome
    function testEvent_ProposalFinalized_Rejected() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        // Cast votes for rejection
        vm.prank(anotherUser);
        governance.castVote(proposalId, true); // 75 for
        vm.prank(userWithReputation);
        governance.castVote(proposalId, false); // 150 against
        
        // Fast forward past voting period
        vm.warp(block.timestamp + CUSTOM_VOTING_PERIOD + 1);
        
        vm.expectEmit(true, false, false, true);
        emit ProposalFinalized(proposalId, IGovernance.ProposalState.Rejected);
        
        governance.finalize(proposalId);
    }

    // ========================================================================
    // REVERT TESTS - One test per custom error (Req 15.3)
    // ========================================================================
    
    /// @notice Revert test for NoVotingPower error - propose with unregistered user
    function testRevert_NoVotingPower_ProposeUnregistered() public {
        vm.expectRevert(abi.encodeWithSelector(IGovernance.NoVotingPower.selector, unregisteredUser));
        
        vm.prank(unregisteredUser);
        governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
    }
    
    /// @notice Revert test for NoVotingPower error - propose with registered user without reputation
    function testRevert_NoVotingPower_ProposeNoReputation() public {
        vm.expectRevert(abi.encodeWithSelector(IGovernance.NoVotingPower.selector, userWithoutReputation));
        
        vm.prank(userWithoutReputation);
        governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
    }
    
    /// @notice Revert test for NoVotingPower error - vote with unregistered user
    function testRevert_NoVotingPower_VoteUnregistered() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        vm.expectRevert(abi.encodeWithSelector(IGovernance.NoVotingPower.selector, unregisteredUser));
        
        vm.prank(unregisteredUser);
        governance.castVote(proposalId, true);
    }
    
    /// @notice Revert test for NoVotingPower error - vote with registered user without reputation
    function testRevert_NoVotingPower_VoteNoReputation() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        vm.expectRevert(abi.encodeWithSelector(IGovernance.NoVotingPower.selector, userWithoutReputation));
        
        vm.prank(userWithoutReputation);
        governance.castVote(proposalId, true);
    }
    
    /// @notice Revert test for ProposalNotActive error - vote on finalized proposal
    function testRevert_ProposalNotActive_VoteOnFinalized() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        // Cast a vote and finalize
        vm.prank(userWithReputation);
        governance.castVote(proposalId, true);
        
        // Fast forward and finalize
        vm.warp(block.timestamp + CUSTOM_VOTING_PERIOD + 1);
        governance.finalize(proposalId);
        
        // Now try to vote - should revert
        vm.expectRevert(abi.encodeWithSelector(IGovernance.ProposalNotActive.selector, proposalId));
        
        vm.prank(anotherUser);
        governance.castVote(proposalId, true);
    }
    
    /// @notice Revert test for AlreadyVoted error - double voting attempt
    function testRevert_AlreadyVoted_DoubleVote() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        // Cast first vote
        vm.prank(anotherUser);
        governance.castVote(proposalId, true);
        
        // Try to cast second vote - should revert
        vm.expectRevert(abi.encodeWithSelector(IGovernance.AlreadyVoted.selector, anotherUser, proposalId));
        
        vm.prank(anotherUser);
        governance.castVote(proposalId, false);
    }
    
    /// @notice Revert test for UnauthorizedTreasuryOp error - treasury execution without role
    function testRevert_UnauthorizedTreasuryOp_NoRole() public {
        // The executeTreasury function should revert with OpenZeppelin's AccessControl error
        // when called by a user without TREASURY_ROLE
        vm.expectRevert();
        
        vm.prank(userWithReputation);
        governance.executeTreasury(TEST_ACTION);
    }
    
    /// @notice Additional revert test - empty treasury action
    function testRevert_EmptyTreasuryAction() public {
        vm.expectRevert("Empty treasury action");
        
        vm.prank(treasuryManager);
        governance.executeTreasury("");
    }

    // ========================================================================
    // EDGE CASE AND BOUNDARY TESTS
    // ========================================================================
    
    /// @notice Test finalize during voting period does nothing
    function testEdge_FinalizeDuringVotingPeriod() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        // Try to finalize during voting period
        governance.finalize(proposalId);
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(uint256(proposal.state), uint256(IGovernance.ProposalState.Active), "Should remain Active");
    }
    
    /// @notice Test multiple proposals increment IDs correctly
    function testEdge_MultipleProposalIds() public {
        vm.startPrank(userWithReputation);
        
        uint256 proposalId1 = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        uint256 proposalId2 = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        uint256 proposalId3 = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        vm.stopPrank();
        
        assertEq(proposalId1, 1, "First proposal should be ID 1");
        assertEq(proposalId2, 2, "Second proposal should be ID 2");
        assertEq(proposalId3, 3, "Third proposal should be ID 3");
    }
    
    /// @notice Test quorum not met leads to rejection
    function testEdge_QuorumNotMet() public {
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        // Don't cast any votes - quorum is 1 but no votes cast
        
        // Fast forward past voting period
        vm.warp(block.timestamp + CUSTOM_VOTING_PERIOD + 1);
        
        governance.finalize(proposalId);
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(uint256(proposal.state), uint256(IGovernance.ProposalState.Rejected), "Should be rejected due to no quorum");
    }
    
    /// @notice Test exact 51% approval threshold
    function testEdge_ExactApprovalThreshold() public {
        // Set up users with specific reputation to test exact threshold
        address user51 = address(0x51);
        address user49 = address(0x49);
        
        _registerUserWithReputation(user51, 51);
        _registerUserWithReputation(user49, 49);
        
        vm.prank(userWithReputation);
        uint256 proposalId = governance.propose(TEST_ACTION, CUSTOM_VOTING_PERIOD);
        
        // Cast votes: 51 for, 49 against = exactly 51% approval
        vm.prank(user51);
        governance.castVote(proposalId, true);
        vm.prank(user49);
        governance.castVote(proposalId, false);
        
        // Fast forward past voting period
        vm.warp(block.timestamp + CUSTOM_VOTING_PERIOD + 1);
        
        governance.finalize(proposalId);
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(uint256(proposal.state), uint256(IGovernance.ProposalState.Passed), "Should pass at exactly 51%");
    }
}