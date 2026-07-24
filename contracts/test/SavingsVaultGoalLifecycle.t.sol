// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {Registry} from "../src/Registry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ISavingsVault} from "../src/interfaces/ISavingsVault.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";

/// @title SavingsVaultGoalLifecycleTest
/// @notice Comprehensive property-based tests for SavingsVault goal lifecycle functionality.
/// @dev Task 4.5: Property 13 - Goal lifecycle correctness
/// Validates Requirements 5.1, 5.2, 5.7 with minimum 100 iterations via Foundry fuzz testing.
///
/// This test suite validates:
/// 1. Goal creation correctness (valid parameters, event emission, state initialization)
/// 2. Goal contribution mechanics (accumulation, balance effects, user isolation)
/// 3. Goal completion detection and event emission
/// 4. Goal state transitions throughout the lifecycle
/// 5. Goal target achievement validation and edge cases
contract SavingsVaultGoalLifecycleTest is Test {
    SavingsVault public vault;
    Registry public registry;
    MockERC20 public token;
    
    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    
    uint256 public constant INITIAL_TOKEN_BALANCE = 1_000_000e18;
    uint256 public constant MAX_GOALS_PER_TEST = 10;
    
    // Events from ISavingsVault
    event GoalCreated(address indexed user, uint256 indexed goalId, uint256 targetAmount, uint256 targetDate);
    event GoalCompleted(address indexed user, uint256 indexed goalId);
    
    function setUp() public {
        // Deploy mock ERC20 token with 18 decimals
        token = new MockERC20("Test Token", "TEST", 18);
        
        // Deploy Registry proxy
        Registry registryImpl = new Registry();
        bytes memory registryData = abi.encodeCall(Registry.initialize, admin);
        ERC1967Proxy registryProxy = new ERC1967Proxy(address(registryImpl), registryData);
        registry = Registry(address(registryProxy));
        
        // Deploy SavingsVault proxy
        SavingsVault vaultImpl = new SavingsVault();
        bytes memory vaultData = abi.encodeCall(
            SavingsVault.initialize,
            (address(token), address(registry), admin)
        );
        ERC1967Proxy vaultProxy = new ERC1967Proxy(address(vaultImpl), vaultData);
        vault = SavingsVault(address(vaultProxy));
        
        // Register all test users
        vm.prank(user1);
        registry.register();
        
        vm.prank(user2);
        registry.register();
        
        vm.prank(user3);
        registry.register();
        
        // Mint tokens to users and approve vault spending
        address[3] memory users = [user1, user2, user3];
        for (uint256 i = 0; i < users.length; i++) {
            token.mint(users[i], INITIAL_TOKEN_BALANCE);
            vm.prank(users[i]);
            token.approve(address(vault), type(uint256).max);
        }
    }
    
    /// @notice **Property 13: Goal lifecycle correctness**
    /// **Validates: Requirements 5.1, 5.2, 5.7**
    ///
    /// This comprehensive property test validates the complete goal lifecycle:
    /// - Goal creation with valid parameters (Req 5.1, 5.7)
    /// - Goal contribution accumulation and balance effects (Req 5.2)
    /// - Goal completion detection when target is reached (Req 5.2)
    /// - State consistency throughout all lifecycle phases
    /// - User isolation and multi-goal independence
    function testProperty13_ComprehensiveGoalLifecycle(
        uint256 _numGoals,
        uint256 _depositSeed,
        uint256 _targetSeed,
        uint256 _contributionSeed,
        uint256 _timeSeed
    ) public {
        // Bound to reasonable ranges for comprehensive testing
        uint256 numGoals = bound(_numGoals, 1, MAX_GOALS_PER_TEST);
        
        // Calculate total deposit needed for all goals plus buffer
        uint256 totalTargetNeeded = 0;
        uint256[] memory targetAmounts = new uint256[](numGoals);
        uint256[] memory targetDates = new uint256[](numGoals);
        
        // Pre-calculate goal parameters to ensure we have sufficient funds
        for (uint256 i = 0; i < numGoals; i++) {
            targetAmounts[i] = bound(
                uint256(keccak256(abi.encode(_targetSeed, i))), 
                1e18,    // Minimum 1 token
                10_000e18 // Maximum 10,000 tokens per goal
            );
            totalTargetNeeded += targetAmounts[i];
            
            targetDates[i] = block.timestamp + bound(
                uint256(keccak256(abi.encode(_timeSeed, i))),
                1,        // At least 1 second in future
                365 days  // Up to 1 year in future
            );
        }
        
        // Ensure user has sufficient funds (2x target to allow for over-contribution testing)
        uint256 depositAmount = bound(_depositSeed, totalTargetNeeded * 2, INITIAL_TOKEN_BALANCE);
        
        vm.prank(user1);
        vault.deposit(depositAmount);
        
        // Phase 1: Goal Creation and Validation
        uint256[] memory goalIds = new uint256[](numGoals);
        for (uint256 i = 0; i < numGoals; i++) {
            uint256 expectedGoalId = vault.nextGoalId(user1);
            
            // Expect GoalCreated event
            vm.expectEmit(true, true, false, true);
            emit GoalCreated(user1, expectedGoalId, targetAmounts[i], targetDates[i]);
            
            vm.prank(user1);
            vault.createGoal(targetAmounts[i], targetDates[i]);
            
            goalIds[i] = expectedGoalId;
            
            // Validate goal creation (Req 5.1, 5.7)
            (uint256 id, uint256 target, uint256 date, uint256 saved, bool completed) = vault.goals(user1, expectedGoalId);
            assertEq(id, expectedGoalId, "Goal ID should match expected value");
            assertEq(target, targetAmounts[i], "Target amount should be stored correctly");
            assertEq(date, targetDates[i], "Target date should be stored correctly");
            assertEq(saved, 0, "Initial saved amount should be zero");
            assertFalse(completed, "Goal should not be completed initially");
            
            // Verify nextGoalId incremented
            assertEq(vault.nextGoalId(user1), expectedGoalId + 1, "nextGoalId should increment after goal creation");
        }
        
        // Phase 2: Goal Contribution Mechanics Testing (Req 5.2)
        uint256 totalContributed = 0;
        uint256[] memory goalSavings = new uint256[](numGoals);
        bool[] memory goalCompleted = new bool[](numGoals);
        
        // Make multiple rounds of contributions to test accumulation
        uint256 contributionRounds = bound(_contributionSeed, 1, 20);
        for (uint256 round = 0; round < contributionRounds; round++) {
            uint256 availableBefore = vault.availableBalance(user1);
            if (availableBefore == 0) break; // No more funds to contribute
            
            // Select random goal for this contribution
            uint256 goalIndex = uint256(keccak256(abi.encode(_contributionSeed, round))) % numGoals;
            uint256 contributionAmount = bound(
                uint256(keccak256(abi.encode(_contributionSeed, round, "amount"))),
                1,
                availableBefore / (contributionRounds - round + 1) // Distribute remaining funds
            );
            
            if (contributionAmount == 0) continue;
            
            uint256 portfolioBefore = vault.portfolioValue(user1);
            uint256 depositedBefore = vault.depositedBalance(user1);
            
            // Check if this contribution will complete the goal
            bool willComplete = !goalCompleted[goalIndex] && 
                               (goalSavings[goalIndex] + contributionAmount >= targetAmounts[goalIndex]);
            
            if (willComplete) {
                // Expect GoalCompleted event
                vm.expectEmit(true, true, false, false);
                emit GoalCompleted(user1, goalIds[goalIndex]);
            }
            
            vm.prank(user1);
            vault.contributeToGoal(goalIds[goalIndex], contributionAmount);
            
            // Update tracking variables
            goalSavings[goalIndex] += contributionAmount;
            totalContributed += contributionAmount;
            if (willComplete) {
                goalCompleted[goalIndex] = true;
            }
            
            // Validate contribution effects (Req 5.2)
            (,, , uint256 saved, bool completed) = vault.goals(user1, goalIds[goalIndex]);
            assertEq(saved, goalSavings[goalIndex], "Goal savings should accumulate correctly");
            assertEq(completed, goalCompleted[goalIndex], "Goal completion state should be correct");
            
            // Validate balance effects
            assertEq(vault.availableBalance(user1), availableBefore - contributionAmount, 
                    "Available balance should decrease by contribution amount");
            assertEq(vault.depositedBalance(user1), depositedBefore - contributionAmount,
                    "Deposited balance should decrease by contribution amount");
            assertEq(vault.portfolioValue(user1), portfolioBefore,
                    "Portfolio value should remain constant during goal contributions");
        }
        
        // Phase 3: State Consistency Validation
        uint256 calculatedPortfolio = vault.depositedBalance(user1);
        for (uint256 i = 0; i < numGoals; i++) {
            (,,,uint256 saved, bool completed) = vault.goals(user1, goalIds[i]);
            calculatedPortfolio += saved;
            
            // Validate completion logic
            bool shouldBeCompleted = saved >= targetAmounts[i];
            assertEq(completed, shouldBeCompleted, 
                    "Goal completion should match whether saved amount meets target");
        }
        
        assertEq(vault.portfolioValue(user1), calculatedPortfolio,
                "Portfolio value should equal deposited balance plus all goal savings");
        
        // Phase 4: User Isolation Testing
        // Create goals for user2 to ensure user1's goals remain unaffected
        vm.prank(user2);
        vault.deposit(1000e18);
        
        vm.prank(user2);
        vault.createGoal(500e18, block.timestamp + 30 days);
        
        vm.prank(user2);
        vault.contributeToGoal(0, 100e18);
        
        // Verify user1's goals are unchanged
        for (uint256 i = 0; i < numGoals; i++) {
            (,,,uint256 saved, bool completed) = vault.goals(user1, goalIds[i]);
            assertEq(saved, goalSavings[i], "User1 goal savings should be unchanged by user2 operations");
            assertEq(completed, goalCompleted[i], "User1 goal completion should be unchanged by user2 operations");
        }
        
        // Phase 5: Edge Case Testing
        // Test contribution to completed goals (should still work)
        for (uint256 i = 0; i < numGoals; i++) {
            if (goalCompleted[i] && vault.availableBalance(user1) > 0) {
                uint256 extraContrib = bound(
                    uint256(keccak256(abi.encode("extra", i))),
                    1,
                    vault.availableBalance(user1)
                );
                
                (,,,uint256 savedBefore,) = vault.goals(user1, goalIds[i]);
                
                vm.prank(user1);
                vault.contributeToGoal(goalIds[i], extraContrib);
                
                (,,,uint256 savedAfter, bool stillCompleted) = vault.goals(user1, goalIds[i]);
                assertEq(savedAfter, savedBefore + extraContrib, 
                        "Should be able to contribute to completed goals");
                assertTrue(stillCompleted, "Completed goals should remain completed");
                
                break; // Only test one to avoid running out of funds
            }
        }
    }
    
    /// @notice Test goal creation parameter validation (Req 5.1, 5.7)
    function testProperty13_GoalCreationParameterValidation(
        uint256 _targetAmount,
        uint256 _timeOffset,
        bool _useZeroAmount,
        bool _usePastDate
    ) public {
        // Setup user with funds
        vm.prank(user1);
        vault.deposit(10_000e18);
        
        uint256 targetAmount = _useZeroAmount ? 0 : bound(_targetAmount, 1, 10_000e18);
        
        uint256 targetDate;
        if (_usePastDate && block.timestamp > 1) {
            // Create a past date
            uint256 pastOffset = bound(_timeOffset, 1, min(block.timestamp - 1, 365 days));
            targetDate = block.timestamp - pastOffset;
        } else {
            // Create a future date
            uint256 futureOffset = bound(_timeOffset, 1, 365 days);
            targetDate = block.timestamp + futureOffset;
        }
        
        if (_useZeroAmount || (_usePastDate && targetDate <= block.timestamp)) {
            // Should revert with InvalidGoalParams (Req 5.7)
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidGoalParams.selector));
            vm.prank(user1);
            vault.createGoal(targetAmount, targetDate);
        } else {
            // Should succeed and emit GoalCreated event (Req 5.1)
            uint256 expectedId = vault.nextGoalId(user1);
            
            vm.expectEmit(true, true, false, true);
            emit GoalCreated(user1, expectedId, targetAmount, targetDate);
            
            vm.prank(user1);
            vault.createGoal(targetAmount, targetDate);
            
            // Validate storage
            (uint256 id, uint256 target, uint256 date, uint256 saved, bool completed) = vault.goals(user1, expectedId);
            assertEq(id, expectedId, "Goal ID should match");
            assertEq(target, targetAmount, "Target amount should be stored");
            assertEq(date, targetDate, "Target date should be stored");
            assertEq(saved, 0, "Initial saved amount should be zero");
            assertFalse(completed, "Goal should not be completed initially");
        }
    }
    
    /// @notice Test goal contribution validation and edge cases (Req 5.2)
    function testProperty13_GoalContributionValidation(
        uint256 _goalId,
        uint256 _contributionAmount,
        bool _useInvalidGoal,
        bool _useZeroContribution
    ) public {
        // Setup
        vm.prank(user1);
        vault.deposit(10_000e18);
        
        vm.prank(user1);
        vault.createGoal(1000e18, block.timestamp + 30 days);
        
        uint256 goalId = _useInvalidGoal ? bound(_goalId, 1, 100) : 0; // Use invalid or valid goal ID
        uint256 contributionAmount = _useZeroContribution ? 0 : 
                                   bound(_contributionAmount, 1, vault.availableBalance(user1) + 1000e18);
        
        if (_useZeroContribution) {
            // Zero contribution should revert
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
            vm.prank(user1);
            vault.contributeToGoal(goalId, contributionAmount);
        } else if (_useInvalidGoal) {
            // Invalid goal ID should revert
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidGoalParams.selector));
            vm.prank(user1);
            vault.contributeToGoal(goalId, 100e18);
        } else if (contributionAmount > vault.availableBalance(user1)) {
            // Insufficient balance should revert
            vm.expectRevert(abi.encodeWithSelector(
                ISavingsVault.InsufficientAvailableBalance.selector,
                contributionAmount,
                vault.availableBalance(user1)
            ));
            vm.prank(user1);
            vault.contributeToGoal(goalId, contributionAmount);
        } else {
            // Valid contribution should succeed
            (,,,uint256 savedBefore,) = vault.goals(user1, 0);
            uint256 availableBefore = vault.availableBalance(user1);
            
            // Check if contribution will complete goal
            bool willComplete = savedBefore + contributionAmount >= 1000e18;
            if (willComplete) {
                vm.expectEmit(true, true, false, false);
                emit GoalCompleted(user1, 0);
            }
            
            vm.prank(user1);
            vault.contributeToGoal(goalId, contributionAmount);
            
            // Validate effects
            (,,,uint256 savedAfter, bool completed) = vault.goals(user1, 0);
            assertEq(savedAfter, savedBefore + contributionAmount, "Contribution should be added");
            assertEq(vault.availableBalance(user1), availableBefore - contributionAmount, "Available balance should decrease");
            assertEq(completed, willComplete, "Completion state should be correct");
        }
    }
    
    /// @notice Test goal completion transitions and event emission (Req 5.2)
    function testProperty13_GoalCompletionTransitions(
        uint256 _targetAmount,
        uint256 _numContributions
    ) public {
        uint256 targetAmount = bound(_targetAmount, 100e18, 1000e18);
        uint256 numContributions = bound(_numContributions, 2, 10);
        
        // Setup
        vm.prank(user1);
        vault.deposit(targetAmount * 3); // Ensure sufficient funds
        
        vm.prank(user1);
        vault.createGoal(targetAmount, block.timestamp + 30 days);
        
        // Make contributions that gradually approach the target
        uint256 totalContributed = 0;
        bool goalCompleted = false;
        
        for (uint256 i = 0; i < numContributions && totalContributed < targetAmount; i++) {
            uint256 remaining = targetAmount - totalContributed;
            if (remaining == 0) break;
            
            uint256 maxContribution = i == numContributions - 1 ? remaining : remaining / 2;
            if (maxContribution == 0) maxContribution = remaining;
            
            uint256 contribution = bound(
                uint256(keccak256(abi.encode("contrib", i))),
                1,
                min(maxContribution, vault.availableBalance(user1))
            );
            
            if (contribution == 0 || contribution > vault.availableBalance(user1)) break;
            
            bool willComplete = !goalCompleted && (totalContributed + contribution >= targetAmount);
            
            if (willComplete) {
                vm.expectEmit(true, true, false, false);
                emit GoalCompleted(user1, 0);
                goalCompleted = true;
            }
            
            vm.prank(user1);
            vault.contributeToGoal(0, contribution);
            
            totalContributed += contribution;
            
            (,,,uint256 saved, bool completed) = vault.goals(user1, 0);
            assertEq(saved, totalContributed, "Saved amount should accumulate");
            assertEq(completed, goalCompleted, "Completion state should be correct");
            assertEq(completed, saved >= targetAmount, "Completion should match savings vs target");
        }
    }
    
    /// @notice Test multiple simultaneous goals lifecycle independence
    function testProperty13_MultipleGoalsIndependence(uint256 _seed) public {
        // Setup with multiple goals
        vm.prank(user1);
        vault.deposit(50_000e18);
        
        uint256 numGoals = 5;
        uint256[] memory targets = new uint256[](numGoals);
        uint256[] memory savings = new uint256[](numGoals);
        bool[] memory completed = new bool[](numGoals);
        
        // Create goals with different targets
        for (uint256 i = 0; i < numGoals; i++) {
            targets[i] = bound(uint256(keccak256(abi.encode(_seed, i))), 1000e18, 5000e18);
            
            vm.prank(user1);
            vault.createGoal(targets[i], block.timestamp + (i + 1) * 7 days);
        }
        
        // Make random contributions to random goals
        for (uint256 round = 0; round < 50; round++) {
            uint256 availableBalance = vault.availableBalance(user1);
            if (availableBalance == 0) break;
            
            uint256 goalIndex = uint256(keccak256(abi.encode(_seed, round))) % numGoals;
            uint256 contribution = bound(
                uint256(keccak256(abi.encode(_seed, round, "amount"))),
                1,
                min(availableBalance, 500e18)
            );
            
            bool willComplete = !completed[goalIndex] && (savings[goalIndex] + contribution >= targets[goalIndex]);
            
            if (willComplete) {
                vm.expectEmit(true, true, false, false);
                emit GoalCompleted(user1, goalIndex);
                completed[goalIndex] = true;
            }
            
            vm.prank(user1);
            vault.contributeToGoal(goalIndex, contribution);
            
            savings[goalIndex] += contribution;
            
            // Validate this goal
            (,,,uint256 actualSaved, bool actualCompleted) = vault.goals(user1, goalIndex);
            assertEq(actualSaved, savings[goalIndex], "Goal savings should match contribution");
            assertEq(actualCompleted, completed[goalIndex], "Goal completion should be correct");
            
            // Validate other goals remain unchanged
            for (uint256 j = 0; j < numGoals; j++) {
                if (j != goalIndex) {
                    (,,,uint256 otherSaved, bool otherCompleted) = vault.goals(user1, j);
                    assertEq(otherSaved, savings[j], "Other goals should be unaffected");
                    assertEq(otherCompleted, completed[j], "Other goal completion should be unchanged");
                }
            }
        }
    }
    
    /// @notice Helper function to get minimum of two values
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}