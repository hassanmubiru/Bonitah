// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Governance} from "../src/Governance.sol";
import {Registry} from "../src/Registry.sol";
import {IGovernance} from "../src/interfaces/IGovernance.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";

/// @title GovernanceTest
/// @notice Comprehensive tests for the Governance contract implementation (Task 7.1).
/// @dev Verifies Requirements 9.1-9.10, 13.8, 14.5, 14.8 implementation.
contract GovernanceTest is Test {
    Governance public governance;
    Registry public registry;
    
    address public admin = address(0x1);
    address public treasuryManager = address(0x2);
    address public verifier = address(0x3);
    address public reputationManager = address(0x4);
    address public user1 = address(0x5);
    address public user2 = address(0x6);
    address public user3 = address(0x7);
    address public unregistered = address(0x8);
    
    bytes public constant TEST_ACTION = "test_action";
    uint256 public constant TEST_VOTING_PERIOD = 1 days;
    
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
        
        // Register users and give them reputation
        vm.prank(user1);
        registry.register();
        vm.prank(reputationManager);
        registry.increaseReputation(user1, 100);
        
        vm.prank(user2);
        registry.register();
        vm.prank(reputationManager);
        registry.increaseReputation(user2, 50);
        
        vm.prank(user3);
        registry.register();
        vm.prank(reputationManager);
        registry.increaseReputation(user3, 25);
    }
    
    /// @notice Test successful proposal creation (Req 9.1, 13.8)
    function testPropose() public {
        uint256 expectedVotingEnd = block.timestamp + TEST_VOTING_PERIOD;
        
        vm.expectEmit(true, true, false, true);
        emit ProposalCreated(user1, 1, expectedVotingEnd);
        
        vm.prank(user1);
        uint256 proposalId = governance.propose(TEST_ACTION, TEST_VOTING_PERIOD);
        
        assertEq(proposalId, 1);
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(proposal.id, 1);
        assertEq(proposal.proposer, user1);
        assertEq(proposal.votingEnds, expectedVotingEnd);
        assertEq(proposal.forVotes, 0);
        assertEq(proposal.againstVotes, 0);
        assertEq(uint256(proposal.state), uint256(IGovernance.ProposalState.Active));
    }
    
    /// @notice Test proposal creation fails with no voting power (Req 9.1)
    function testProposeFailsWithNoVotingPower() public {
        vm.prank(unregistered);
        vm.expectRevert(abi.encodeWithSelector(IGovernance.NoVotingPower.selector, unregistered));
        governance.propose(TEST_ACTION, TEST_VOTING_PERIOD);
    }
    
    /// @notice Test successful vote casting (Req 9.2, 9.3, 13.8)
    function testCastVote() public {
        // Create proposal
        vm.prank(user1);
        uint256 proposalId = governance.propose(TEST_ACTION, TEST_VOTING_PERIOD);
        
        // Cast vote for
        vm.expectEmit(true, true, false, true);
        emit VoteCast(user1, proposalId, 100, true);
        
        vm.prank(user1);
        governance.castVote(proposalId, true);
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(proposal.forVotes, 100);
        assertEq(proposal.againstVotes, 0);
        assertTrue(governance.hasVoted(proposalId, user1));
        
        // Cast vote against
        vm.expectEmit(true, true, false, true);
        emit VoteCast(user2, proposalId, 50, false);
        
        vm.prank(user2);
        governance.castVote(proposalId, false);
        
        proposal = governance.getProposal(proposalId);
        assertEq(proposal.forVotes, 100);
        assertEq(proposal.againstVotes, 50);
        assertTrue(governance.hasVoted(proposalId, user2));
    }
    
    /// @notice Test vote fails with no voting power (Req 9.1)
    function testCastVoteFailsWithNoVotingPower() public {
        vm.prank(user1);
        uint256 proposalId = governance.propose(TEST_ACTION, TEST_VOTING_PERIOD);
        
        vm.prank(unregistered);
        vm.expectRevert(abi.encodeWithSelector(IGovernance.NoVotingPower.selector, unregistered));
        governance.castVote(proposalId, true);
    }
    
    /// @notice Test vote fails on inactive proposal (Req 9.3)
    function testCastVoteFailsOnInactiveProposal() public {
        vm.prank(user1);
        uint256 proposalId = governance.propose(TEST_ACTION, TEST_VOTING_PERIOD);
        
        // Fast forward past voting period
        vm.warp(block.timestamp + TEST_VOTING_PERIOD + 1);
        
        // Finalize proposal
        governance.finalize(proposalId);
        
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(IGovernance.ProposalNotActive.selector, proposalId));
        governance.castVote(proposalId, true);
    }
    
    /// @notice Test double voting fails (Req 9.9)
    function testCastVoteFailsOnDoubleVote() public {
        vm.prank(user1);
        uint256 proposalId = governance.propose(TEST_ACTION, TEST_VOTING_PERIOD);
        
        vm.prank(user1);
        governance.castVote(proposalId, true);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(IGovernance.AlreadyVoted.selector, user1, proposalId));
        governance.castVote(proposalId, false);
    }
    
    /// @notice Test proposal finalization with passed outcome (Req 9.4, 9.5)
    function testFinalizeProposalPassed() public {
        vm.prank(user1);
        uint256 proposalId = governance.propose(TEST_ACTION, TEST_VOTING_PERIOD);
        
        // Cast majority for votes
        vm.prank(user1);
        governance.castVote(proposalId, true);
        vm.prank(user2);
        governance.castVote(proposalId, true);
        vm.prank(user3);
        governance.castVote(proposalId, false);
        
        // Fast forward past voting period
        vm.warp(block.timestamp + TEST_VOTING_PERIOD + 1);
        
        vm.expectEmit(true, false, false, true);
        emit ProposalFinalized(proposalId, IGovernance.ProposalState.Passed);
        
        governance.finalize(proposalId);
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(uint256(proposal.state), uint256(IGovernance.ProposalState.Passed));
    }
    
    /// @notice Test proposal finalization with rejected outcome (Req 9.4, 9.5)
    function testFinalizeProposalRejected() public {
        vm.prank(user1);
        uint256 proposalId = governance.propose(TEST_ACTION, TEST_VOTING_PERIOD);
        
        // Cast majority against votes
        vm.prank(user1);
        governance.castVote(proposalId, false);
        vm.prank(user2);
        governance.castVote(proposalId, false);
        vm.prank(user3);
        governance.castVote(proposalId, true);
        
        // Fast forward past voting period
        vm.warp(block.timestamp + TEST_VOTING_PERIOD + 1);
        
        vm.expectEmit(true, false, false, true);
        emit ProposalFinalized(proposalId, IGovernance.ProposalState.Rejected);
        
        governance.finalize(proposalId);
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(uint256(proposal.state), uint256(IGovernance.ProposalState.Rejected));
    }
    
    /// @notice Test outcome calculation before finalization (Req 9.6)
    function testOutcomeOfBeforeFinalization() public {
        vm.prank(user1);
        uint256 proposalId = governance.propose(TEST_ACTION, TEST_VOTING_PERIOD);
        
        // Initially Active
        assertEq(uint256(governance.outcomeOf(proposalId)), uint256(IGovernance.ProposalState.Active));
        
        // Cast votes
        vm.prank(user1);
        governance.castVote(proposalId, true);
        vm.prank(user2);
        governance.castVote(proposalId, true);
        
        // Still Active during voting period
        assertEq(uint256(governance.outcomeOf(proposalId)), uint256(IGovernance.ProposalState.Active));
        
        // Fast forward past voting period
        vm.warp(block.timestamp + TEST_VOTING_PERIOD + 1);
        
        // Now should calculate outcome
        assertEq(uint256(governance.outcomeOf(proposalId)), uint256(IGovernance.ProposalState.Passed));
    }
    
    /// @notice Test treasury execution with proper role (Req 9.7, 9.10)
    function testExecuteTreasury() public {
        vm.prank(treasuryManager);
        // This should not revert
        governance.executeTreasury(TEST_ACTION);
    }
    
    /// @notice Test treasury execution fails without proper role (Req 9.10)
    function testExecuteTreasuryFailsWithoutRole() public {
        vm.prank(user1);
        vm.expectRevert();
        governance.executeTreasury(TEST_ACTION);
    }
    
    /// @notice Test voting power calculation (Req 9.1)
    function testVotingPowerOf() public {
        assertEq(governance.votingPowerOf(user1), 100);
        assertEq(governance.votingPowerOf(user2), 50);
        assertEq(governance.votingPowerOf(user3), 25);
        assertEq(governance.votingPowerOf(unregistered), 0);
    }
    
    /// @notice Test finalize does nothing if already finalized
    function testFinalizeIdempotent() public {
        vm.prank(user1);
        uint256 proposalId = governance.propose(TEST_ACTION, TEST_VOTING_PERIOD);
        
        vm.prank(user1);
        governance.castVote(proposalId, true);
        
        // Fast forward past voting period
        vm.warp(block.timestamp + TEST_VOTING_PERIOD + 1);
        
        governance.finalize(proposalId);
        IGovernance.ProposalState firstState = governance.getProposal(proposalId).state;
        
        // Finalize again - should be idempotent
        governance.finalize(proposalId);
        IGovernance.ProposalState secondState = governance.getProposal(proposalId).state;
        
        assertEq(uint256(firstState), uint256(secondState));
    }
    
    /// @notice Test finalize does nothing during voting period
    function testFinalizeDoesNothingDuringVoting() public {
        vm.prank(user1);
        uint256 proposalId = governance.propose(TEST_ACTION, TEST_VOTING_PERIOD);
        
        // Try to finalize during voting period
        governance.finalize(proposalId);
        
        IGovernance.Proposal memory proposal = governance.getProposal(proposalId);
        assertEq(uint256(proposal.state), uint256(IGovernance.ProposalState.Active));
    }
}