// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {ICommunityTreasury} from "../src/interfaces/ICommunityTreasury.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * Property-based test for CommunityTreasury contributions and history functionality.
 * **Property 16: Circle contributions and per-member history**
 * **Validates: Requirements 6.3, 6.6, 6.5**
 */
contract CommunityTreasuryPropertyContributionsTest is Test {
    CommunityTreasury public treasury;
    MockERC20 public token;
    
    address public admin = makeAddr("admin");
    address[] public users;
    
    uint256 public constant MAX_USERS = 10;
    uint256 public constant MAX_CONTRIBUTION = 1000e18;
    uint256 public constant INITIAL_BALANCE = 10000e18;
    
    function setUp() public {
        // Deploy mock ERC20 token
        token = new MockERC20("Test Token", "TEST", 18);
        
        // Deploy CommunityTreasury proxy
        CommunityTreasury implementation = new CommunityTreasury();
        bytes memory initData = abi.encodeCall(CommunityTreasury.initialize, (admin, IERC20(address(token))));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        treasury = CommunityTreasury(address(proxy));
        
        // Setup test users
        for (uint256 i = 0; i < MAX_USERS; i++) {
            address user = makeAddr(string(abi.encodePacked("user", i)));
            users.push(user);
            token.mint(user, INITIAL_BALANCE);
            vm.prank(user);
            token.approve(address(treasury), INITIAL_BALANCE);
        }
    }
    
    /**
     * **Property 16: Circle contributions and per-member history**
     * Test that contributions are properly recorded with accurate amounts and timestamps,
     * and that contribution history is maintained per-member.
     * **Validates: Requirements 6.3, 6.6, 6.5**
     */
    function testProperty_ContributionHistoryAccuracy(
        uint8 numUsers,
        uint8 numContributions,
        uint256 seed
    ) public {
        // Bound inputs
        numUsers = uint8(bound(numUsers, 2, MAX_USERS));
        numContributions = uint8(bound(numContributions, 1, 20));
        
        // Create circle with first user
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(numUsers, 51);
        
        // Add additional members
        for (uint256 i = 1; i < numUsers; i++) {
            vm.prank(users[i]);
            treasury.joinCircle(poolId);
        }
        
        // Track expected state using arrays for each user
        uint256[][] memory expectedAmounts = new uint256[][](numUsers);
        uint256[][] memory expectedTimestamps = new uint256[][](numUsers);
        uint256[] memory userContributionCounts = new uint256[](numUsers);
        uint256 expectedTreasuryBalance = 0;
        
        // Initialize arrays for each user
        for (uint256 i = 0; i < numUsers; i++) {
            expectedAmounts[i] = new uint256[](numContributions);
            expectedTimestamps[i] = new uint256[](numContributions);
        }
        
        // Generate contributions using seed for deterministic randomness
        uint256 currentSeed = seed;
        for (uint256 i = 0; i < numContributions; i++) {
            // Select random user and amount
            uint256 userIndex = currentSeed % numUsers;
            address contributor = users[userIndex];
            uint256 amount = (currentSeed % MAX_CONTRIBUTION) + 1; // Ensure amount > 0
            currentSeed = uint256(keccak256(abi.encode(currentSeed, i)));
            
            // Record expected state before contribution
            uint256 contributionTimestamp = block.timestamp + i; // Advance time for each contribution
            vm.warp(contributionTimestamp);
            
            expectedAmounts[userIndex][userContributionCounts[userIndex]] = amount;
            expectedTimestamps[userIndex][userContributionCounts[userIndex]] = contributionTimestamp;
            userContributionCounts[userIndex]++;
            expectedTreasuryBalance += amount;
            
            // Make contribution
            vm.prank(contributor);
            treasury.contribute(poolId, amount);
        }
        
        // Verify contribution history for each user
        for (uint256 i = 0; i < numUsers; i++) {
            address user = users[i];
            ICommunityTreasury.Contribution[] memory history = treasury.contributionHistory(poolId, user);
            uint256 expectedCount = userContributionCounts[i];
            
            // Verify history length matches expected contributions
            assertEq(
                history.length,
                expectedCount,
                "History length mismatch for user"
            );
            
            // Verify each contribution in history
            for (uint256 j = 0; j < expectedCount; j++) {
                assertEq(
                    history[j].amount,
                    expectedAmounts[i][j],
                    "Contribution amount mismatch"
                );
                assertEq(
                    history[j].timestamp,
                    expectedTimestamps[i][j],
                    "Contribution timestamp mismatch"
                );
            }
        }
        
        // Verify treasury balance matches sum of all contributions
        ICommunityTreasury.Circle memory circle = treasury.getCircle(poolId);
        assertEq(
            circle.treasuryBalance,
            expectedTreasuryBalance,
            "Treasury balance mismatch"
        );
        
        // Verify token balance matches treasury balance
        assertEq(
            token.balanceOf(address(treasury)),
            expectedTreasuryBalance,
            "Token balance mismatch"
        );
    }
    
    /**
     * **Property 16: Member-only contribution validation**
     * Test that only members can contribute to circles (Req 6.5).
     * **Validates: Requirements 6.5**
     */
    function testProperty_MemberOnlyContributions(uint8 numMembers, uint256 contributionAmount) public {
        // Bound inputs
        numMembers = uint8(bound(numMembers, 2, MAX_USERS - 1)); // Leave room for non-member
        contributionAmount = bound(contributionAmount, 1, MAX_CONTRIBUTION);
        
        // Create circle with first user
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(numMembers, 51);
        
        // Add members (excluding last user as non-member)
        for (uint256 i = 1; i < numMembers; i++) {
            vm.prank(users[i]);
            treasury.joinCircle(poolId);
        }
        
        address nonMember = users[numMembers]; // This user is not a member
        
        // Verify that non-member contribution reverts with correct error
        vm.prank(nonMember);
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.NotMember.selector, nonMember, poolId));
        treasury.contribute(poolId, contributionAmount);
        
        // Verify that member contributions succeed
        for (uint256 i = 0; i < numMembers; i++) {
            vm.prank(users[i]);
            treasury.contribute(poolId, contributionAmount);
            
            // Verify contribution was recorded
            ICommunityTreasury.Contribution[] memory history = treasury.contributionHistory(poolId, users[i]);
            assertEq(history.length, 1, "Member contribution not recorded");
            assertEq(history[0].amount, contributionAmount, "Member contribution amount incorrect");
        }
    }
    
    /**
     * **Property 16: Zero amount contribution validation**
     * Test that zero-amount contributions are rejected (Req 6.3).
     * **Validates: Requirements 6.3**
     */
    function testProperty_ZeroAmountRejection(uint8 numMembers) public {
        // Bound inputs
        numMembers = uint8(bound(numMembers, 2, MAX_USERS));
        
        // Create circle with first user
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(numMembers, 51);
        
        // Add additional members
        for (uint256 i = 1; i < numMembers; i++) {
            vm.prank(users[i]);
            treasury.joinCircle(poolId);
        }
        
        // Verify zero amount contributions are rejected for all members
        for (uint256 i = 0; i < numMembers; i++) {
            vm.prank(users[i]);
            vm.expectRevert(ICommunityTreasury.ZeroAmount.selector);
            treasury.contribute(poolId, 0);
            
            // Verify no contribution was recorded
            ICommunityTreasury.Contribution[] memory history = treasury.contributionHistory(poolId, users[i]);
            assertEq(history.length, 0, "Zero contribution should not be recorded");
        }
        
        // Verify treasury balance remains zero
        ICommunityTreasury.Circle memory circle = treasury.getCircle(poolId);
        assertEq(circle.treasuryBalance, 0, "Treasury balance should remain zero");
    }
    
    /**
     * **Property 16: Contribution history ordering**
     * Test that contribution history maintains chronological order (Req 6.6).
     * **Validates: Requirements 6.6**
     */
    function testProperty_ContributionHistoryOrdering(uint8 numContributions, uint256 seed) public {
        // Bound inputs
        numContributions = uint8(bound(numContributions, 2, 10));
        
        // Create circle with one member
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(10, 51);
        
        uint256[] memory contributionTimestamps = new uint256[](numContributions);
        uint256[] memory contributionAmounts = new uint256[](numContributions);
        
        // Make multiple contributions with increasing timestamps
        uint256 currentSeed = seed;
        for (uint256 i = 0; i < numContributions; i++) {
            uint256 amount = (currentSeed % MAX_CONTRIBUTION) + 1;
            uint256 timestamp = block.timestamp + (i * 100); // Ensure strictly increasing timestamps
            
            vm.warp(timestamp);
            vm.prank(users[0]);
            treasury.contribute(poolId, amount);
            
            contributionTimestamps[i] = timestamp;
            contributionAmounts[i] = amount;
            
            currentSeed = uint256(keccak256(abi.encode(currentSeed, i)));
        }
        
        // Verify history maintains chronological order
        ICommunityTreasury.Contribution[] memory history = treasury.contributionHistory(poolId, users[0]);
        assertEq(history.length, numContributions, "History length incorrect");
        
        for (uint256 i = 0; i < numContributions; i++) {
            assertEq(history[i].timestamp, contributionTimestamps[i], "Timestamp order incorrect");
            assertEq(history[i].amount, contributionAmounts[i], "Amount order incorrect");
            
            // Verify chronological ordering
            if (i > 0) {
                assertTrue(
                    history[i].timestamp >= history[i-1].timestamp,
                    "History not in chronological order"
                );
            }
        }
    }
}