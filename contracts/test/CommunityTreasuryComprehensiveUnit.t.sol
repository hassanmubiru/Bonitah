// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {ICommunityTreasury} from "../src/interfaces/ICommunityTreasury.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MaliciousERC20} from "./mocks/MaliciousERC20.sol";
import {ReentrancyAttacker} from "./mocks/ReentrancyAttacker.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title CommunityTreasuryComprehensiveUnitTest
/// @notice Comprehensive unit tests for CommunityTreasury covering events, reverts, and reentrancy
/// @dev Implements Task 5.8: unit tests, event tests, revert tests, and reentrancy tests
contract CommunityTreasuryComprehensiveUnitTest is Test {
    CommunityTreasury public treasury;
    CommunityTreasury public maliciousTreasury; // Treasury using malicious token for reentrancy tests
    MockERC20 public token;
    MaliciousERC20 public maliciousToken;
    ReentrancyAttacker public attacker;
    
    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public recipient = makeAddr("recipient");
    address public pauser = makeAddr("pauser");
    address public upgrader = makeAddr("upgrader");
    
    uint256 public constant INITIAL_BALANCE = 1000e18;
    uint256 public constant CONTRIBUTION_AMOUNT = 100e18;
    
    // Event signatures for testing
    event PoolCreated(address indexed creator, uint256 indexed poolId, uint256 maxMembers, uint8 approvalThreshold);
    event MemberJoined(uint256 indexed poolId, address indexed member);
    event ContributionMade(address indexed contributor, uint256 indexed poolId, uint256 amount);
    event VoteCast(address indexed voter, uint256 indexed actionId);
    event ActionExecuted(uint256 indexed actionId, address indexed to, uint256 amount);
    
    function setUp() public {
        // Deploy mock ERC20 token
        token = new MockERC20("Test Token", "TEST", 18);
        
        // Deploy malicious ERC20 token for reentrancy tests
        maliciousToken = new MaliciousERC20();
        
        // Deploy CommunityTreasury proxy with regular token
        CommunityTreasury implementation = new CommunityTreasury();
        bytes memory initData = abi.encodeCall(CommunityTreasury.initialize, (admin, IERC20(address(token))));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        treasury = CommunityTreasury(address(proxy));
        
        // Deploy CommunityTreasury proxy with malicious token for reentrancy tests
        bytes memory maliciousInitData = abi.encodeCall(CommunityTreasury.initialize, (admin, IERC20(address(maliciousToken))));
        ERC1967Proxy maliciousProxy = new ERC1967Proxy(address(implementation), maliciousInitData);
        maliciousTreasury = CommunityTreasury(address(maliciousProxy));
        
        // Configure malicious token
        maliciousToken.setTarget(maliciousTreasury);
        
        // Setup roles for admin
        vm.startPrank(admin);
        treasury.grantRole(treasury.PAUSER_ROLE(), pauser);
        treasury.grantRole(treasury.UPGRADER_ROLE(), upgrader);
        maliciousTreasury.grantRole(maliciousTreasury.PAUSER_ROLE(), pauser);
        maliciousTreasury.grantRole(maliciousTreasury.UPGRADER_ROLE(), upgrader);
        vm.stopPrank();
        
        // Deploy reentrancy attacker (still useful for some tests)
        attacker = new ReentrancyAttacker(treasury, token);
        
        // Setup initial token balances
        token.mint(user1, INITIAL_BALANCE);
        token.mint(user2, INITIAL_BALANCE);
        token.mint(user3, INITIAL_BALANCE);
        token.mint(address(attacker), INITIAL_BALANCE);
        
        maliciousToken.mint(user1, INITIAL_BALANCE);
        maliciousToken.mint(user2, INITIAL_BALANCE);
        maliciousToken.mint(user3, INITIAL_BALANCE);
        
        // Approve treasury to spend tokens
        vm.prank(user1);
        token.approve(address(treasury), INITIAL_BALANCE);
        vm.prank(user2);
        token.approve(address(treasury), INITIAL_BALANCE);
        vm.prank(user3);
        token.approve(address(treasury), INITIAL_BALANCE);
        
        // Approve malicious treasury to spend malicious tokens
        vm.prank(user1);
        maliciousToken.approve(address(maliciousTreasury), INITIAL_BALANCE);
        vm.prank(user2);
        maliciousToken.approve(address(maliciousTreasury), INITIAL_BALANCE);
        vm.prank(user3);
        maliciousToken.approve(address(maliciousTreasury), INITIAL_BALANCE);
        
        // Approve attacker to spend tokens
        vm.prank(address(attacker));
        token.approve(address(treasury), INITIAL_BALANCE);
    }

    // ========================================
    // EVENT ASSERTION TESTS
    // ========================================

    /// @notice Test PoolCreated event emission with correct arguments
    function test_PoolCreatedEventEmission() public {
        uint256 maxMembers = 10;
        uint8 approvalThreshold = 51;
        
        vm.expectEmit(true, true, false, true);
        emit PoolCreated(user1, 1, maxMembers, approvalThreshold);
        
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(maxMembers, approvalThreshold);
        
        assertEq(poolId, 1);
    }

    /// @notice Test MemberJoined event emission (not explicitly required but part of functionality)
    function test_MemberJoinedEventEmission() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.expectEmit(true, true, false, false);
        emit MemberJoined(poolId, user2);
        
        vm.prank(user2);
        treasury.joinCircle(poolId);
    }

    /// @notice Test ContributionMade event emission for circle contributions
    function test_ContributionMadeEventEmission_Circle() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.expectEmit(true, true, false, true);
        emit ContributionMade(user1, poolId, CONTRIBUTION_AMOUNT);
        
        vm.prank(user1);
        treasury.contribute(poolId, CONTRIBUTION_AMOUNT);
    }

    /// @notice Test ContributionMade event emission for investment pool contributions
    function test_ContributionMadeEventEmission_InvestmentPool() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.expectEmit(true, true, false, true);
        emit ContributionMade(user1, poolId, CONTRIBUTION_AMOUNT);
        
        vm.prank(user1);
        treasury.contributeToPool(poolId, CONTRIBUTION_AMOUNT);
    }

    /// @notice Test VoteCast event emission with correct arguments
    function test_VoteCastEventEmission() public {
        // Setup: create circle, add member, contribute, propose action
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.prank(user2);
        treasury.joinCircle(poolId);
        
        vm.prank(user1);
        treasury.contribute(poolId, CONTRIBUTION_AMOUNT);
        
        vm.prank(user1);
        uint256 actionId = treasury.proposeAction(poolId, recipient, 50e18);
        
        // Test VoteCast event
        vm.expectEmit(true, true, false, false);
        emit VoteCast(user1, actionId);
        
        vm.prank(user1);
        treasury.vote(actionId);
    }

    /// @notice Test ActionExecuted event emission with correct arguments
    function test_ActionExecutedEventEmission() public {
        // Setup: create circle, add member, contribute, propose action
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.prank(user2);
        treasury.joinCircle(poolId);
        
        vm.prank(user1);
        treasury.contribute(poolId, CONTRIBUTION_AMOUNT);
        
        uint256 actionAmount = 50e18;
        vm.prank(user1);
        uint256 actionId = treasury.proposeAction(poolId, recipient, actionAmount);
        
        // Vote to reach threshold
        vm.prank(user1);
        treasury.vote(actionId);
        
        // Expect ActionExecuted event on final vote
        vm.expectEmit(true, true, false, true);
        emit ActionExecuted(actionId, recipient, actionAmount);
        
        vm.prank(user2);
        treasury.vote(actionId);
        
        // Verify execution happened
        assertEq(token.balanceOf(recipient), actionAmount);
    }

    // ========================================
    // REVERT TESTS - ALL CUSTOM ERRORS
    // ========================================

    /// @notice Test InvalidCircleParams error - maxMembers too low
    function test_RevertInvalidCircleParams_MaxMembersTooLow() public {
        vm.prank(user1);
        vm.expectRevert(ICommunityTreasury.InvalidCircleParams.selector);
        treasury.createCircle(1, 51); // Below MIN_MEMBERS (2)
    }

    /// @notice Test InvalidCircleParams error - maxMembers too high
    function test_RevertInvalidCircleParams_MaxMembersTooHigh() public {
        vm.prank(user1);
        vm.expectRevert(ICommunityTreasury.InvalidCircleParams.selector);
        treasury.createCircle(1001, 51); // Above MAX_MEMBERS (1000)
    }

    /// @notice Test InvalidCircleParams error - threshold too low
    function test_RevertInvalidCircleParams_ThresholdTooLow() public {
        vm.prank(user1);
        vm.expectRevert(ICommunityTreasury.InvalidCircleParams.selector);
        treasury.createCircle(10, 0); // Below MIN_THRESHOLD (1)
    }

    /// @notice Test InvalidCircleParams error - threshold too high
    function test_RevertInvalidCircleParams_ThresholdTooHigh() public {
        vm.prank(user1);
        vm.expectRevert(ICommunityTreasury.InvalidCircleParams.selector);
        treasury.createCircle(10, 101); // Above MAX_THRESHOLD (100)
    }

    /// @notice Test NotMember error on contribute
    function test_RevertNotMember_Contribute() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.NotMember.selector, user2, poolId));
        treasury.contribute(poolId, CONTRIBUTION_AMOUNT);
    }

    /// @notice Test NotMember error on contributeToPool
    function test_RevertNotMember_ContributeToPool() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.NotMember.selector, user2, poolId));
        treasury.contributeToPool(poolId, CONTRIBUTION_AMOUNT);
    }

    /// @notice Test NotMember error on proposeAction
    function test_RevertNotMember_ProposeAction() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.NotMember.selector, user2, poolId));
        treasury.proposeAction(poolId, recipient, 50e18);
    }

    /// @notice Test NotMember error on vote
    function test_RevertNotMember_Vote() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.prank(user1);
        uint256 actionId = treasury.proposeAction(poolId, recipient, 50e18);
        
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.NotMember.selector, user2, poolId));
        treasury.vote(actionId);
    }

    /// @notice Test AlreadyMember error
    function test_RevertAlreadyMember() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.AlreadyMember.selector, user1, poolId));
        treasury.joinCircle(poolId);
    }

    /// @notice Test CircleClosedOrFull error - circle full
    function test_RevertCircleClosedOrFull_CircleFull() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(2, 51); // maxMembers = 2
        
        vm.prank(user2);
        treasury.joinCircle(poolId); // Now at capacity (2 members)
        
        vm.prank(user3);
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.CircleClosedOrFull.selector, poolId));
        treasury.joinCircle(poolId);
    }

    /// @notice Test ZeroAmount error on contribute
    function test_RevertZeroAmount_Contribute() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.prank(user1);
        vm.expectRevert(ICommunityTreasury.ZeroAmount.selector);
        treasury.contribute(poolId, 0);
    }

    /// @notice Test ZeroAmount error on contributeToPool
    function test_RevertZeroAmount_ContributeToPool() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.prank(user1);
        vm.expectRevert(ICommunityTreasury.ZeroAmount.selector);
        treasury.contributeToPool(poolId, 0);
    }

    /// @notice Test ZeroAmount error on proposeAction
    function test_RevertZeroAmount_ProposeAction() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.prank(user1);
        vm.expectRevert(ICommunityTreasury.ZeroAmount.selector);
        treasury.proposeAction(poolId, recipient, 0);
    }

    /// @notice Test AlreadyVoted error
    function test_RevertAlreadyVoted() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.prank(user1);
        treasury.contribute(poolId, CONTRIBUTION_AMOUNT);
        
        vm.prank(user1);
        uint256 actionId = treasury.proposeAction(poolId, recipient, 50e18);
        
        vm.prank(user1);
        treasury.vote(actionId);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.AlreadyVoted.selector, user1, actionId));
        treasury.vote(actionId);
    }

    /// @notice Test InvalidRecipient error (contract-specific error)
    function test_RevertInvalidRecipient() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.prank(user1);
        vm.expectRevert(CommunityTreasury.InvalidRecipient.selector);
        treasury.proposeAction(poolId, address(0), 50e18);
    }

    /// @notice Test UnknownAction error (contract-specific error)
    function test_RevertUnknownAction() public {
        uint256 nonExistentActionId = 999;
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(CommunityTreasury.UnknownAction.selector, nonExistentActionId));
        treasury.vote(nonExistentActionId);
    }

    // ========================================
    // REENTRANCY ATTACK TESTS
    // ========================================

    /// @notice Test reentrancy protection on contribute function
    function test_ReentrancyProtection_Contribute() public {
        // Setup: create circle using malicious treasury
        vm.prank(user1);
        uint256 poolId = maliciousTreasury.createCircle(10, 51);
        
        // Configure malicious token for attack
        maliciousToken.setAttackParams(poolId, CONTRIBUTION_AMOUNT, 0);
        maliciousToken.enableAttack();
        
        // Attempt contribution - should succeed but reentrancy should be blocked
        vm.prank(user1);
        maliciousTreasury.contribute(poolId, CONTRIBUTION_AMOUNT);
        
        // Verify the original contribution worked
        ICommunityTreasury.Circle memory circle = maliciousTreasury.getCircle(poolId);
        assertEq(circle.treasuryBalance, CONTRIBUTION_AMOUNT);
    }

    /// @notice Test reentrancy protection on contributeToPool function
    function test_ReentrancyProtection_ContributeToPool() public {
        // Setup: create circle using malicious treasury
        vm.prank(user1);
        uint256 poolId = maliciousTreasury.createCircle(10, 51);
        
        // Configure malicious token for attack
        maliciousToken.setAttackParams(poolId, CONTRIBUTION_AMOUNT, 0);
        maliciousToken.enableAttack();
        
        // Attempt contribution to investment pool - should succeed but reentrancy should be blocked
        vm.prank(user1);
        maliciousTreasury.contributeToPool(poolId, CONTRIBUTION_AMOUNT);
        
        // Verify the original contribution worked
        uint256 totalContributions = maliciousTreasury.poolTotalContributions(poolId);
        assertEq(totalContributions, CONTRIBUTION_AMOUNT);
    }

    /// @notice Test reentrancy protection on vote function (when action executes)
    function test_ReentrancyProtection_Vote() public {
        // Setup: create circle with user2 as member using malicious treasury
        vm.prank(user1);
        uint256 poolId = maliciousTreasury.createCircle(10, 51);
        
        vm.prank(user2);
        maliciousTreasury.joinCircle(poolId);
        
        // Fund the circle
        vm.prank(user1);
        maliciousTreasury.contribute(poolId, CONTRIBUTION_AMOUNT);
        
        // Propose action to user3 address
        uint256 actionAmount = 50e18;
        vm.prank(user1);
        uint256 actionId = maliciousTreasury.proposeAction(poolId, user3, actionAmount);
        
        // First vote
        vm.prank(user1);
        maliciousTreasury.vote(actionId);
        
        // Enable attack for final vote (which will trigger execution and transfer)
        maliciousToken.setAttackParams(poolId, CONTRIBUTION_AMOUNT, actionId);
        maliciousToken.enableAttack();
        
        // Final vote - should execute action but block reentrancy
        // The reentrancy protection is working if this doesn't revert
        vm.prank(user2);
        maliciousTreasury.vote(actionId);
        
        // Verify action executed normally
        ICommunityTreasury.TreasuryAction memory action = maliciousTreasury.getAction(actionId);
        assertTrue(action.executed);
        
        // Verify only one execution occurred (reentrancy blocked)
        ICommunityTreasury.Circle memory circle = maliciousTreasury.getCircle(poolId);
        assertEq(circle.treasuryBalance, CONTRIBUTION_AMOUNT - actionAmount, "Treasury should have correct remaining balance");
        
        // Verify user3 received exactly the action amount (no double payment from reentrancy)
        uint256 expectedBalance = INITIAL_BALANCE + actionAmount;
        assertEq(maliciousToken.balanceOf(user3), expectedBalance, "User3 should have initial balance + action amount only");
    }

    /// @notice Test that normal operations work correctly (no false positives from reentrancy guard)
    function test_NormalOperationsWork() public {
        // Create circle
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        // Join circle
        vm.prank(user2);
        treasury.joinCircle(poolId);
        
        // Contribute normally
        vm.prank(user1);
        treasury.contribute(poolId, CONTRIBUTION_AMOUNT);
        
        // Contribute to investment pool normally
        vm.prank(user1);
        treasury.contributeToPool(poolId, CONTRIBUTION_AMOUNT);
        
        // Propose and vote normally
        vm.prank(user1);
        uint256 actionId = treasury.proposeAction(poolId, recipient, 50e18);
        
        vm.prank(user1);
        treasury.vote(actionId);
        
        vm.prank(user2);
        treasury.vote(actionId);
        
        // Verify action executed
        ICommunityTreasury.TreasuryAction memory action = treasury.getAction(actionId);
        assertTrue(action.executed);
        assertEq(token.balanceOf(recipient), 50e18);
    }

    // ========================================
    // ADDITIONAL UNIT TESTS
    // ========================================

    /// @notice Test pause functionality prevents contributions
    function test_PauseFunctionality() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        // Pause the contract
        vm.prank(pauser);
        treasury.pause();
        
        // Contributions should fail when paused (using modern OpenZeppelin error format)
        vm.prank(user1);
        vm.expectRevert();
        treasury.contribute(poolId, CONTRIBUTION_AMOUNT);
        
        vm.prank(user1);
        vm.expectRevert();
        treasury.contributeToPool(poolId, CONTRIBUTION_AMOUNT);
        
        // Unpause and verify operations work
        vm.prank(pauser);
        treasury.unpause();
        
        vm.prank(user1);
        treasury.contribute(poolId, CONTRIBUTION_AMOUNT);
        
        assertEq(treasury.getCircle(poolId).treasuryBalance, CONTRIBUTION_AMOUNT);
    }

    /// @notice Test comprehensive event sequence for full workflow
    function test_CompleteWorkflowEventSequence() public {
        uint256 maxMembers = 5;
        uint8 approvalThreshold = 60;
        
        // Expect PoolCreated event
        vm.expectEmit(true, true, false, true);
        emit PoolCreated(user1, 1, maxMembers, approvalThreshold);
        
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(maxMembers, approvalThreshold);
        
        // Expect MemberJoined event
        vm.expectEmit(true, true, false, false);
        emit MemberJoined(poolId, user2);
        
        vm.prank(user2);
        treasury.joinCircle(poolId);
        
        // Expect ContributionMade event for circle
        vm.expectEmit(true, true, false, true);
        emit ContributionMade(user1, poolId, CONTRIBUTION_AMOUNT);
        
        vm.prank(user1);
        treasury.contribute(poolId, CONTRIBUTION_AMOUNT);
        
        // Expect ContributionMade event for investment pool
        vm.expectEmit(true, true, false, true);
        emit ContributionMade(user2, poolId, CONTRIBUTION_AMOUNT / 2);
        
        vm.prank(user2);
        treasury.contributeToPool(poolId, CONTRIBUTION_AMOUNT / 2);
        
        // Propose action
        uint256 actionAmount = 75e18;
        vm.prank(user1);
        uint256 actionId = treasury.proposeAction(poolId, recipient, actionAmount);
        
        // Expect VoteCast events
        vm.expectEmit(true, true, false, false);
        emit VoteCast(user1, actionId);
        
        vm.prank(user1);
        treasury.vote(actionId);
        
        // Expect both VoteCast and ActionExecuted on final vote (reaches threshold)
        vm.expectEmit(true, true, false, false);
        emit VoteCast(user2, actionId);
        
        vm.expectEmit(true, true, false, true);
        emit ActionExecuted(actionId, recipient, actionAmount);
        
        vm.prank(user2);
        treasury.vote(actionId);
        
        // Verify final state
        assertEq(token.balanceOf(recipient), actionAmount);
        assertTrue(treasury.getAction(actionId).executed);
    }
}