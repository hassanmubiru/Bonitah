// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {ICommunityTreasury} from "../src/interfaces/ICommunityTreasury.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * Integration test to verify that investment pool functionality works alongside
 * existing savings circle functionality without conflicts.
 */
contract CommunityTreasuryIntegrationTest is Test {
    CommunityTreasury public treasury;
    MockERC20 public token;
    
    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    
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
        address[2] memory users = [user1, user2];
        for (uint256 i = 0; i < users.length; i++) {
            token.mint(users[i], INITIAL_BALANCE);
            vm.prank(users[i]);
            token.approve(address(treasury), INITIAL_BALANCE);
        }
    }
    
    /**
     * Test that both savings circle contributions and investment pool contributions
     * work correctly on the same pool and share the same contribution history.
     */
    function testSavingsCircleAndInvestmentPoolIntegration() public {
        // Create a circle
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        // User2 joins the circle
        vm.prank(user2);
        treasury.joinCircle(poolId);
        
        // User1 makes a savings circle contribution
        uint256 circleContribution = 500e18;
        vm.prank(user1);
        treasury.contribute(poolId, circleContribution);
        
        // User2 makes an investment pool contribution
        uint256 poolContribution = 300e18;
        vm.prank(user2);
        treasury.contributeToPool(poolId, poolContribution);
        
        // User1 makes an investment pool contribution
        uint256 poolContribution2 = 200e18;
        vm.prank(user1);
        treasury.contributeToPool(poolId, poolContribution2);
        
        // Verify that both types of contributions are recorded in history
        ICommunityTreasury.Contribution[] memory history1 = treasury.contributionHistory(poolId, user1);
        assertEq(history1.length, 2); // Circle contribution + pool contribution
        assertEq(history1[0].amount, circleContribution);
        assertEq(history1[1].amount, poolContribution2);
        
        ICommunityTreasury.Contribution[] memory history2 = treasury.contributionHistory(poolId, user2);
        assertEq(history2.length, 1); // Pool contribution only
        assertEq(history2[0].amount, poolContribution);
        
        // Verify circle treasury balance (only from circle contributions)
        ICommunityTreasury.Circle memory circle = treasury.getCircle(poolId);
        assertEq(circle.treasuryBalance, circleContribution); // Only circle contributions count here
        
        // Verify investment pool totals (from investment pool contributions only)
        assertEq(treasury.poolTotalContributions(poolId), poolContribution + poolContribution2);
        assertEq(treasury.memberTotalContributions(poolId, user1), poolContribution2);
        assertEq(treasury.memberTotalContributions(poolId, user2), poolContribution);
        
        // Verify ownership shares based only on pool contributions
        // User1: 200/500 * 1e6 = 400000 ppm (40%)
        // User2: 300/500 * 1e6 = 600000 ppm (60%)
        assertEq(treasury.ownershipShare(poolId, user1), 400000);
        assertEq(treasury.ownershipShare(poolId, user2), 600000);
        
        // Verify yield distribution
        uint256 totalYield = 1000e18;
        assertEq(treasury.yieldDistribution(poolId, user1, totalYield), 400e18); // 40%
        assertEq(treasury.yieldDistribution(poolId, user2, totalYield), 600e18); // 60%
        
        // Verify total token balance in contract
        uint256 expectedTokenBalance = circleContribution + poolContribution + poolContribution2;
        assertEq(token.balanceOf(address(treasury)), expectedTokenBalance);
    }
    
    /**
     * Test that investment pool functionality preserves existing error handling.
     */
    function testInvestmentPoolErrorsIntegration() public {
        // Create a circle with user1
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        // Test: Non-member cannot contribute to investment pool
        vm.prank(user2); // user2 is not a member
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.NotMember.selector, user2, poolId));
        treasury.contributeToPool(poolId, 100e18);
        
        // Test: Zero amount investment pool contribution should revert
        vm.prank(user1);
        vm.expectRevert(ICommunityTreasury.ZeroAmount.selector);
        treasury.contributeToPool(poolId, 0);
        
        // Test: Investment pool functions work correctly for non-existent pool
        assertEq(treasury.ownershipShare(999, user1), 0);
        assertEq(treasury.yieldDistribution(999, user1, 1000e18), 0);
        assertEq(treasury.poolTotalContributions(999), 0);
        assertEq(treasury.memberTotalContributions(999, user1), 0);
    }
}