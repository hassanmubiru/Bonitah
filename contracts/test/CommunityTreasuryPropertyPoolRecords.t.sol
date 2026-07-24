// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {ICommunityTreasury} from "../src/interfaces/ICommunityTreasury.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * **Property 20: Pool contribution records amount and timestamp**
 * **Validates: Requirements 7.3**
 * 
 * This property test verifies that:
 * 1. Pool contribution history accurately records each contribution amount and timestamp (Req 7.3)
 * 2. Contribution history is maintained in chronological order
 * 3. Multiple contributions are recorded separately with correct timestamps
 * 4. Contribution history is per-member and per-pool
 * 5. Timestamps reflect the actual block timestamp at contribution time
 * 6. History is preserved across multiple contribution sessions
 */
contract CommunityTreasuryPropertyPoolRecordsTest is Test {
    CommunityTreasury public treasury;
    MockERC20 public token;
    
    address public admin = makeAddr("admin");
    address[] public users;
    
    uint256 public constant MAX_USERS = 10;
    uint256 public constant MAX_CONTRIBUTIONS_PER_USER = 15;
    uint256 public constant MAX_CONTRIBUTION_AMOUNT = 5000e18;
    uint256 public constant INITIAL_BALANCE = 100000e18;
    
    // Struct to track expected contribution records
    struct ExpectedContribution {
        uint256 amount;
        uint256 timestamp;
    }
    
    function setUp() public {
        // Deploy mock ERC20 token
        token = new MockERC20("Test Token", "TEST", 18);
        
        // Deploy CommunityTreasury proxy
        CommunityTreasury implementation = new CommunityTreasury();
        bytes memory initData = abi.encodeCall(CommunityTreasury.initialize, (admin, IERC20(address(token))));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        treasury = CommunityTreasury(address(proxy));
        
        // Setup test users with initial balances and approvals
        for (uint256 i = 0; i < MAX_USERS; i++) {
            address user = makeAddr(string(abi.encodePacked("user", i)));
            users.push(user);
            token.mint(user, INITIAL_BALANCE);
            vm.prank(user);
            token.approve(address(treasury), INITIAL_BALANCE);
        }
    }
    
    /**
     * **Property 20: Pool contribution records amount and timestamp accuracy**
     * Tests that each pool contribution is recorded with the correct amount and timestamp,
     * and that contribution history maintains proper chronological ordering.
     * **Validates: Requirements 7.3**
     */
    function testProperty20_PoolContributionRecordsAccuracy(
        uint8 numUsers,
        uint8 maxContributionsPerUser,
        uint256 seed
    ) public {
        // Bound inputs to reasonable ranges
        numUsers = uint8(bound(numUsers, 1, MAX_USERS));
        maxContributionsPerUser = uint8(bound(maxContributionsPerUser, 1, MAX_CONTRIBUTIONS_PER_USER));
        
        // Create pool and add users
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(numUsers, 51);
        
        for (uint256 i = 1; i < numUsers; i++) {
            vm.prank(users[i]);
            treasury.joinCircle(poolId);
        }
        
        // Track expected contribution history for each user
        ExpectedContribution[][] memory expectedHistory = new ExpectedContribution[][](numUsers);
        for (uint256 i = 0; i < numUsers; i++) {
            expectedHistory[i] = new ExpectedContribution[](maxContributionsPerUser);
        }
        uint256[] memory userContributionCounts = new uint256[](numUsers);
        
        uint256 currentSeed = seed;
        uint256 baseTimestamp = 1000000; // Starting timestamp
        
        // Generate contributions for each user
        for (uint256 userIdx = 0; userIdx < numUsers; userIdx++) {
            address user = users[userIdx];
            
            // Generate random number of contributions for this user (1 to max)
            uint256 numContributions = 1 + (currentSeed % maxContributionsPerUser);
            userContributionCounts[userIdx] = numContributions;
            currentSeed = uint256(keccak256(abi.encode(currentSeed, "userContributions", userIdx)));
            
            for (uint256 contribIdx = 0; contribIdx < numContributions; contribIdx++) {
                // Generate contribution amount (ensure > 0)
                uint256 amount = 1 + (currentSeed % MAX_CONTRIBUTION_AMOUNT);
                currentSeed = uint256(keccak256(abi.encode(currentSeed, "amount", userIdx, contribIdx)));
                
                // Set unique timestamp for each contribution (chronologically increasing)
                uint256 timestamp = baseTimestamp + (userIdx * 1000) + (contribIdx * 100);
                vm.warp(timestamp);
                
                // Record expected contribution
                expectedHistory[userIdx][contribIdx] = ExpectedContribution({
                    amount: amount,
                    timestamp: timestamp
                });
                
                // Make the contribution
                vm.prank(user);
                treasury.contributeToPool(poolId, amount);
            }
        }
        
        // Verify contribution history for each user
        for (uint256 userIdx = 0; userIdx < numUsers; userIdx++) {
            address user = users[userIdx];
            ICommunityTreasury.Contribution[] memory actualHistory = treasury.contributionHistory(poolId, user);
            uint256 expectedCount = userContributionCounts[userIdx];
            
            // **Requirement 7.3 Validation: History length matches actual contributions**
            assertEq(
                actualHistory.length,
                expectedCount,
                string(abi.encodePacked("History length mismatch for user ", vm.toString(userIdx)))
            );
            
            // Verify each contribution record
            for (uint256 contribIdx = 0; contribIdx < expectedCount; contribIdx++) {
                ExpectedContribution memory expected = expectedHistory[userIdx][contribIdx];
                ICommunityTreasury.Contribution memory actual = actualHistory[contribIdx];
                
                // **Requirement 7.3 Validation: Amount recorded accurately**
                assertEq(
                    actual.amount,
                    expected.amount,
                    string(abi.encodePacked("Amount mismatch for user ", vm.toString(userIdx), " contribution ", vm.toString(contribIdx)))
                );
                
                // **Requirement 7.3 Validation: Timestamp recorded accurately**
                assertEq(
                    actual.timestamp,
                    expected.timestamp,
                    string(abi.encodePacked("Timestamp mismatch for user ", vm.toString(userIdx), " contribution ", vm.toString(contribIdx)))
                );
            }
            
            // Verify chronological ordering within each user's history
            _verifyChronologicalOrdering(actualHistory, userIdx);
        }
    }
    
    /**
     * Helper function to verify that contribution history is in chronological order
     */
    function _verifyChronologicalOrdering(
        ICommunityTreasury.Contribution[] memory history,
        uint256 userIdx
    ) private pure {
        for (uint256 i = 1; i < history.length; i++) {
            assertTrue(
                history[i].timestamp >= history[i-1].timestamp,
                string(abi.encodePacked("Chronological order violation for user ", vm.toString(userIdx), " between contributions ", vm.toString(i-1), " and ", vm.toString(i)))
            );
        }
    }
    
    /**
     * Test contribution history across multiple pools per user
     */
    function testProperty20_ContributionHistoryPerPool() public {
        // Create two different pools
        vm.prank(users[0]);
        uint256 poolId1 = treasury.createCircle(5, 51);
        vm.prank(users[1]);
        uint256 poolId2 = treasury.createCircle(5, 60);
        
        // Add user[0] to both pools, user[1] is already in pool2
        vm.prank(users[0]);
        treasury.joinCircle(poolId2);
        vm.prank(users[1]);
        treasury.joinCircle(poolId1);
        
        // Make contributions to different pools at different times
        uint256 amount1 = 1000e18;
        uint256 amount2 = 2000e18;
        uint256 amount3 = 1500e18;
        uint256 timestamp1 = 1000;
        uint256 timestamp2 = 2000;
        uint256 timestamp3 = 3000;
        
        // User[0] contributes to pool1
        vm.warp(timestamp1);
        vm.prank(users[0]);
        treasury.contributeToPool(poolId1, amount1);
        
        // User[0] contributes to pool2
        vm.warp(timestamp2);
        vm.prank(users[0]);
        treasury.contributeToPool(poolId2, amount2);
        
        // User[0] contributes to pool1 again
        vm.warp(timestamp3);
        vm.prank(users[0]);
        treasury.contributeToPool(poolId1, amount3);
        
        // Verify pool1 history for user[0]: should have 2 contributions
        ICommunityTreasury.Contribution[] memory pool1History = treasury.contributionHistory(poolId1, users[0]);
        assertEq(pool1History.length, 2, "Pool1 should have 2 contributions from user[0]");
        assertEq(pool1History[0].amount, amount1, "First pool1 contribution amount incorrect");
        assertEq(pool1History[0].timestamp, timestamp1, "First pool1 contribution timestamp incorrect");
        assertEq(pool1History[1].amount, amount3, "Second pool1 contribution amount incorrect");
        assertEq(pool1History[1].timestamp, timestamp3, "Second pool1 contribution timestamp incorrect");
        
        // Verify pool2 history for user[0]: should have 1 contribution
        ICommunityTreasury.Contribution[] memory pool2History = treasury.contributionHistory(poolId2, users[0]);
        assertEq(pool2History.length, 1, "Pool2 should have 1 contribution from user[0]");
        assertEq(pool2History[0].amount, amount2, "Pool2 contribution amount incorrect");
        assertEq(pool2History[0].timestamp, timestamp2, "Pool2 contribution timestamp incorrect");
        
        // Verify user[1] has no contributions to pool1 yet
        ICommunityTreasury.Contribution[] memory user1Pool1History = treasury.contributionHistory(poolId1, users[1]);
        assertEq(user1Pool1History.length, 0, "User[1] should have no contributions to pool1");
    }
    
    /**
     * Test timestamp accuracy with rapid consecutive contributions
     */
    function testProperty20_RapidConsecutiveContributions() public {
        // Create pool with one user
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(5, 51);
        
        uint256 numContributions = 10;
        uint256[] memory amounts = new uint256[](numContributions);
        uint256[] memory timestamps = new uint256[](numContributions);
        
        // Make rapid consecutive contributions with incrementing timestamps
        for (uint256 i = 0; i < numContributions; i++) {
            amounts[i] = (i + 1) * 100e18; // 100, 200, 300, ... tokens
            timestamps[i] = 1000 + i; // Timestamps: 1000, 1001, 1002, ...
            
            vm.warp(timestamps[i]);
            vm.prank(users[0]);
            treasury.contributeToPool(poolId, amounts[i]);
        }
        
        // Verify all contributions are recorded with correct amounts and timestamps
        ICommunityTreasury.Contribution[] memory history = treasury.contributionHistory(poolId, users[0]);
        assertEq(history.length, numContributions, "Should record all rapid contributions");
        
        for (uint256 i = 0; i < numContributions; i++) {
            assertEq(history[i].amount, amounts[i], string(abi.encodePacked("Rapid contribution ", vm.toString(i), " amount incorrect")));
            assertEq(history[i].timestamp, timestamps[i], string(abi.encodePacked("Rapid contribution ", vm.toString(i), " timestamp incorrect")));
        }
        
        // Verify chronological ordering
        _verifyChronologicalOrdering(history, 0);
    }
    
    /**
     * Test contribution history with same timestamps (edge case)
     */
    function testProperty20_SameTimestampContributions() public {
        // Create pool with two users
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(5, 51);
        vm.prank(users[1]);
        treasury.joinCircle(poolId);
        
        uint256 sameTimestamp = 5000;
        uint256 amount1 = 1000e18;
        uint256 amount2 = 2000e18;
        
        // Both users contribute at the exact same timestamp
        vm.warp(sameTimestamp);
        vm.prank(users[0]);
        treasury.contributeToPool(poolId, amount1);
        
        // Still at same timestamp
        vm.prank(users[1]);
        treasury.contributeToPool(poolId, amount2);
        
        // Verify both contributions recorded with same timestamp
        ICommunityTreasury.Contribution[] memory history0 = treasury.contributionHistory(poolId, users[0]);
        ICommunityTreasury.Contribution[] memory history1 = treasury.contributionHistory(poolId, users[1]);
        
        assertEq(history0.length, 1, "User[0] should have 1 contribution");
        assertEq(history1.length, 1, "User[1] should have 1 contribution");
        
        assertEq(history0[0].amount, amount1, "User[0] amount should be correct");
        assertEq(history0[0].timestamp, sameTimestamp, "User[0] timestamp should be correct");
        
        assertEq(history1[0].amount, amount2, "User[1] amount should be correct");
        assertEq(history1[0].timestamp, sameTimestamp, "User[1] timestamp should be correct");
    }
    
    /**
     * Test contribution history persistence across multiple sessions
     */
    function testProperty20_HistoryPersistenceAcrossSessions() public {
        // Create pool with user
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(5, 51);
        
        // Session 1: Make some contributions
        uint256[] memory session1Amounts = new uint256[](3);
        uint256[] memory session1Timestamps = new uint256[](3);
        
        for (uint256 i = 0; i < 3; i++) {
            session1Amounts[i] = (i + 1) * 500e18;
            session1Timestamps[i] = 1000 + (i * 100);
            
            vm.warp(session1Timestamps[i]);
            vm.prank(users[0]);
            treasury.contributeToPool(poolId, session1Amounts[i]);
        }
        
        // Verify session 1 contributions
        ICommunityTreasury.Contribution[] memory afterSession1 = treasury.contributionHistory(poolId, users[0]);
        assertEq(afterSession1.length, 3, "Should have 3 contributions after session 1");
        
        // Session 2: Add more contributions after some time gap
        uint256[] memory session2Amounts = new uint256[](2);
        uint256[] memory session2Timestamps = new uint256[](2);
        
        for (uint256 i = 0; i < 2; i++) {
            session2Amounts[i] = (i + 1) * 750e18;
            session2Timestamps[i] = 2000 + (i * 50); // Different time range
            
            vm.warp(session2Timestamps[i]);
            vm.prank(users[0]);
            treasury.contributeToPool(poolId, session2Amounts[i]);
        }
        
        // Verify all contributions are preserved
        ICommunityTreasury.Contribution[] memory fullHistory = treasury.contributionHistory(poolId, users[0]);
        assertEq(fullHistory.length, 5, "Should have 5 total contributions across both sessions");
        
        // Verify session 1 contributions are still there and correct
        for (uint256 i = 0; i < 3; i++) {
            assertEq(fullHistory[i].amount, session1Amounts[i], string(abi.encodePacked("Session 1 contribution ", vm.toString(i), " amount preserved")));
            assertEq(fullHistory[i].timestamp, session1Timestamps[i], string(abi.encodePacked("Session 1 contribution ", vm.toString(i), " timestamp preserved")));
        }
        
        // Verify session 2 contributions are appended correctly
        for (uint256 i = 0; i < 2; i++) {
            uint256 historyIdx = 3 + i;
            assertEq(fullHistory[historyIdx].amount, session2Amounts[i], string(abi.encodePacked("Session 2 contribution ", vm.toString(i), " amount correct")));
            assertEq(fullHistory[historyIdx].timestamp, session2Timestamps[i], string(abi.encodePacked("Session 2 contribution ", vm.toString(i), " timestamp correct")));
        }
        
        // Verify overall chronological ordering
        _verifyChronologicalOrdering(fullHistory, 0);
    }
    
    /**
     * Test contribution history with maximum realistic contributions
     */
    function testProperty20_LargeContributionHistory() public {
        // Create pool with user
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(5, 51);
        
        uint256 numContributions = 50; // Large number of contributions
        uint256[] memory amounts = new uint256[](numContributions);
        uint256[] memory timestamps = new uint256[](numContributions);
        
        // Generate deterministic but varied contributions
        uint256 seed = 12345;
        for (uint256 i = 0; i < numContributions; i++) {
            amounts[i] = 1 + (seed % MAX_CONTRIBUTION_AMOUNT);
            timestamps[i] = 10000 + (i * 60); // 1 minute apart
            seed = uint256(keccak256(abi.encode(seed, i)));
            
            vm.warp(timestamps[i]);
            vm.prank(users[0]);
            treasury.contributeToPool(poolId, amounts[i]);
        }
        
        // Verify all contributions are recorded
        ICommunityTreasury.Contribution[] memory history = treasury.contributionHistory(poolId, users[0]);
        assertEq(history.length, numContributions, "Should record all large number of contributions");
        
        // Verify accuracy of first, middle, and last contributions
        assertEq(history[0].amount, amounts[0], "First contribution amount should be correct");
        assertEq(history[0].timestamp, timestamps[0], "First contribution timestamp should be correct");
        
        uint256 midIdx = numContributions / 2;
        assertEq(history[midIdx].amount, amounts[midIdx], "Middle contribution amount should be correct");
        assertEq(history[midIdx].timestamp, timestamps[midIdx], "Middle contribution timestamp should be correct");
        
        uint256 lastIdx = numContributions - 1;
        assertEq(history[lastIdx].amount, amounts[lastIdx], "Last contribution amount should be correct");
        assertEq(history[lastIdx].timestamp, timestamps[lastIdx], "Last contribution timestamp should be correct");
        
        // Verify chronological ordering across all contributions
        _verifyChronologicalOrdering(history, 0);
        
        // Verify total contributions match sum of individual amounts
        uint256 expectedTotal = 0;
        for (uint256 i = 0; i < numContributions; i++) {
            expectedTotal += amounts[i];
        }
        assertEq(treasury.memberTotalContributions(poolId, users[0]), expectedTotal, "Total contributions should match sum of individual amounts");
    }
    
    /**
     * Test edge case: empty contribution history
     */
    function testProperty20_EmptyContributionHistory() public {
        // Create pool with users but no contributions
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(5, 51);
        vm.prank(users[1]);
        treasury.joinCircle(poolId);
        
        // Verify empty history for both users
        ICommunityTreasury.Contribution[] memory history0 = treasury.contributionHistory(poolId, users[0]);
        ICommunityTreasury.Contribution[] memory history1 = treasury.contributionHistory(poolId, users[1]);
        
        assertEq(history0.length, 0, "User[0] should have empty contribution history");
        assertEq(history1.length, 0, "User[1] should have empty contribution history");
        
        // Verify total contributions are zero
        assertEq(treasury.memberTotalContributions(poolId, users[0]), 0, "User[0] total contributions should be zero");
        assertEq(treasury.memberTotalContributions(poolId, users[1]), 0, "User[1] total contributions should be zero");
        assertEq(treasury.poolTotalContributions(poolId), 0, "Pool total contributions should be zero");
    }
}