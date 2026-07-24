// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {Registry} from "../src/Registry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {SavingsVaultReentrancyAttacker} from "./mocks/SavingsVaultReentrancyAttacker.sol";
import {ISavingsVault} from "../src/interfaces/ISavingsVault.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";

/// @title SavingsVaultTask4_7Test
/// @notice Unit, event, revert, and reentrancy tests for SavingsVault per Task 4.7
/// @dev Validates Requirements 4.6, 13.2, 13.3, 13.4, 13.5, 15.1, 15.2, 15.3
contract SavingsVaultTask4_7Test is Test {
    SavingsVault public vault;
    Registry public registry;
    MockERC20 public token;
    SavingsVaultReentrancyAttacker public attacker;
    
    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public unregistered = makeAddr("unregistered");
    
    uint256 public constant INITIAL_BALANCE = 100_000e18;
    uint256 public constant DEPOSIT_AMOUNT = 1_000e18;
    uint256 public constant WITHDRAW_AMOUNT = 500e18;
    uint256 public constant GOAL_TARGET = 2_000e18;
    uint256 public constant LOCK_AMOUNT = 300e18;
    uint256 public constant LOCK_DURATION = 7 days;
    
    // All events from ISavingsVault interface
    event DepositMade(address indexed user, uint256 amount);
    event WithdrawalMade(address indexed user, uint256 amount);
    event GoalCreated(address indexed user, uint256 indexed goalId, uint256 targetAmount, uint256 targetDate);
    event GoalCompleted(address indexed user, uint256 indexed goalId);
    event FundsLocked(address indexed user, uint256 indexed lockId, uint256 amount, uint256 expiry);
    event LockReleased(address indexed user, uint256 indexed lockId, uint256 amount);

    function setUp() public {
        // Deploy mock token
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
        
        // Deploy reentrancy attacker
        attacker = new SavingsVaultReentrancyAttacker(vault, token);
        
        // Mint tokens to test accounts
        token.mint(user1, INITIAL_BALANCE);
        token.mint(user2, INITIAL_BALANCE);
        token.mint(unregistered, INITIAL_BALANCE);
        token.mint(address(attacker), INITIAL_BALANCE);
        
        // Register test users (except unregistered)
        vm.prank(user1);
        registry.register();
        
        vm.prank(user2);
        registry.register();
        
        vm.prank(address(attacker));
        registry.register();
        
        // Approve vault to spend tokens
        vm.prank(user1);
        token.approve(address(vault), type(uint256).max);
        
        vm.prank(user2);
        token.approve(address(vault), type(uint256).max);
        
        vm.prank(unregistered);
        token.approve(address(vault), type(uint256).max);
        
        // Setup attacker with token approvals
        attacker.setup(type(uint256).max);
    }

    // ================================================================================
    // EVENT ASSERTION TESTS (Req 13.2, 13.3, 13.4, 13.5)
    // ================================================================================
    
    /// @notice Test DepositMade event emission with correct args (Req 13.2)
    function testDepositEventEmission() public {
        vm.expectEmit(true, false, false, true, address(vault));
        emit DepositMade(user1, DEPOSIT_AMOUNT);
        
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        // Verify state change occurred
        assertEq(vault.depositedBalance(user1), DEPOSIT_AMOUNT);
    }
    
    /// @notice Test WithdrawalMade event emission with correct args (Req 13.3)
    function testWithdrawEventEmission() public {
        // First deposit to have balance
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        vm.expectEmit(true, false, false, true, address(vault));
        emit WithdrawalMade(user1, WITHDRAW_AMOUNT);
        
        vm.prank(user1);
        vault.withdraw(WITHDRAW_AMOUNT);
        
        // Verify state change occurred
        assertEq(vault.depositedBalance(user1), DEPOSIT_AMOUNT - WITHDRAW_AMOUNT);
    }
    
    /// @notice Test GoalCreated event emission with correct args (Req 13.4)
    function testGoalCreatedEventEmission() public {
        uint256 targetDate = block.timestamp + 30 days;
        
        vm.expectEmit(true, true, false, true, address(vault));
        emit GoalCreated(user1, 0, GOAL_TARGET, targetDate);
        
        vm.prank(user1);
        vault.createGoal(GOAL_TARGET, targetDate);
        
        // Verify goal was created correctly
        (uint256 id, uint256 target, uint256 date, uint256 saved, bool completed) = vault.goals(user1, 0);
        assertEq(id, 0);
        assertEq(target, GOAL_TARGET);
        assertEq(date, targetDate);
        assertEq(saved, 0);
        assertFalse(completed);
    }
    
    /// @notice Test GoalCompleted event emission when goal reaches target (Req 13.5)
    function testGoalCompletedEventEmission() public {
        uint256 targetDate = block.timestamp + 30 days;
        
        // Deposit and create goal
        vm.prank(user1);
        vault.deposit(GOAL_TARGET);
        
        vm.prank(user1);
        vault.createGoal(GOAL_TARGET, targetDate);
        
        // Contribute exactly the target amount to complete goal
        vm.expectEmit(true, true, false, false, address(vault));
        emit GoalCompleted(user1, 0);
        
        vm.prank(user1);
        vault.contributeToGoal(0, GOAL_TARGET);
        
        // Verify goal is completed
        (,,, uint256 saved, bool completed) = vault.goals(user1, 0);
        assertEq(saved, GOAL_TARGET);
        assertTrue(completed);
    }
    
    /// @notice Test FundsLocked event emission with correct args
    function testFundsLockedEventEmission() public {
        // Deposit first
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        uint256 expectedExpiry = block.timestamp + LOCK_DURATION;
        
        vm.expectEmit(true, true, false, true, address(vault));
        emit FundsLocked(user1, 0, LOCK_AMOUNT, expectedExpiry);
        
        vm.prank(user1);
        vault.lockFunds(LOCK_AMOUNT, LOCK_DURATION);
        
        // Verify lock was created correctly
        (uint256 amount, uint256 expiry, bool released) = vault.locks(user1, 0);
        assertEq(amount, LOCK_AMOUNT);
        assertEq(expiry, expectedExpiry);
        assertFalse(released);
    }
    
    /// @notice Test LockReleased event emission with correct args
    function testLockReleasedEventEmission() public {
        // Deposit and lock funds
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        vm.prank(user1);
        vault.lockFunds(LOCK_AMOUNT, LOCK_DURATION);
        
        // Move time forward past lock expiry
        vm.warp(block.timestamp + LOCK_DURATION + 1);
        
        vm.expectEmit(true, true, false, true, address(vault));
        emit LockReleased(user1, 0, LOCK_AMOUNT);
        
        vm.prank(user1);
        vault.withdrawLocked(0);
        
        // Verify lock was released
        (,, bool released) = vault.locks(user1, 0);
        assertTrue(released);
        assertEq(vault.lockedTotal(user1), 0);
    }

    // ================================================================================
    // REVERT TESTS - ONE TEST PER CUSTOM ERROR (Req 15.2)
    // ================================================================================
    
    /// @notice Test NotRegisteredUser error on deposit
    function testRevert_NotRegisteredUser_Deposit() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregistered));
        vm.prank(unregistered);
        vault.deposit(DEPOSIT_AMOUNT);
    }
    
    /// @notice Test NotRegisteredUser error on withdraw
    function testRevert_NotRegisteredUser_Withdraw() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregistered));
        vm.prank(unregistered);
        vault.withdraw(WITHDRAW_AMOUNT);
    }
    
    /// @notice Test NotRegisteredUser error on createGoal
    function testRevert_NotRegisteredUser_CreateGoal() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregistered));
        vm.prank(unregistered);
        vault.createGoal(GOAL_TARGET, block.timestamp + 30 days);
    }
    
    /// @notice Test NotRegisteredUser error on contributeToGoal
    function testRevert_NotRegisteredUser_ContributeToGoal() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregistered));
        vm.prank(unregistered);
        vault.contributeToGoal(0, 100e18);
    }
    
    /// @notice Test NotRegisteredUser error on lockFunds
    function testRevert_NotRegisteredUser_LockFunds() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregistered));
        vm.prank(unregistered);
        vault.lockFunds(LOCK_AMOUNT, LOCK_DURATION);
    }
    
    /// @notice Test NotRegisteredUser error on withdrawLocked
    function testRevert_NotRegisteredUser_WithdrawLocked() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregistered));
        vm.prank(unregistered);
        vault.withdrawLocked(0);
    }
    
    /// @notice Test ZeroAmount error on deposit
    function testRevert_ZeroAmount_Deposit() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(user1);
        vault.deposit(0);
    }
    
    /// @notice Test ZeroAmount error on withdraw
    function testRevert_ZeroAmount_Withdraw() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(user1);
        vault.withdraw(0);
    }
    
    /// @notice Test ZeroAmount error on contributeToGoal
    function testRevert_ZeroAmount_ContributeToGoal() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(user1);
        vault.contributeToGoal(0, 0);
    }
    
    /// @notice Test ZeroAmount error on lockFunds
    function testRevert_ZeroAmount_LockFunds() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(user1);
        vault.lockFunds(0, LOCK_DURATION);
    }
    
    /// @notice Test ZeroAmount error on withdrawLocked for non-existent lock
    function testRevert_ZeroAmount_WithdrawLocked_NonExistent() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(user1);
        vault.withdrawLocked(999); // Non-existent lock ID
    }
    
    /// @notice Test ZeroAmount error on withdrawLocked for already released lock
    function testRevert_ZeroAmount_WithdrawLocked_AlreadyReleased() public {
        // Deposit, lock, wait, and release
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        vm.prank(user1);
        vault.lockFunds(LOCK_AMOUNT, LOCK_DURATION);
        
        vm.warp(block.timestamp + LOCK_DURATION + 1);
        
        vm.prank(user1);
        vault.withdrawLocked(0); // First withdrawal should succeed
        
        // Second attempt should revert with ZeroAmount (already released)
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(user1);
        vault.withdrawLocked(0);
    }
    
    /// @notice Test InsufficientAvailableBalance error on withdraw
    function testRevert_InsufficientAvailableBalance_Withdraw() public {
        uint256 available = vault.availableBalance(user1); // Should be 0
        uint256 excessAmount = available + 1;
        
        vm.expectRevert(abi.encodeWithSelector(
            ISavingsVault.InsufficientAvailableBalance.selector,
            excessAmount,
            available
        ));
        vm.prank(user1);
        vault.withdraw(excessAmount);
    }
    
    /// @notice Test InsufficientAvailableBalance error on contributeToGoal
    function testRevert_InsufficientAvailableBalance_ContributeToGoal() public {
        // Create a goal first
        vm.prank(user1);
        vault.createGoal(GOAL_TARGET, block.timestamp + 30 days);
        
        uint256 available = vault.availableBalance(user1); // Should be 0
        uint256 excessAmount = available + 1;
        
        vm.expectRevert(abi.encodeWithSelector(
            ISavingsVault.InsufficientAvailableBalance.selector,
            excessAmount,
            available
        ));
        vm.prank(user1);
        vault.contributeToGoal(0, excessAmount);
    }
    
    /// @notice Test InsufficientAvailableBalance error on lockFunds
    function testRevert_InsufficientAvailableBalance_LockFunds() public {
        uint256 available = vault.availableBalance(user1); // Should be 0
        uint256 excessAmount = available + 1;
        
        vm.expectRevert(abi.encodeWithSelector(
            ISavingsVault.InsufficientAvailableBalance.selector,
            excessAmount,
            available
        ));
        vm.prank(user1);
        vault.lockFunds(excessAmount, LOCK_DURATION);
    }
    
    /// @notice Test VaultPaused error on deposit
    function testRevert_VaultPaused_Deposit() public {
        vm.prank(admin);
        vault.pause();
        
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.VaultPaused.selector));
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
    }
    
    /// @notice Test VaultPaused error on withdraw
    function testRevert_VaultPaused_Withdraw() public {
        // First deposit
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        vm.prank(admin);
        vault.pause();
        
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.VaultPaused.selector));
        vm.prank(user1);
        vault.withdraw(WITHDRAW_AMOUNT);
    }
    
    /// @notice Test InvalidGoalParams error for zero target amount
    function testRevert_InvalidGoalParams_ZeroTarget() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidGoalParams.selector));
        vm.prank(user1);
        vault.createGoal(0, block.timestamp + 30 days);
    }
    
    /// @notice Test InvalidGoalParams error for past target date
    function testRevert_InvalidGoalParams_PastDate() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidGoalParams.selector));
        vm.prank(user1);
        vault.createGoal(GOAL_TARGET, block.timestamp - 1);
    }
    
    /// @notice Test InvalidGoalParams error for current timestamp
    function testRevert_InvalidGoalParams_CurrentTimestamp() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidGoalParams.selector));
        vm.prank(user1);
        vault.createGoal(GOAL_TARGET, block.timestamp);
    }
    
    /// @notice Test InvalidGoalParams error for contributing to non-existent goal
    function testRevert_InvalidGoalParams_NonExistentGoal() public {
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        // Try to contribute to goal ID 999 which doesn't exist
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidGoalParams.selector));
        vm.prank(user1);
        vault.contributeToGoal(999, 100e18);
    }
    
    /// @notice Test InvalidLockDuration error for too short duration
    function testRevert_InvalidLockDuration_TooShort() public {
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        uint256 tooShort = 1 hours; // Less than MIN_LOCK (1 day)
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidLockDuration.selector, tooShort));
        vm.prank(user1);
        vault.lockFunds(LOCK_AMOUNT, tooShort);
    }
    
    /// @notice Test InvalidLockDuration error for too long duration
    function testRevert_InvalidLockDuration_TooLong() public {
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        uint256 tooLong = 6 * 365 days; // More than MAX_LOCK (5 years)
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidLockDuration.selector, tooLong));
        vm.prank(user1);
        vault.lockFunds(LOCK_AMOUNT, tooLong);
    }
    
    /// @notice Test LockNotExpired error when trying to withdraw before expiry
    function testRevert_LockNotExpired() public {
        // Deposit and lock funds
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        vm.prank(user1);
        vault.lockFunds(LOCK_AMOUNT, LOCK_DURATION);
        
        uint256 currentTime = block.timestamp;
        uint256 expectedExpiry = currentTime + LOCK_DURATION;
        
        // Try to withdraw immediately (before expiry)
        vm.expectRevert(abi.encodeWithSelector(
            ISavingsVault.LockNotExpired.selector,
            currentTime,
            expectedExpiry
        ));
        vm.prank(user1);
        vault.withdrawLocked(0);
    }

    // ================================================================================
    // REENTRANCY ATTACK TEST (Req 4.6, 15.3)
    // ================================================================================
    
    /// @notice Test reentrancy protection on deposit function
    function testReentrancyProtection_Deposit() public {
        // Reset attack counters
        attacker.resetCounters();
        
        // Attempt reentrancy attack on deposit
        vm.prank(address(attacker));
        attacker.attackDeposit(1000e18);
        
        // Verify no reentrancy occurred
        assertEq(attacker.depositAttempts(), 0, "No reentrancy should occur on deposit");
        assertEq(attacker.withdrawAttempts(), 0, "No reentrancy should occur on deposit");
        
        // Verify the original deposit succeeded
        assertEq(vault.depositedBalance(address(attacker)), 1000e18);
    }
    
    /// @notice Test reentrancy protection on withdraw function  
    function testReentrancyProtection_Withdraw() public {
        // First deposit some funds
        vm.prank(address(attacker));
        attacker.attackDeposit(2000e18);
        
        // Reset attack counters
        attacker.resetCounters();
        
        // Attempt reentrancy attack on withdraw
        vm.prank(address(attacker));
        attacker.attackWithdraw(500e18);
        
        // Verify no reentrancy occurred
        assertEq(attacker.depositAttempts(), 0, "No reentrancy should occur on withdraw");
        assertEq(attacker.withdrawAttempts(), 0, "No reentrancy should occur on withdraw");
        
        // Verify the original withdrawal succeeded
        assertEq(vault.depositedBalance(address(attacker)), 1500e18);
    }
    
    /// @notice Test reentrancy protection on contributeToGoal function
    function testReentrancyProtection_ContributeToGoal() public {
        // Setup: deposit and create goal
        vm.prank(address(attacker));
        attacker.attackDeposit(3000e18);
        
        vm.prank(address(attacker));
        vault.createGoal(2000e18, block.timestamp + 30 days);
        
        // Reset attack counters
        attacker.resetCounters();
        
        // Attempt reentrancy attack on contributeToGoal
        vm.prank(address(attacker));
        attacker.attackContributeToGoal(0, 500e18);
        
        // Verify no reentrancy occurred
        assertEq(attacker.contributeAttempts(), 0, "No reentrancy should occur on contributeToGoal");
        assertEq(attacker.depositAttempts(), 0, "No reentrancy should occur on contributeToGoal");
        
        // Verify the original contribution succeeded
        (,,,uint256 savedAmount,) = vault.goals(address(attacker), 0);
        assertEq(savedAmount, 500e18);
    }
    
    /// @notice Test reentrancy protection on lockFunds function
    function testReentrancyProtection_LockFunds() public {
        // Setup: deposit funds
        vm.prank(address(attacker));
        attacker.attackDeposit(2000e18);
        
        // Reset attack counters
        attacker.resetCounters();
        
        // Attempt reentrancy attack on lockFunds
        vm.prank(address(attacker));
        attacker.attackLockFunds(300e18, 7 days);
        
        // Verify no reentrancy occurred
        assertEq(attacker.lockAttempts(), 0, "No reentrancy should occur on lockFunds");
        assertEq(attacker.depositAttempts(), 0, "No reentrancy should occur on lockFunds");
        
        // Verify the original lock succeeded
        assertEq(vault.lockedTotal(address(attacker)), 300e18);
    }
    
    /// @notice Test reentrancy protection on withdrawLocked function
    function testReentrancyProtection_WithdrawLocked() public {
        // Setup: deposit and lock funds
        vm.prank(address(attacker));
        attacker.attackDeposit(2000e18);
        
        vm.prank(address(attacker));
        attacker.attackLockFunds(400e18, 1 days);
        
        // Move time forward past lock expiry
        vm.warp(block.timestamp + 1 days + 1);
        
        // Reset attack counters
        attacker.resetCounters();
        
        // Attempt reentrancy attack on withdrawLocked
        vm.prank(address(attacker));
        attacker.attackWithdrawLocked(0);
        
        // Verify no reentrancy occurred
        assertEq(attacker.unlockAttempts(), 0, "No reentrancy should occur on withdrawLocked");
        assertEq(attacker.withdrawAttempts(), 0, "No reentrancy should occur on withdrawLocked");
        
        // Verify the original unlock succeeded
        assertEq(vault.lockedTotal(address(attacker)), 0);
    }
    
    /// @notice Comprehensive reentrancy attack test - attempts multiple vectors simultaneously
    function testReentrancyProtection_Comprehensive() public {
        // Setup complete scenario
        vm.prank(address(attacker));
        attacker.attackDeposit(5000e18);
        
        vm.prank(address(attacker));
        vault.createGoal(1000e18, block.timestamp + 30 days);
        
        vm.prank(address(attacker));
        attacker.attackLockFunds(1000e18, 1 days);
        
        // Move time forward for lock expiry
        vm.warp(block.timestamp + 1 days + 1);
        
        // Reset all counters
        attacker.resetCounters();
        
        // Attempt multiple reentrancy vectors
        vm.startPrank(address(attacker));
        
        // Try deposit reentrancy
        attacker.attackDeposit(100e18);
        
        // Try withdraw reentrancy  
        attacker.attackWithdraw(100e18);
        
        // Try contribute reentrancy
        attacker.attackContributeToGoal(0, 100e18);
        
        // Try withdraw locked reentrancy
        attacker.attackWithdrawLocked(0);
        
        vm.stopPrank();
        
        // Verify no reentrancy occurred on any function
        assertEq(attacker.depositAttempts(), 0, "No deposit reentrancy should occur");
        assertEq(attacker.withdrawAttempts(), 0, "No withdraw reentrancy should occur");
        assertEq(attacker.contributeAttempts(), 0, "No contribute reentrancy should occur");
        assertEq(attacker.lockAttempts(), 0, "No lock reentrancy should occur");
        assertEq(attacker.unlockAttempts(), 0, "No unlock reentrancy should occur");
        
        // Verify all original operations succeeded
        // Expected balance: initial 5000 + 100 (new deposit) - 100 (withdraw) = 5000
        assertEq(vault.depositedBalance(address(attacker)), 5000e18, "Final deposited balance should be 5000");
        assertEq(vault.lockedTotal(address(attacker)), 0, "Lock should have been released");
        
        (,,,uint256 savedAmount,) = vault.goals(address(attacker), 0);
        assertEq(savedAmount, 100e18, "Goal contribution should have succeeded");
    }

    // ================================================================================
    // UNIT TESTS - CORE FUNCTIONALITY VERIFICATION
    // ================================================================================
    
    /// @notice Unit test: deposit functionality updates balances correctly
    function testUnit_DepositUpdatesBalances() public {
        uint256 userBalanceBefore = token.balanceOf(user1);
        uint256 vaultBalanceBefore = token.balanceOf(address(vault));
        uint256 depositedBefore = vault.depositedBalance(user1);
        
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        assertEq(token.balanceOf(user1), userBalanceBefore - DEPOSIT_AMOUNT);
        assertEq(token.balanceOf(address(vault)), vaultBalanceBefore + DEPOSIT_AMOUNT);
        assertEq(vault.depositedBalance(user1), depositedBefore + DEPOSIT_AMOUNT);
        assertEq(vault.availableBalance(user1), depositedBefore + DEPOSIT_AMOUNT);
    }
    
    /// @notice Unit test: withdraw functionality updates balances correctly
    function testUnit_WithdrawUpdatesBalances() public {
        // First deposit
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        uint256 userBalanceBefore = token.balanceOf(user1);
        uint256 vaultBalanceBefore = token.balanceOf(address(vault));
        uint256 depositedBefore = vault.depositedBalance(user1);
        
        vm.prank(user1);
        vault.withdraw(WITHDRAW_AMOUNT);
        
        assertEq(token.balanceOf(user1), userBalanceBefore + WITHDRAW_AMOUNT);
        assertEq(token.balanceOf(address(vault)), vaultBalanceBefore - WITHDRAW_AMOUNT);
        assertEq(vault.depositedBalance(user1), depositedBefore - WITHDRAW_AMOUNT);
        assertEq(vault.availableBalance(user1), depositedBefore - WITHDRAW_AMOUNT);
    }
    
    /// @notice Unit test: goal creation increments nextGoalId correctly
    function testUnit_GoalCreationIncrementsId() public {
        uint256 nextIdBefore = vault.nextGoalId(user1);
        assertEq(nextIdBefore, 0);
        
        vm.prank(user1);
        vault.createGoal(GOAL_TARGET, block.timestamp + 30 days);
        
        assertEq(vault.nextGoalId(user1), nextIdBefore + 1);
        
        // Create another goal
        vm.prank(user1);
        vault.createGoal(GOAL_TARGET * 2, block.timestamp + 60 days);
        
        assertEq(vault.nextGoalId(user1), nextIdBefore + 2);
    }
    
    /// @notice Unit test: goal contribution affects available balance correctly
    function testUnit_GoalContributionAffectsAvailableBalance() public {
        // Setup
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        vm.prank(user1);
        vault.createGoal(GOAL_TARGET, block.timestamp + 30 days);
        
        uint256 availableBefore = vault.availableBalance(user1);
        uint256 contributionAmount = 300e18;
        
        vm.prank(user1);
        vault.contributeToGoal(0, contributionAmount);
        
        // Available balance should decrease by contribution amount
        assertEq(vault.availableBalance(user1), availableBefore - contributionAmount);
        
        // Portfolio value should remain the same
        assertEq(vault.portfolioValue(user1), DEPOSIT_AMOUNT);
        
        // Goal should show the contribution
        (,,,uint256 savedAmount,) = vault.goals(user1, 0);
        assertEq(savedAmount, contributionAmount);
    }
    
    /// @notice Unit test: lock funds affects available balance and locked total
    function testUnit_LockFundsAffectsBalances() public {
        // Setup
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        uint256 availableBefore = vault.availableBalance(user1);
        uint256 lockedBefore = vault.lockedTotal(user1);
        
        vm.prank(user1);
        vault.lockFunds(LOCK_AMOUNT, LOCK_DURATION);
        
        // Available balance should decrease by lock amount
        assertEq(vault.availableBalance(user1), availableBefore - LOCK_AMOUNT);
        
        // Locked total should increase by lock amount
        assertEq(vault.lockedTotal(user1), lockedBefore + LOCK_AMOUNT);
        
        // Portfolio value should remain the same (locked funds still count)
        assertEq(vault.portfolioValue(user1), DEPOSIT_AMOUNT);
        
        // Deposited balance should remain the same
        assertEq(vault.depositedBalance(user1), DEPOSIT_AMOUNT);
    }
    
    /// @notice Unit test: withdraw locked restores available balance
    function testUnit_WithdrawLockedRestoresBalance() public {
        // Setup: deposit and lock
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        vm.prank(user1);
        vault.lockFunds(LOCK_AMOUNT, LOCK_DURATION);
        
        uint256 availableBefore = vault.availableBalance(user1);
        uint256 lockedBefore = vault.lockedTotal(user1);
        
        // Move time past expiry and withdraw
        vm.warp(block.timestamp + LOCK_DURATION + 1);
        
        vm.prank(user1);
        vault.withdrawLocked(0);
        
        // Available balance should increase by unlocked amount
        assertEq(vault.availableBalance(user1), availableBefore + LOCK_AMOUNT);
        
        // Locked total should decrease by unlocked amount
        assertEq(vault.lockedTotal(user1), lockedBefore - LOCK_AMOUNT);
        
        // Lock should be marked as released
        (,, bool released) = vault.locks(user1, 0);
        assertTrue(released);
    }
    
    /// @notice Unit test: portfolio value calculation includes all funds
    function testUnit_PortfolioValueCalculation() public {
        // Initial state
        assertEq(vault.portfolioValue(user1), 0);
        
        // After deposit
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        assertEq(vault.portfolioValue(user1), DEPOSIT_AMOUNT);
        
        // After creating and contributing to goal
        vm.prank(user1);
        vault.createGoal(GOAL_TARGET, block.timestamp + 30 days);
        
        uint256 contributionAmount = 300e18;
        vm.prank(user1);
        vault.contributeToGoal(0, contributionAmount);
        
        // Portfolio should still include goal contributions
        assertEq(vault.portfolioValue(user1), DEPOSIT_AMOUNT);
        
        // After locking funds
        vm.prank(user1);
        vault.lockFunds(LOCK_AMOUNT, LOCK_DURATION);
        
        // Portfolio should still include locked funds
        assertEq(vault.portfolioValue(user1), DEPOSIT_AMOUNT);
    }
}