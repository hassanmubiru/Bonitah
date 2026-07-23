// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {ICommunityTreasury} from "../src/interfaces/ICommunityTreasury.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * Basic tests for CommunityTreasury investment pool functionality.
 * Tests Requirements 7.1, 7.2, 7.3, 7.6, 13.7
 */
contract CommunityTreasuryInvestmentPoolsTest is Test {
    CommunityTreasury public treasury;
    MockERC20 public token;
    
    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    
    uint256 public constant INITIAL_BALANCE = 10000e18;
    
    function setUp() public {
        // Deploy mock ERC20 token
        token = new MockERC20("Test Token", "TEST", 18);
        
        // Deploy CommunityTreasury proxy
        CommunityTreasury implementation = new CommunityTreasury();
        bytes memory initData = abi.encodeCall(CommunityTreasury.initialize, (admin, IERC20(address(token))));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        treasury = CommunityTreasury(address(proxy));
        
        // Setup test users with tokens and approvals
        address[3] memory users = [user1, user2, user3];
        for (uint256 i = 0; i < users.length; i++) {
            token.mint(users[i], INITIAL_BALANCE);
            vm.prank(users[i]);
            token.approve(address(treasury), INITIAL_BALANCE);
        }
    }
    
    function testInvestmentPoolContributeToPool() public {
        // Create a pool
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        // Join additional users
        vm.prank(user2);
        treasury.joinCircle(poolId);
        vm.prank(user3);
        treasury.joinCircle(poolId);
        
        // Test contribution to investment pool
        uint256 contribution1 = 1000e18;
        uint256 contribution2 = 500e18;
        uint256 contribution3 = 250e18;
        
        // User1 contributes to investment pool
        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit ICommunityTreasury.ContributionMade(user1, poolId, contribution1);
        treasury.contributeToPool(poolId, contribution1);
        
        // User2 contributes to investment pool
        vm.prank(user2);
        vm.expectEmit(true, true, false, true);
        emit ICommunityTreasury.ContributionMade(user2, poolId, contribution2);
        treasury.contributeToPool(poolId, contribution2);
        
        // User3 contributes to investment pool
        vm.prank(user3);
        vm.expectEmit(true, true, false, true);
        emit ICommunityTreasury.ContributionMade(user3, poolId, contribution3);
        treasury.contributeToPool(poolId, contribution3);
        
        // Verify total pool contributions
        uint256 totalExpected = contribution1 + contribution2 + contribution3;
        assertEq(treasury.poolTotalContributions(poolId), totalExpected);
        
        // Verify individual member contributions
        assertEq(treasury.memberTotalContributions(poolId, user1), contribution1);
        assertEq(treasury.memberTotalContributions(poolId, user2), contribution2);
        assertEq(treasury.memberTotalContributions(poolId, user3), contribution3);
        
        // Verify contribution history
        ICommunityTreasury.Contribution[] memory history1 = treasury.contributionHistory(poolId, user1);
        assertEq(history1.length, 1);
        assertEq(history1[0].amount, contribution1);
        
        ICommunityTreasury.Contribution[] memory history2 = treasury.contributionHistory(poolId, user2);
        assertEq(history2.length, 1);
        assertEq(history2[0].amount, contribution2);
        
        ICommunityTreasury.Contribution[] memory history3 = treasury.contributionHistory(poolId, user3);
        assertEq(history3.length, 1);
        assertEq(history3[0].amount, contribution3);
    }
    
    function testOwnershipShare() public {
        // Create a pool and join users
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        vm.prank(user2);
        treasury.joinCircle(poolId);
        
        // Test ownership share with no contributions
        assertEq(treasury.ownershipShare(poolId, user1), 0);
        assertEq(treasury.ownershipShare(poolId, user2), 0);
        
        // User1 contributes 600, user2 contributes 400 (total 1000)
        uint256 contribution1 = 600e18;
        uint256 contribution2 = 400e18;
        
        vm.prank(user1);
        treasury.contributeToPool(poolId, contribution1);
        vm.prank(user2);
        treasury.contributeToPool(poolId, contribution2);
        
        // Verify ownership shares (in ppm)
        // User1: 600/1000 * 1e6 = 600000 ppm (60%)
        // User2: 400/1000 * 1e6 = 400000 ppm (40%)
        assertEq(treasury.ownershipShare(poolId, user1), 600000);
        assertEq(treasury.ownershipShare(poolId, user2), 400000);
        
        // User2 contributes another 600 (now user2 has 1000, user1 has 600, total 1600)
        vm.prank(user2);
        treasury.contributeToPool(poolId, 600e18);
        
        // Verify updated ownership shares
        // User1: 600/1600 * 1e6 = 375000 ppm (37.5%)
        // User2: 1000/1600 * 1e6 = 625000 ppm (62.5%)
        assertEq(treasury.ownershipShare(poolId, user1), 375000);
        assertEq(treasury.ownershipShare(poolId, user2), 625000);
    }
    
    function testYieldDistribution() public {
        // Create a pool and join users
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        vm.prank(user2);
        treasury.joinCircle(poolId);
        
        // Test yield distribution with no contributions
        assertEq(treasury.yieldDistribution(poolId, user1, 1000e18), 0);
        assertEq(treasury.yieldDistribution(poolId, user2, 1000e18), 0);
        
        // User1 contributes 600, user2 contributes 400 (total 1000)
        uint256 contribution1 = 600e18;
        uint256 contribution2 = 400e18;
        
        vm.prank(user1);
        treasury.contributeToPool(poolId, contribution1);
        vm.prank(user2);
        treasury.contributeToPool(poolId, contribution2);
        
        // Test yield distribution for 1000 tokens of yield
        uint256 totalYield = 1000e18;
        
        // User1 should get 60% of yield = 600 tokens
        // User2 should get 40% of yield = 400 tokens
        assertEq(treasury.yieldDistribution(poolId, user1, totalYield), 600e18);
        assertEq(treasury.yieldDistribution(poolId, user2, totalYield), 400e18);
        
        // Test with different yield amount
        uint256 smallerYield = 100e18;
        assertEq(treasury.yieldDistribution(poolId, user1, smallerYield), 60e18);
        assertEq(treasury.yieldDistribution(poolId, user2, smallerYield), 40e18);
        
        // Test with zero yield
        assertEq(treasury.yieldDistribution(poolId, user1, 0), 0);
        assertEq(treasury.yieldDistribution(poolId, user2, 0), 0);
    }
    
    function testInvestmentPoolRevertConditions() public {
        // Create a pool
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        // Test: Zero amount contribution should revert (Req 7.2)
        vm.prank(user1);
        vm.expectRevert(ICommunityTreasury.ZeroAmount.selector);
        treasury.contributeToPool(poolId, 0);
        
        // Test: Non-member contribution should revert
        vm.prank(user2); // user2 is not a member
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.NotMember.selector, user2, poolId));
        treasury.contributeToPool(poolId, 100e18);
    }
    
    function testContributionHistoryWithTimestamps() public {
        // Create a pool
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        // Make multiple contributions with different timestamps
        uint256 amount1 = 100e18;
        uint256 amount2 = 200e18;
        uint256 timestamp1 = 1000;
        uint256 timestamp2 = 2000;
        
        vm.warp(timestamp1);
        vm.prank(user1);
        treasury.contributeToPool(poolId, amount1);
        
        vm.warp(timestamp2);
        vm.prank(user1);
        treasury.contributeToPool(poolId, amount2);
        
        // Verify contribution history (Req 7.3)
        ICommunityTreasury.Contribution[] memory history = treasury.contributionHistory(poolId, user1);
        assertEq(history.length, 2);
        
        assertEq(history[0].amount, amount1);
        assertEq(history[0].timestamp, timestamp1);
        
        assertEq(history[1].amount, amount2);
        assertEq(history[1].timestamp, timestamp2);
        
        // Verify cumulative contribution
        assertEq(treasury.memberTotalContributions(poolId, user1), amount1 + amount2);
    }
}