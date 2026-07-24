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