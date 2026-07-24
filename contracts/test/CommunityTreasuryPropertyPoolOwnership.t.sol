// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {ICommunityTreasury} from "../src/interfaces/ICommunityTreasury.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * **Property 19: Investment pool ownership share and yield are proportional and conserved**
 * **Validates: Requirements 7.1, 7.6**
 * 
 * This property test verifies that:
 * 1. Ownership shares are computed proportionally based on contributions (Req 7.1)
 * 2. Yield distribution is proportional to ownership shares (Req 7.6) 
 * 3. Total ownership shares sum to 1e6 (100% in ppm)
 * 4. Yield distribution sums to total yield (conservation)
 * 5. Ownership shares update correctly when new contributions are made
 */
contract CommunityTreasuryPropertyPoolOwnershipTest is Test {
    CommunityTreasury public treasury;
    MockERC20 public token;
    
    address public admin = makeAddr("admin");
    address[] public users;
    
    uint256 public constant MAX_USERS = 15;
    uint256 public constant MAX_CONTRIBUTION = 1000e18;  // Reduced to avoid allowance issues
    uint256 public constant INITIAL_BALANCE = 100000e18; // Increased initial balance
    uint256 public constant PPM_BASE = 1e6; // Parts per million base
    
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
     * **Property 19: Investment pool ownership share and yield proportionality**
     * Tests that ownership shares and yield distributions are proportional to contributions
     * and that the conservation properties hold across multiple contribution rounds.
     * **Validates: Requirements 7.1, 7.6**
     */
    function testProperty19_OwnershipShareAndYieldProportionality(
        uint8 numUsers,
        uint8 numRounds,
        uint256 yieldAmount,
        uint256 seed
    ) public {
        // Bound inputs to reasonable ranges
        numUsers = uint8(bound(numUsers, 2, MAX_USERS));
        numRounds = uint8(bound(numRounds, 1, 5));
        yieldAmount = bound(yieldAmount, 1, MAX_CONTRIBUTION);
        
        // Create pool with first user and add remaining users
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(numUsers, 51);
        
        for (uint256 i = 1; i < numUsers; i++) {
            vm.prank(users[i]);
            treasury.joinCircle(poolId);
        }
        
        // Track expected contributions for each user across rounds
        uint256[] memory userTotalContributions = new uint256[](numUsers);
        uint256 totalPoolContributions = 0;
        uint256 currentSeed = seed;
        
        // Execute multiple rounds of contributions
        for (uint256 round = 0; round < numRounds; round++) {
            // Each user makes a contribution in this round
            for (uint256 i = 0; i < numUsers; i++) {
                // Generate deterministic contribution amount using seed
                uint256 contribution = 1 + (currentSeed % MAX_CONTRIBUTION);
                currentSeed = uint256(keccak256(abi.encode(currentSeed, round, i)));
                
                // Make the contribution
                vm.prank(users[i]);
                treasury.contributeToPool(poolId, contribution);
                
                // Update tracking
                userTotalContributions[i] += contribution;
                totalPoolContributions += contribution;
            }
            
            // After each round, verify ownership shares and yield distribution
            _verifyOwnershipAndYieldProperties(
                poolId,
                numUsers,
                userTotalContributions,
                totalPoolContributions,
                yieldAmount
            );
        }
    }
    
    /**
     * Helper function to verify ownership and yield properties after contributions
     */
    function _verifyOwnershipAndYieldProperties(
        uint256 poolId,
        uint256 numUsers,
        uint256[] memory userTotalContributions,
        uint256 totalPoolContributions,
        uint256 yieldAmount
    ) private view {
        uint256 totalOwnershipShares = 0;
        uint256 totalYieldDistribution = 0;
        
        for (uint256 i = 0; i < numUsers; i++) {
            address user = users[i];
            
            // Get ownership share from contract
            uint256 ownershipShare = treasury.ownershipShare(poolId, user);
            
            // Calculate expected ownership share (in ppm)
            uint256 expectedOwnershipShare;
            if (totalPoolContributions == 0) {
                expectedOwnershipShare = 0;
            } else {
                expectedOwnershipShare = (userTotalContributions[i] * PPM_BASE) / totalPoolContributions;
            }
            
            // **Requirement 7.1 Validation: Ownership share proportional to contributions**
            assertEq(
                ownershipShare,
                expectedOwnershipShare,
                "Ownership share should be proportional to contributions"
            );
            
            // Verify individual contribution tracking matches
            assertEq(
                treasury.memberTotalContributions(poolId, user),
                userTotalContributions[i],
                "Member total contributions should match expected"
            );
            
            // Get yield distribution from contract
            uint256 userYieldDistribution = treasury.yieldDistribution(poolId, user, yieldAmount);
            
            // Calculate expected yield distribution
            uint256 expectedYieldDistribution;
            if (totalPoolContributions == 0 || yieldAmount == 0) {
                expectedYieldDistribution = 0;
            } else {
                expectedYieldDistribution = (userTotalContributions[i] * yieldAmount) / totalPoolContributions;
            }
            
            // **Requirement 7.6 Validation: Yield distribution proportional to ownership**
            assertEq(
                userYieldDistribution,
                expectedYieldDistribution,
                "Yield distribution should be proportional to ownership"
            );
            
            // Accumulate for conservation tests
            totalOwnershipShares += ownershipShare;
            totalYieldDistribution += userYieldDistribution;
        }
        
        // **Conservation Property 1: Ownership shares sum to 100% (1e6 ppm) when there are contributions**
        if (totalPoolContributions > 0) {
            // Allow for rounding errors due to integer division - up to numUsers wei
            uint256 tolerance = numUsers;
            assertApproxEqAbs(
                totalOwnershipShares,
                PPM_BASE,
                tolerance,
                "Total ownership shares should sum to 1e6 ppm (100%) within rounding tolerance"
            );
        } else {
            assertEq(
                totalOwnershipShares,
                0,
                "Total ownership shares should be 0 when no contributions"
            );
        }
        
        // **Conservation Property 2: Yield distributions sum to total yield**
        if (yieldAmount > 0 && totalPoolContributions > 0) {
            // Allow for rounding errors of up to numUsers wei due to integer division
            uint256 tolerance = numUsers;
            assertApproxEqAbs(
                totalYieldDistribution,
                yieldAmount,
                tolerance,
                "Total yield distribution should sum to total yield (within rounding tolerance)"
            );
        } else {
            assertEq(
                totalYieldDistribution,
                0,
                "Total yield distribution should be 0 when no yield or no contributions"
            );
        }
        
        // Verify pool totals match expected
        assertEq(
            treasury.poolTotalContributions(poolId),
            totalPoolContributions,
            "Pool total contributions should match expected"
        );
    }
    
    /**
     * Test edge case: single contributor owns 100%
     */
    function testProperty19_SingleContributorOwnsAll() public {
        // Create pool with one member
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(10, 51);
        
        uint256 contribution = 1000e18;
        vm.prank(users[0]);
        treasury.contributeToPool(poolId, contribution);
        
        // Single contributor should own 100% (1e6 ppm)
        assertEq(
            treasury.ownershipShare(poolId, users[0]),
            PPM_BASE,
            "Single contributor should own 100%"
        );
        
        // Should receive all yield
        uint256 totalYield = 500e18;
        assertEq(
            treasury.yieldDistribution(poolId, users[0], totalYield),
            totalYield,
            "Single contributor should receive all yield"
        );
    }
    
    /**
     * Test edge case: equal contributions result in equal shares
     */
    function testProperty19_EqualContributionsEqualShares(uint8 numUsers) public {
        numUsers = uint8(bound(numUsers, 2, 10));
        
        // Create pool and add users
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(numUsers, 51);
        
        for (uint256 i = 1; i < numUsers; i++) {
            vm.prank(users[i]);
            treasury.joinCircle(poolId);
        }
        
        // Each user contributes the same amount
        uint256 equalContribution = 1000e18;
        for (uint256 i = 0; i < numUsers; i++) {
            vm.prank(users[i]);
            treasury.contributeToPool(poolId, equalContribution);
        }
        
        // Calculate expected equal share
        uint256 expectedShare = PPM_BASE / numUsers;
        uint256 tolerance = 1; // Allow 1 ppm rounding error
        
        // Verify each user has approximately equal share
        for (uint256 i = 0; i < numUsers; i++) {
            uint256 actualShare = treasury.ownershipShare(poolId, users[i]);
            assertApproxEqAbs(
                actualShare,
                expectedShare,
                tolerance,
                "Equal contributions should result in approximately equal shares"
            );
        }
        
        // Test equal yield distribution
        uint256 totalYield = 1000e18;
        uint256 expectedYieldPerUser = totalYield / numUsers;
        uint256 yieldTolerance = numUsers; // Allow rounding error
        
        for (uint256 i = 0; i < numUsers; i++) {
            uint256 actualYield = treasury.yieldDistribution(poolId, users[i], totalYield);
            assertApproxEqAbs(
                actualYield,
                expectedYieldPerUser,
                yieldTolerance,
                "Equal shares should result in approximately equal yield"
            );
        }
    }
    
    /**
     * Test precision handling: very small and very large contributions
     */
    function testProperty19_PrecisionHandling() public {
        // Create pool with two members
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(10, 51);
        vm.prank(users[1]);
        treasury.joinCircle(poolId);
        
        // User0 makes very small contribution, User1 makes very large contribution
        uint256 smallContribution = 1; // 1 wei
        uint256 largeContribution = 1000e18; // Reduced from 1 million to avoid allowance issues
        
        vm.prank(users[0]);
        treasury.contributeToPool(poolId, smallContribution);
        vm.prank(users[1]);
        treasury.contributeToPool(poolId, largeContribution);
        
        uint256 totalContributions = smallContribution + largeContribution;
        
        // Calculate expected ownership shares
        uint256 expectedSmallShare = (smallContribution * PPM_BASE) / totalContributions;
        uint256 expectedLargeShare = (largeContribution * PPM_BASE) / totalContributions;
        
        // Verify ownership shares
        assertEq(
            treasury.ownershipShare(poolId, users[0]),
            expectedSmallShare,
            "Small contributor share should be calculated correctly"
        );
        assertEq(
            treasury.ownershipShare(poolId, users[1]),
            expectedLargeShare,
            "Large contributor share should be calculated correctly"
        );
        
        // Verify shares sum to 100%
        assertEq(
            treasury.ownershipShare(poolId, users[0]) + treasury.ownershipShare(poolId, users[1]),
            PPM_BASE,
            "Shares should sum to 100% even with extreme differences"
        );
        
        // Test yield distribution with large yield
        uint256 largeYield = 1000e18; // Reduced from 1 million
        uint256 expectedSmallYield = (smallContribution * largeYield) / totalContributions;
        uint256 expectedLargeYield = (largeContribution * largeYield) / totalContributions;
        
        assertEq(
            treasury.yieldDistribution(poolId, users[0], largeYield),
            expectedSmallYield,
            "Small contributor yield should be calculated correctly"
        );
        assertEq(
            treasury.yieldDistribution(poolId, users[1], largeYield),
            expectedLargeYield,
            "Large contributor yield should be calculated correctly"
        );
    }
    
    /**
     * Test dynamic ownership updates as new contributions are made
     */
    function testProperty19_DynamicOwnershipUpdates() public {
        // Create pool with three members
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(10, 51);
        vm.prank(users[1]);
        treasury.joinCircle(poolId);
        vm.prank(users[2]);
        treasury.joinCircle(poolId);
        
        // Initial contributions: User0=400, User1=400, User2=200 (total=1000)
        vm.prank(users[0]);
        treasury.contributeToPool(poolId, 400e18);
        vm.prank(users[1]);
        treasury.contributeToPool(poolId, 400e18);
        vm.prank(users[2]);
        treasury.contributeToPool(poolId, 200e18);
        
        // Verify initial ownership shares: 40%, 40%, 20%
        assertEq(treasury.ownershipShare(poolId, users[0]), 400000); // 40%
        assertEq(treasury.ownershipShare(poolId, users[1]), 400000); // 40%
        assertEq(treasury.ownershipShare(poolId, users[2]), 200000); // 20%
        
        // User2 makes large additional contribution: +800 (now has 1000 total)
        // New totals: User0=400, User1=400, User2=1000 (total=1800)
        vm.prank(users[2]);
        treasury.contributeToPool(poolId, 800e18);
        
        // Verify updated ownership shares: 22.22%, 22.22%, 55.56%
        uint256 expectedUser0Share = (400e18 * PPM_BASE) / 1800e18; // ~222222
        uint256 expectedUser1Share = (400e18 * PPM_BASE) / 1800e18; // ~222222  
        uint256 expectedUser2Share = (1000e18 * PPM_BASE) / 1800e18; // ~555555
        
        assertEq(treasury.ownershipShare(poolId, users[0]), expectedUser0Share);
        assertEq(treasury.ownershipShare(poolId, users[1]), expectedUser1Share);
        assertEq(treasury.ownershipShare(poolId, users[2]), expectedUser2Share);
        
        // Verify shares sum to 100% (with tolerance for rounding)
        uint256 totalShares = treasury.ownershipShare(poolId, users[0]) +
                              treasury.ownershipShare(poolId, users[1]) +
                              treasury.ownershipShare(poolId, users[2]);
        assertApproxEqAbs(totalShares, PPM_BASE, 3, "Shares should sum to 1e6 ppm within rounding tolerance");
        
        // Verify yield distribution updates accordingly
        uint256 testYield = 1800e18;
        uint256 user0Yield = treasury.yieldDistribution(poolId, users[0], testYield);
        uint256 user1Yield = treasury.yieldDistribution(poolId, users[1], testYield);
        uint256 user2Yield = treasury.yieldDistribution(poolId, users[2], testYield);
        
        // User yields should be proportional to their contributions
        assertEq(user0Yield, 400e18); // 400/1800 * 1800 = 400
        assertEq(user1Yield, 400e18); // 400/1800 * 1800 = 400
        assertEq(user2Yield, 1000e18); // 1000/1800 * 1800 = 1000
        
        // Verify yield conservation
        assertEq(user0Yield + user1Yield + user2Yield, testYield);
    }
    
    /**
     * Test zero contribution and zero yield edge cases
     */
    function testProperty19_ZeroContributionAndYieldEdgeCases() public {
        // Create pool with members
        vm.prank(users[0]);
        uint256 poolId = treasury.createCircle(10, 51);
        vm.prank(users[1]);
        treasury.joinCircle(poolId);
        
        // Test ownership shares with no contributions
        assertEq(treasury.ownershipShare(poolId, users[0]), 0);
        assertEq(treasury.ownershipShare(poolId, users[1]), 0);
        
        // Test yield distribution with no contributions
        assertEq(treasury.yieldDistribution(poolId, users[0], 1000e18), 0);
        assertEq(treasury.yieldDistribution(poolId, users[1], 1000e18), 0);
        
        // Add some contributions
        vm.prank(users[0]);
        treasury.contributeToPool(poolId, 500e18);
        
        // Test yield distribution with zero yield
        assertEq(treasury.yieldDistribution(poolId, users[0], 0), 0);
        assertEq(treasury.yieldDistribution(poolId, users[1], 0), 0);
        
        // Verify ownership shares work correctly with contributions
        assertEq(treasury.ownershipShare(poolId, users[0]), PPM_BASE); // 100%
        assertEq(treasury.ownershipShare(poolId, users[1]), 0); // 0%
    }
}