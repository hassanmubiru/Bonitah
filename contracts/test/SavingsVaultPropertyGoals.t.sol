// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {Registry} from "../src/Registry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ISavingsVault} from "../src/interfaces/ISavingsVault.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";

/// @title SavingsVaultPropertyGoalsTest
/// @notice Property-based tests for SavingsVault goal lifecycle.
/// @dev Validates Requirements 5.1, 5.2, 5.7 implementation using Foundry fuzz testing.
contract SavingsVaultPropertyGoalsTest is Test {
    SavingsVault public vault;
    Registry public registry;
    MockERC20 public token;
    
    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    
    uint256 public constant INITIAL_TOKEN_BALANCE = 100_000e18;
    
    function setUp() public {
        // Deploy mock ERC20 token
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
        
        // Register users
        vm.prank(user1);
        registry.register();
        
        vm.prank(user2);
        registry.register();
        
        // Mint tokens to users
        token.mint(user1, INITIAL_TOKEN_BALANCE);
        token.mint(user2, INITIAL_TOKEN_BALANCE);
        
        // Approve vault to spend tokens
        vm.prank(user1);
        token.approve(address(vault), type(uint256).max);
        vm.prank(user2);
        token.approve(address(vault), type(uint256).max);
    }
    
    /// @notice **Property 13: Goal lifecycle correctness**
    /// **Validates: Requirements 5.1, 5.2, 5.7**
    /// 
    /// This property verifies that goal lifecycle is correctly managed:
    /// 1. Goals can only be created with valid parameters (target amount > 0, target date > now)
    /// 2. Goal contributions correctly accumulate and affect available balance
    /// 3. Goals are marked complete when saved amount reaches or exceeds target
    /// 4. Multiple goals can coexist independently
    /// 5. Goal operations respect user isolation
    function testProperty13_GoalLifecycleCorrectness(
        uint256 _targetAmount1,
        uint256 _targetAmount2,
        uint256 _targetOffset1,
        uint256 _targetOffset2,
        uint256 _contrib1_1,
        uint256 _contrib1_2,
        uint256 _contrib2_1,
        uint256 _depositAmount
    ) public {
        // Bound parameters to valid ranges
        uint256 targetAmount1 = bound(_targetAmount1, 1e18, 10_000e18);
        uint256 targetAmount2 = bound(_targetAmount2, 1e18, 10_000e18);
        uint256 targetOffset1 = bound(_targetOffset1, 1, 365 days);
        uint256 targetOffset2 = bound(_targetOffset2, 1, 365 days);
        uint256 depositAmount = bound(_depositAmount, targetAmount1 + targetAmount2, INITIAL_TOKEN_BALANCE / 2);
        
        // Ensure user has sufficient funds
        vm.prank(user1);
        vault.deposit(depositAmount);
        
        // Create first goal
        uint256 targetDate1 = block.timestamp + targetOffset1;
        vm.prank(user1);
        vault.createGoal(targetAmount1, targetDate1);
        
        // Verify goal creation
        (uint256 id1, uint256 storedTarget1, uint256 storedDate1, uint256 saved1, bool completed1) = vault.goals(user1, 0);
        assertEq(id1, 0, "First goal should have ID 0");
        assertEq(storedTarget1, targetAmount1, "First goal target should match input");
        assertEq(storedDate1, targetDate1, "First goal date should match input");
        assertEq(saved1, 0, "First goal should start with zero savings");
        assertFalse(completed1, "First goal should not be completed initially");
        
        // Create second goal
        uint256 targetDate2 = block.timestamp + targetOffset2;
        vm.prank(user1);
        vault.createGoal(targetAmount2, targetDate2);
        
        // Verify second goal creation and independence
        (uint256 id2, uint256 storedTarget2, uint256 storedDate2, uint256 saved2, bool completed2) = vault.goals(user1, 1);
        assertEq(id2, 1, "Second goal should have ID 1");
        assertEq(storedTarget2, targetAmount2, "Second goal target should match input");
        assertEq(storedDate2, targetDate2, "Second goal date should match input");
        assertEq(saved2, 0, "Second goal should start with zero savings");
        assertFalse(completed2, "Second goal should not be completed initially");
        
        // First goal should remain unchanged
        (,,,saved1, completed1) = vault.goals(user1, 0);
        assertEq(saved1, 0, "First goal savings should be unchanged after second goal creation");
        assertFalse(completed1, "First goal completion should be unchanged after second goal creation");
        
        // Test contributions to first goal
        uint256 contrib1_1 = bound(_contrib1_1, 0, vault.availableBalance(user1) / 3);
        if (contrib1_1 > 0) {
            uint256 availableBefore = vault.availableBalance(user1);
            uint256 portfolioBefore = vault.portfolioValue(user1);
            
            vm.prank(user1);
            vault.contributeToGoal(0, contrib1_1);
            
            // Verify contribution effects
            (,,,saved1, completed1) = vault.goals(user1, 0);
            assertEq(saved1, contrib1_1, "First goal savings should equal contribution");
            assertEq(completed1, contrib1_1 >= targetAmount1, "First goal completion should match if target reached");
            
            // Verify balance effects
            assertEq(vault.availableBalance(user1), availableBefore - contrib1_1, "Available balance should decrease by contribution");
            assertEq(vault.portfolioValue(user1), portfolioBefore, "Portfolio value should remain unchanged");
            
            // Second goal should remain unchanged
            (,,,saved2, completed2) = vault.goals(user1, 1);
            assertEq(saved2, 0, "Second goal should be unchanged by first goal contribution");
            assertFalse(completed2, "Second goal completion should be unchanged");
        }
        
        // Test contributions to second goal
        uint256 contrib2_1 = bound(_contrib2_1, 0, vault.availableBalance(user1) / 2);
        if (contrib2_1 > 0) {
            uint256 availableBefore = vault.availableBalance(user1);
            
            vm.prank(user1);
            vault.contributeToGoal(1, contrib2_1);
            
            // Verify contribution effects
            (,,,saved2, completed2) = vault.goals(user1, 1);
            assertEq(saved2, contrib2_1, "Second goal savings should equal contribution");
            assertEq(completed2, contrib2_1 >= targetAmount2, "Second goal completion should match if target reached");
            
            // Verify balance effects
            assertEq(vault.availableBalance(user1), availableBefore - contrib2_1, "Available balance should decrease by contribution");
            
            // First goal should remain unchanged
            (,,,uint256 currentSaved1,) = vault.goals(user1, 0);
            assertEq(currentSaved1, contrib1_1, "First goal should be unchanged by second goal contribution");
        }
        
        // Test additional contribution to first goal
        uint256 contrib1_2 = bound(_contrib1_2, 0, vault.availableBalance(user1));
        if (contrib1_2 > 0) {
            (,,,uint256 savedBefore,) = vault.goals(user1, 0);
            
            vm.prank(user1);
            vault.contributeToGoal(0, contrib1_2);
            
            // Verify accumulated contributions
            (,,,saved1, completed1) = vault.goals(user1, 0);
            assertEq(saved1, savedBefore + contrib1_2, "Goal savings should accumulate correctly");
            assertEq(completed1, saved1 >= targetAmount1, "Goal completion should reflect total savings");
        }
        
        // Test user isolation - user2 goals should not affect user1
        vm.prank(user2);
        vault.deposit(1000e18);
        
        vm.prank(user2);
        vault.createGoal(500e18, block.timestamp + 30 days);
        
        vm.prank(user2);
        vault.contributeToGoal(0, 100e18);
        
        // User1 goals should be unchanged
        (,,,uint256 finalSaved1, bool finalCompleted1) = vault.goals(user1, 0);
        (,,,uint256 finalSaved2, bool finalCompleted2) = vault.goals(user1, 1);
        
        assertEq(finalSaved1, contrib1_1 + contrib1_2, "User1 first goal should be unchanged by user2 operations");
        assertEq(finalSaved2, contrib2_1, "User1 second goal should be unchanged by user2 operations");
    }
    
    /// @notice Test goal completion event emission and state transitions
    function testProperty13_GoalCompletionTransitions(
        uint256 _targetAmount,
        uint256 _initialContrib,
        uint256 _finalContrib
    ) public {
        uint256 targetAmount = bound(_targetAmount, 1e18, 1000e18);
        uint256 depositAmount = targetAmount * 2;
        
        // Setup
        vm.prank(user1);
        vault.deposit(depositAmount);
        
        vm.prank(user1);
        vault.createGoal(targetAmount, block.timestamp + 30 days);
        
        // Initial contribution (should not complete goal)
        uint256 initialContrib = bound(_initialContrib, 1, targetAmount - 1);
        
        vm.prank(user1);
        vault.contributeToGoal(0, initialContrib);
        
        (,,,uint256 saved, bool completed) = vault.goals(user1, 0);
        assertEq(saved, initialContrib, "Initial contribution should be recorded");
        assertFalse(completed, "Goal should not be completed with partial contribution");
        
        // Final contribution (should complete goal)
        uint256 finalContrib = bound(_finalContrib, targetAmount - initialContrib, depositAmount - initialContrib);
        
        // Expect GoalCompleted event
        vm.expectEmit(true, true, false, false);
        emit GoalCompleted(user1, 0);
        
        vm.prank(user1);
        vault.contributeToGoal(0, finalContrib);
        
        (,,,saved, completed) = vault.goals(user1, 0);
        assertEq(saved, initialContrib + finalContrib, "Final savings should accumulate correctly");
        assertTrue(completed, "Goal should be completed when target reached");
    }
    
    /// @notice Test invalid goal parameters rejection
    function testProperty13_InvalidGoalParametersReject(
        uint256 _targetAmount,
        uint256 _targetOffset,
        bool _zeroAmount,
        bool _pastDate
    ) public {
        uint256 targetAmount = _zeroAmount ? 0 : bound(_targetAmount, 1, 1000e18);
        
        uint256 targetDate;
        if (_pastDate && block.timestamp > 1) {
            // Ensure we can subtract safely and max is greater than min
            uint256 maxOffset = block.timestamp > 365 days ? 365 days : block.timestamp - 1;
            targetDate = block.timestamp - bound(_targetOffset, 1, maxOffset);
        } else {
            targetDate = block.timestamp + bound(_targetOffset, 1, 365 days);
        }
        
        // Deposit funds
        vm.prank(user1);
        vault.deposit(1000e18);
        
        if (_zeroAmount || _pastDate || targetDate <= block.timestamp) {
            // Should revert with InvalidGoalParams
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidGoalParams.selector));
            vm.prank(user1);
            vault.createGoal(targetAmount, targetDate);
        } else {
            // Should succeed
            vm.prank(user1);
            vault.createGoal(targetAmount, targetDate);
            
            (uint256 id, uint256 storedTarget, uint256 storedDate, uint256 saved, bool completed) = vault.goals(user1, 0);
            assertEq(id, 0, "Goal should be created with correct ID");
            assertEq(storedTarget, targetAmount, "Target should be stored correctly");
            assertEq(storedDate, targetDate, "Date should be stored correctly");
            assertEq(saved, 0, "Initial savings should be zero");
            assertFalse(completed, "Initial completion should be false");
        }
    }
    
    /// @notice Test goal contribution edge cases
    function testProperty13_GoalContributionEdgeCases(
        uint256 _goalIndex,
        uint256 _contribAmount
    ) public {
        // Setup
        vm.prank(user1);
        vault.deposit(1000e18);
        
        vm.prank(user1);
        vault.createGoal(500e18, block.timestamp + 30 days);
        
        uint256 goalIndex = bound(_goalIndex, 0, 10); // Test both valid and invalid indices
        uint256 contribAmount = bound(_contribAmount, 0, 2000e18); // Test both valid and excessive amounts
        
        if (goalIndex > 0) {
            // Invalid goal ID should revert with InvalidGoalParams
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidGoalParams.selector));
            vm.prank(user1);
            vault.contributeToGoal(goalIndex, 100e18);
        } else if (contribAmount == 0) {
            // Zero contribution should revert with ZeroAmount
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
            vm.prank(user1);
            vault.contributeToGoal(0, contribAmount);
        } else if (contribAmount > vault.availableBalance(user1)) {
            // Excessive contribution should revert with InsufficientAvailableBalance
            vm.expectRevert(abi.encodeWithSelector(
                ISavingsVault.InsufficientAvailableBalance.selector,
                contribAmount,
                vault.availableBalance(user1)
            ));
            vm.prank(user1);
            vault.contributeToGoal(0, contribAmount);
        } else {
            // Valid contribution should succeed
            (,,,uint256 savedBefore,) = vault.goals(user1, 0);
            
            vm.prank(user1);
            vault.contributeToGoal(0, contribAmount);
            
            (,,,uint256 savedAfter,) = vault.goals(user1, 0);
            assertEq(savedAfter, savedBefore + contribAmount, "Contribution should be added to goal savings");
        }
    }
    
    /// @notice Test multiple goals lifecycle with various completion patterns
    function testProperty13_MultipleGoalsLifecycle(uint256 _numGoals, uint256 _seed) public {
        uint256 numGoals = bound(_numGoals, 1, 5);
        
        // Setup with large deposit
        vm.prank(user1);
        vault.deposit(50_000e18);
        
        // Create multiple goals with different targets
        uint256[] memory targetAmounts = new uint256[](numGoals);
        for (uint256 i = 0; i < numGoals; i++) {
            uint256 target = bound(uint256(keccak256(abi.encode(_seed, i))), 100e18, 1000e18);
            targetAmounts[i] = target;
            
            vm.prank(user1);
            vault.createGoal(target, block.timestamp + 30 days + i * 1 days);
            
            // Verify goal creation
            (uint256 id, uint256 storedTarget,,,) = vault.goals(user1, i);
            assertEq(id, i, "Goal ID should match creation order");
            assertEq(storedTarget, target, "Goal target should be stored correctly");
        }
        
        // Make contributions to goals in random order
        for (uint256 i = 0; i < numGoals * 2; i++) {
            uint256 goalIndex = uint256(keccak256(abi.encode(_seed, "contrib", i))) % numGoals;
            uint256 amount = bound(uint256(keccak256(abi.encode(_seed, "amount", i))), 10e18, 200e18);
            
            if (vault.availableBalance(user1) >= amount) {
                (,,,uint256 savedBefore,) = vault.goals(user1, goalIndex);
                (,,,, bool completedBefore) = vault.goals(user1, goalIndex);
                
                vm.prank(user1);
                vault.contributeToGoal(goalIndex, amount);
                
                (,,,uint256 savedAfter, bool completedAfter) = vault.goals(user1, goalIndex);
                assertEq(savedAfter, savedBefore + amount, "Goal savings should increase by contribution");
                
                // Check completion logic
                if (savedAfter >= targetAmounts[goalIndex] && !completedBefore) {
                    assertTrue(completedAfter, "Goal should be marked completed when target reached");
                }
            }
        }
        
        // Verify final state consistency
        uint256 totalGoalSavings = 0;
        for (uint256 i = 0; i < numGoals; i++) {
            (,,,uint256 saved, bool completed) = vault.goals(user1, i);
            totalGoalSavings += saved;
            
            // Completion should match savings vs target
            if (saved >= targetAmounts[i]) {
                assertTrue(completed, "Goals with sufficient savings should be completed");
            }
        }
        
        // Portfolio value should include all goal savings
        uint256 expectedPortfolio = vault.depositedBalance(user1) + totalGoalSavings;
        assertEq(vault.portfolioValue(user1), expectedPortfolio, "Portfolio should include all goal savings");
    }
    
    event GoalCompleted(address indexed user, uint256 indexed goalId);
}