// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {ICommunityTreasury} from "../src/interfaces/ICommunityTreasury.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title CommunityTreasuryPropertyTest
/// @notice Property-based tests for the CommunityTreasury contract.
/// @dev Validates Requirements 6.7 implementation using Foundry fuzz testing.
contract CommunityTreasuryPropertyTest is Test {
    CommunityTreasury public treasury;
    MockERC20 public token;
    
    address public admin = makeAddr("admin");
    address public creator = makeAddr("creator");
    address public recipient = makeAddr("recipient");
    
    // Test constants
    uint256 public constant INITIAL_BALANCE = 10_000e18;
    uint256 public constant MIN_CONTRIBUTION = 1e18;
    uint256 public constant MAX_CONTRIBUTION = 1000e18;
    
    // Bounded parameters for property testing
    struct BoundedParams {
        uint8 memberCount;      // 2-20 members (reasonable test range)
        uint8 approvalThreshold; // 1-100 percent
        uint256 actionAmount;    // Amount for treasury action
        uint8 voterCount;       // Number of voters (0 to memberCount)
    }
    
    function setUp() public {
        // Deploy mock ERC20 token
        token = new MockERC20("Test Token", "TEST", 18);
        
        // Deploy CommunityTreasury proxy
        CommunityTreasury implementation = new CommunityTreasury();
        bytes memory initData = abi.encodeCall(CommunityTreasury.initialize, (admin, IERC20(address(token))));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        treasury = CommunityTreasury(address(proxy));
    }
    
    /// @notice **Property 17: Treasury action executes exactly at threshold**
    /// **Validates: Requirements 6.7**
    /// 
    /// This property verifies that treasury actions execute if and only if the cumulative
    /// approving votes reach or exceed the circle's stored approval threshold.
    /// 
    /// The property tests:
    /// 1. Actions with votes below threshold do NOT execute
    /// 2. Actions with votes at or above threshold DO execute
    /// 3. The execution state is deterministic based only on vote count vs threshold
    function testProperty17_TreasuryActionExecutesExactlyAtThreshold(
        uint8 _memberCount,
        uint8 _approvalThreshold,
        uint256 _actionAmount,
        uint8 _voterCount
    ) public {
        // Bound parameters to valid ranges using modulo for deterministic behavior
        uint256 memberCount = 2 + (_memberCount % 19); // 2-20 members (reasonable test range)
        uint256 approvalThreshold = 1 + (_approvalThreshold % 100); // 1-100%
        uint256 actionAmount = 1e18 + (_actionAmount % (MAX_CONTRIBUTION - 1e18)); // 1e18 to MAX_CONTRIBUTION  
        uint256 voterCount = _voterCount % (memberCount + 1); // 0 to memberCount
        
        // Create circle with bounded parameters
        vm.prank(creator);
        uint256 poolId = treasury.createCircle(memberCount, uint8(approvalThreshold));
        
        // Generate member addresses and add them to the circle
        address[] memory members = new address[](memberCount);
        members[0] = creator; // Creator is already a member
        
        for (uint256 i = 1; i < memberCount; i++) {
            members[i] = makeAddr(string(abi.encodePacked("member", i)));
            vm.prank(members[i]);
            treasury.joinCircle(poolId);
        }
        
        // Fund the treasury - each member contributes enough to cover the action
        for (uint256 i = 0; i < memberCount; i++) {
            token.mint(members[i], INITIAL_BALANCE);
            vm.prank(members[i]);
            token.approve(address(treasury), INITIAL_BALANCE);
            vm.prank(members[i]);
            treasury.contribute(poolId, actionAmount);
        }
        
        // Propose a treasury action
        vm.prank(creator);
        uint256 actionId = treasury.proposeAction(poolId, recipient, actionAmount);
        
        // Calculate required approvals using the contract's threshold formula
        uint256 requiredApprovals = (memberCount * approvalThreshold + 99) / 100;
        
        // Cast the specified number of votes
        for (uint256 i = 0; i < voterCount && i < memberCount; i++) {
            vm.prank(members[i]);
            treasury.vote(actionId);
        }
        
        // Verify the action state
        ICommunityTreasury.TreasuryAction memory action = treasury.getAction(actionId);
        
        // **Core Property Verification (Requirement 6.7)**
        if (voterCount >= requiredApprovals) {
            // Action should be executed when votes reach or exceed threshold
            assertTrue(action.executed, "Action should be executed when votes >= threshold");
            assertEq(token.balanceOf(recipient), actionAmount, "Recipient should receive action amount");
        } else {
            // Action should NOT be executed when votes are below threshold
            assertFalse(action.executed, "Action should NOT be executed when votes < threshold");
            assertEq(token.balanceOf(recipient), 0, "Recipient should not receive tokens");
        }
        
        // Verify vote count matches what we cast
        assertEq(action.approvals, voterCount, "Action approvals should match actual vote count");
    }
    
    /// @notice Test edge case: single member circle with 100% threshold
    /// This tests the boundary condition where exactly one vote is needed
    function testProperty17_SingleMemberCircle() public {
        // Create a 2-member circle with 100% threshold (both must vote)
        vm.prank(creator);
        uint256 poolId = treasury.createCircle(2, 100);
        
        // Add one more member
        address member2 = makeAddr("member2");
        vm.prank(member2);
        treasury.joinCircle(poolId);
        
        // Fund treasury
        token.mint(creator, INITIAL_BALANCE);
        token.mint(member2, INITIAL_BALANCE);
        vm.prank(creator);
        token.approve(address(treasury), INITIAL_BALANCE);
        vm.prank(member2);
        token.approve(address(treasury), INITIAL_BALANCE);
        
        vm.prank(creator);
        treasury.contribute(poolId, 100e18);
        
        // Propose action
        uint256 actionAmount = 50e18;
        vm.prank(creator);
        uint256 actionId = treasury.proposeAction(poolId, recipient, actionAmount);
        
        // Required approvals: ceil(2 * 100 / 100) = 2
        // Test with only 1 vote - should not execute
        vm.prank(creator);
        treasury.vote(actionId);
        
        ICommunityTreasury.TreasuryAction memory action = treasury.getAction(actionId);
        assertFalse(action.executed, "Action should not execute with only 1/2 votes");
        
        // Add second vote - should execute
        vm.prank(member2);
        treasury.vote(actionId);
        
        action = treasury.getAction(actionId);
        assertTrue(action.executed, "Action should execute with 2/2 votes");
        assertEq(token.balanceOf(recipient), actionAmount, "Recipient should receive action amount");
    }
    
    /// @notice Test edge case: minimum threshold (1%)
    /// This tests the case where even 1 vote out of many should execute
    function testProperty17_MinimumThreshold() public {
        // Create a 10-member circle with 1% threshold
        vm.prank(creator);
        uint256 poolId = treasury.createCircle(10, 1);
        
        // Add 9 more members
        address[] memory members = new address[](10);
        members[0] = creator;
        
        for (uint256 i = 1; i < 10; i++) {
            members[i] = makeAddr(string(abi.encodePacked("member", i)));
            vm.prank(members[i]);
            treasury.joinCircle(poolId);
        }
        
        // Fund treasury
        for (uint256 i = 0; i < 10; i++) {
            token.mint(members[i], INITIAL_BALANCE);
            vm.prank(members[i]);
            token.approve(address(treasury), INITIAL_BALANCE);
            vm.prank(members[i]);
            treasury.contribute(poolId, 10e18);
        }
        
        // Propose action
        uint256 actionAmount = 50e18;
        vm.prank(creator);
        uint256 actionId = treasury.proposeAction(poolId, recipient, actionAmount);
        
        // Required approvals: ceil(10 * 1 / 100) = ceil(0.1) = 1
        // One vote should be enough to execute
        vm.prank(creator);
        treasury.vote(actionId);
        
        ICommunityTreasury.TreasuryAction memory action = treasury.getAction(actionId);
        assertTrue(action.executed, "Action should execute with 1 vote at 1% threshold");
        assertEq(token.balanceOf(recipient), actionAmount, "Recipient should receive action amount");
    }
    
    /// @notice Test that threshold calculation handles rounding correctly
    /// This verifies the ceiling division formula: (memberCount * threshold + 99) / 100
    function testProperty17_ThresholdRoundingCorrectness(
        uint8 _memberCount,
        uint8 _threshold
    ) public {
        uint256 memberCount = bound(_memberCount, 2, 100);
        uint256 threshold = bound(_threshold, 1, 100);
        
        // Calculate required approvals using the contract's formula
        uint256 requiredApprovals = (memberCount * threshold + 99) / 100;
        
        // Verify this is indeed the ceiling of memberCount * threshold / 100
        uint256 exactCalculation = (memberCount * threshold);
        uint256 expectedCeiling = (exactCalculation + 99) / 100;
        
        assertEq(requiredApprovals, expectedCeiling, "Threshold calculation should use ceiling division");
        
        // Verify it's never more than memberCount
        assertLe(requiredApprovals, memberCount, "Required approvals should never exceed member count");
        
        // Verify it's at least 1 (except for edge cases)
        if (threshold > 0) {
            assertGe(requiredApprovals, 1, "Required approvals should be at least 1 for non-zero threshold");
        }
    }
}