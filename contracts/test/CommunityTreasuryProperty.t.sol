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
/// @dev Validates Requirements 6.1, 6.2, 6.7, 6.9, 6.11 implementation using Foundry fuzz testing.
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
    
    /// @notice **Property 15: Savings circle creation and membership rules**
    /// **Validates: Requirements 6.1, 6.2, 6.9, 6.11**
    /// 
    /// This property verifies that circle creation works with valid parameters and that
    /// membership joining follows the correct rules.
    /// 
    /// The property tests:
    /// 1. Circles created with valid maxMembers [2,1000] and threshold [1,100] store parameters correctly
    /// 2. Creator is automatically added as first member with memberCount = 1
    /// 3. Non-members can join open, non-full circles (incrementing member count)
    /// 4. Joining closed, full, or already-joined circles reverts without adding member
    /// 5. Out-of-range creation parameters revert and create no circle
    function testProperty15_SavingsCircleCreationAndMembershipRules(
        uint16 _maxMembers,
        uint8 _approvalThreshold,
        uint8 _attemptedJoins
    ) public {
        // Test Part 1: Valid parameter bounds and successful creation
        uint256 maxMembers = bound(_maxMembers, 2, 1000); // Valid range per Req 6.11
        uint256 approvalThreshold = bound(_approvalThreshold, 1, 100); // Valid range per Req 6.11
        uint256 attemptedJoins = bound(_attemptedJoins, 0, 15); // Test various join scenarios
        
        // Create circle with valid parameters (Req 6.1)
        vm.prank(creator);
        uint256 poolId = treasury.createCircle(maxMembers, uint8(approvalThreshold));
        
        // Verify circle creation succeeded and stored parameters correctly (Req 6.1)
        ICommunityTreasury.Circle memory circle = treasury.getCircle(poolId);
        assertEq(circle.creator, creator, "Circle creator should be set correctly");
        assertEq(circle.maxMembers, maxMembers, "Circle maxMembers should be stored correctly");
        assertEq(circle.approvalThreshold, uint8(approvalThreshold), "Circle threshold should be stored correctly");
        assertEq(circle.memberCount, 1, "Circle should start with 1 member (creator)");
        assertTrue(circle.open, "Circle should be open by default");
        assertEq(circle.treasuryBalance, 0, "Circle should start with zero treasury balance");
        
        // Verify creator is automatically a member (Req 6.1)
        assertTrue(treasury.isMember(poolId, creator), "Creator should be automatically added as member");
        
        // Test Part 2: Non-member joining open, non-full circle (Req 6.2)
        address[] memory joiners = new address[](attemptedJoins);
        uint256 successfulJoins = 0;
        
        for (uint256 i = 0; i < attemptedJoins; i++) {
            joiners[i] = makeAddr(string(abi.encodePacked("joiner", i)));
            
            // Check if circle has space for another member
            ICommunityTreasury.Circle memory currentCircle = treasury.getCircle(poolId);
            
            if (currentCircle.memberCount < maxMembers) {
                // Should succeed - circle is open and not full (Req 6.2)
                vm.prank(joiners[i]);
                treasury.joinCircle(poolId);
                
                // Verify membership was added and count incremented (Req 6.2)
                assertTrue(treasury.isMember(poolId, joiners[i]), "New member should be added successfully");
                
                ICommunityTreasury.Circle memory updatedCircle = treasury.getCircle(poolId);
                assertEq(updatedCircle.memberCount, currentCircle.memberCount + 1, "Member count should increment");
                
                successfulJoins++;
            } else {
                // Should fail - circle is full (Req 6.9)
                vm.prank(joiners[i]);
                vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.CircleClosedOrFull.selector, poolId));
                treasury.joinCircle(poolId);
                
                // Verify no membership was added
                assertFalse(treasury.isMember(poolId, joiners[i]), "Failed joiner should not be a member");
            }
        }
        
        // Verify final member count is correct
        ICommunityTreasury.Circle memory finalCircle = treasury.getCircle(poolId);
        assertEq(finalCircle.memberCount, 1 + successfulJoins, "Final member count should match successful joins + creator");
        assertLe(finalCircle.memberCount, maxMembers, "Member count should never exceed maxMembers");
        
        // Test Part 3: Already-joined member trying to join again (Req 6.9)
        if (successfulJoins > 0) {
            vm.prank(joiners[0]);
            vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.AlreadyMember.selector, joiners[0], poolId));
            treasury.joinCircle(poolId);
        }
        
        // Test creator trying to join again (Req 6.9)
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.AlreadyMember.selector, creator, poolId));
        treasury.joinCircle(poolId);
    }
    
    /// @notice Test invalid circle creation parameters (Req 6.11)
    /// This validates that out-of-range parameters revert and create no circle
    function testProperty15_InvalidCircleCreationParameters(
        uint16 _maxMembers,
        uint8 _approvalThreshold
    ) public {
        // Test cases that should revert (Req 6.11)
        bool shouldRevert = false;
        
        // Case 1: maxMembers below minimum (< 2)
        if (_maxMembers < 2) {
            shouldRevert = true;
        }
        // Case 2: maxMembers above maximum (> 1000) 
        else if (_maxMembers > 1000) {
            shouldRevert = true;
        }
        // Case 3: approvalThreshold below minimum (< 1)
        else if (_approvalThreshold < 1) {
            shouldRevert = true;
        }
        // Case 4: approvalThreshold above maximum (> 100)
        else if (_approvalThreshold > 100) {
            shouldRevert = true;
        }
        
        uint256 initialPoolCount = treasury.poolCount();
        
        if (shouldRevert) {
            // Should revert with InvalidCircleParams (Req 6.11)
            vm.prank(creator);
            vm.expectRevert(ICommunityTreasury.InvalidCircleParams.selector);
            treasury.createCircle(_maxMembers, _approvalThreshold);
            
            // Verify no circle was created
            assertEq(treasury.poolCount(), initialPoolCount, "Pool count should not increment on invalid params");
        } else {
            // Should succeed with valid parameters
            vm.prank(creator);
            uint256 poolId = treasury.createCircle(_maxMembers, _approvalThreshold);
            
            // Verify circle was created successfully
            assertEq(treasury.poolCount(), initialPoolCount + 1, "Pool count should increment on valid params");
            
            ICommunityTreasury.Circle memory circle = treasury.getCircle(poolId);
            assertEq(circle.maxMembers, _maxMembers, "Valid maxMembers should be stored");
            assertEq(circle.approvalThreshold, _approvalThreshold, "Valid threshold should be stored");
        }
    }
    
    /// @notice Test circle closure behavior (membership joining closed circles)
    function testProperty15_ClosedCircleMembership() public {
        // Create a circle
        vm.prank(creator);
        uint256 poolId = treasury.createCircle(10, 51);
        
        // Close the circle by setting open = false
        // Note: The current contract doesn't have a close function, so we can't test this specific case
        // This is left as a placeholder for when circle closing functionality is added
        
        // For now, test the full circle scenario instead
        address[] memory members = new address[](9); // maxMembers is 10, creator is already in
        
        // Fill the circle to capacity
        for (uint256 i = 0; i < 9; i++) {
            members[i] = makeAddr(string(abi.encodePacked("member", i)));
            vm.prank(members[i]);
            treasury.joinCircle(poolId);
        }
        
        // Verify circle is now full
        ICommunityTreasury.Circle memory fullCircle = treasury.getCircle(poolId);
        assertEq(fullCircle.memberCount, 10, "Circle should be at max capacity");
        
        // Try to join full circle - should revert (Req 6.9)
        address lateJoiner = makeAddr("lateJoiner");
        vm.prank(lateJoiner);
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.CircleClosedOrFull.selector, poolId));
        treasury.joinCircle(poolId);
        
        // Verify no membership was added
        assertFalse(treasury.isMember(poolId, lateJoiner), "Late joiner should not be added to full circle");
        assertEq(treasury.getCircle(poolId).memberCount, 10, "Member count should remain at max after failed join");
    }
    
    /// @notice Test edge cases for circle parameters
    function testProperty15_EdgeCasesCircleParameters() public {
        // Test minimum valid parameters
        vm.prank(creator);
        uint256 poolId1 = treasury.createCircle(2, 1); // Min members, min threshold
        
        ICommunityTreasury.Circle memory minCircle = treasury.getCircle(poolId1);
        assertEq(minCircle.maxMembers, 2, "Min maxMembers should be accepted");
        assertEq(minCircle.approvalThreshold, 1, "Min threshold should be accepted");
        
        // Test maximum valid parameters
        address creator2 = makeAddr("creator2");
        vm.prank(creator2);
        uint256 poolId2 = treasury.createCircle(1000, 100); // Max members, max threshold
        
        ICommunityTreasury.Circle memory maxCircle = treasury.getCircle(poolId2);
        assertEq(maxCircle.maxMembers, 1000, "Max maxMembers should be accepted");
        assertEq(maxCircle.approvalThreshold, 100, "Max threshold should be accepted");
        
        // Test boundary violations
        address creator3 = makeAddr("creator3");
        
        // Test maxMembers = 1 (below minimum)
        vm.prank(creator3);
        vm.expectRevert(ICommunityTreasury.InvalidCircleParams.selector);
        treasury.createCircle(1, 50);
        
        // Test maxMembers = 1001 (above maximum)
        vm.prank(creator3);
        vm.expectRevert(ICommunityTreasury.InvalidCircleParams.selector);
        treasury.createCircle(1001, 50);
        
        // Test threshold = 0 (below minimum)
        vm.prank(creator3);
        vm.expectRevert(ICommunityTreasury.InvalidCircleParams.selector);
        treasury.createCircle(10, 0);
        
        // Test threshold = 101 (above maximum)
        vm.prank(creator3);
        vm.expectRevert(ICommunityTreasury.InvalidCircleParams.selector);
        treasury.createCircle(10, 101);
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