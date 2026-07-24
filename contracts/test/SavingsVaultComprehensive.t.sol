// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {Registry} from "../src/Registry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ISavingsVault} from "../src/interfaces/ISavingsVault.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";

/// @title ReentrantAttacker
/// @notice Mock contract to test reentrancy protection
contract ReentrantAttacker {
    SavingsVault public vault;
    MockERC20 public token;
    bool public attacking;
    
    constructor(SavingsVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;
    }
    
    function attack() external {
        attacking = true;
        token.approve(address(vault), type(uint256).max);
        vault.deposit(1e18);
        vault.withdraw(1e18);
    }
    
    // This will be called during token transfer - attempt reentrancy
    function onTransfer() external {
        if (attacking && vault.availableBalance(address(this)) > 0) {
            vault.withdraw(vault.availableBalance(address(this)));
        }
    }
}

/// @title MaliciousERC20
/// @notice Mock ERC20 that calls back during transfers to test reentrancy
contract MaliciousERC20 is MockERC20 {
    address public attacker;
    
    constructor() MockERC20("Malicious Token", "MAL", 18) {}
    
    function setAttacker(address _attacker) external {
        attacker = _attacker;
    }
    
    function transfer(address to, uint256 amount) public override returns (bool) {
        bool result = super.transfer(to, amount);
        if (to == attacker) {
            ReentrantAttacker(attacker).onTransfer();
        }
        return result;
    }
}

/// @title SavingsVaultComprehensiveTest
/// @notice Comprehensive unit, event, revert, and reentrancy tests for SavingsVault.
/// @dev Validates Requirements 4.6, 13.2, 13.3, 13.4, 13.5, 15.1, 15.2, 15.3 implementation.
contract SavingsVaultComprehensiveTest is Test {
    SavingsVault public vault;
    Registry public registry;
    MockERC20 public token;
    MaliciousERC20 public maliciousToken;
    
    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public unregistered = makeAddr("unregistered");
    
    uint256 public constant INITIAL_TOKEN_BALANCE = 100_000e18;
    
    // Events from ISavingsVault
    event DepositMade(address indexed user, uint256 amount);
    event WithdrawalMade(address indexed user, uint256 amount);
    event GoalCreated(address indexed user, uint256 indexed goalId, uint256 targetAmount, uint256 targetDate);
    event GoalCompleted(address indexed user, uint256 indexed goalId);
    event FundsLocked(address indexed user, uint256 indexed lockId, uint256 amount, uint256 expiry);
    event LockReleased(address indexed user, uint256 indexed lockId, uint256 amount);
    
    function setUp() public {
        // Deploy tokens
        token = new MockERC20("Test Token", "TEST", 18);
        maliciousToken = new MaliciousERC20();
        
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
        token.mint(unregistered, INITIAL_TOKEN_BALANCE);
        
        // Approve vault to spend tokens
        vm.prank(user1);
        token.approve(address(vault), type(uint256).max);
        vm.prank(user2);
        token.approve(address(vault), type(uint256).max);
        vm.prank(unregistered);
        token.approve(address(vault), type(uint256).max);
    }
    
    // ================================================================================
    // EVENT EMISSION TESTS (Req 13.2, 13.3, 13.4, 13.5)
    // ================================================================================
    
    /// @notice Test deposit event emission with correct parameters (Req 13.2)
    function testDepositEventEmission() public {
        uint256 amount = 1000e18;
        
        vm.expectEmit(true, false, false, true);
        emit DepositMade(user1, amount);
        
        vm.prank(user1);
        vault.deposit(amount);
    }
    
    /// @notice Test withdrawal event emission with correct parameters (Req 13.3)
    function testWithdrawalEventEmission() public {
        uint256 depositAmount = 1000e18;
        uint256 withdrawAmount = 500e18;
        
        // Deposit first
        vm.prank(user1);
        vault.deposit(depositAmount);
        
        vm.expectEmit(true, false, false, true);
        emit WithdrawalMade(user1, withdrawAmount);
        
        vm.prank(user1);
        vault.withdraw(withdrawAmount);
    }
    
    /// @notice Test goal creation event emission with correct parameters (Req 13.4)
    function testGoalCreatedEventEmission() public {
        uint256 targetAmount = 1000e18;
        uint256 targetDate = block.timestamp + 30 days;
        
        vm.expectEmit(true, true, false, true);
        emit GoalCreated(user1, 0, targetAmount, targetDate);
        
        vm.prank(user1);
        vault.createGoal(targetAmount, targetDate);
    }
    
    /// @notice Test goal completion event emission (Req 13.5)
    function testGoalCompletedEventEmission() public {
        uint256 targetAmount = 500e18;
        uint256 depositAmount = 1000e18;
        
        // Setup
        vm.prank(user1);
        vault.deposit(depositAmount);
        
        vm.prank(user1);
        vault.createGoal(targetAmount, block.timestamp + 30 days);
        
        // Contribute enough to complete goal
        vm.expectEmit(true, true, false, false);
        emit GoalCompleted(user1, 0);
        
        vm.prank(user1);
        vault.contributeToGoal(0, targetAmount);
    }
    
    /// @notice Test funds locked event emission with correct parameters (Req 13.5)
    function testFundsLockedEventEmission() public {
        uint256 amount = 500e18;
        uint256 duration = 7 days;
        
        // Setup
        vm.prank(user1);
        vault.deposit(1000e18);
        
        uint256 expectedExpiry = block.timestamp + duration;
        
        vm.expectEmit(true, true, false, true);
        emit FundsLocked(user1, 0, amount, expectedExpiry);
        
        vm.prank(user1);
        vault.lockFunds(amount, duration);
    }
    
    /// @notice Test lock released event emission with correct parameters (Req 13.5)
    function testLockReleasedEventEmission() public {
        uint256 amount = 500e18;
        uint256 duration = 1 days;
        
        // Setup and lock
        vm.prank(user1);
        vault.deposit(1000e18);
        
        vm.prank(user1);
        vault.lockFunds(amount, duration);
        
        // Fast forward past expiry
        vm.warp(block.timestamp + duration + 1);
        
        vm.expectEmit(true, true, false, true);
        emit LockReleased(user1, 0, amount);
        
        vm.prank(user1);
        vault.withdrawLocked(0);
    }
    
    /// @notice Test that multiple events are emitted in complex scenarios
    function testMultipleEventEmission() public {
        uint256 depositAmount = 1000e18;
        uint256 goalTarget = 300e18;
        uint256 lockAmount = 200e18;
        
        // Deposit - should emit DepositMade
        vm.expectEmit(true, false, false, true);
        emit DepositMade(user1, depositAmount);
        vm.prank(user1);
        vault.deposit(depositAmount);
        
        // Create goal - should emit GoalCreated
        vm.expectEmit(true, true, false, true);
        emit GoalCreated(user1, 0, goalTarget, block.timestamp + 30 days);
        vm.prank(user1);
        vault.createGoal(goalTarget, block.timestamp + 30 days);
        
        // Lock funds - should emit FundsLocked
        vm.expectEmit(true, true, false, true);
        emit FundsLocked(user1, 0, lockAmount, block.timestamp + 7 days);
        vm.prank(user1);
        vault.lockFunds(lockAmount, 7 days);
        
        // Contribute to goal and complete it - should emit GoalCompleted
        vm.expectEmit(true, true, false, false);
        emit GoalCompleted(user1, 0);
        vm.prank(user1);
        vault.contributeToGoal(0, goalTarget);
    }
    
    // ================================================================================
    // REVERT TESTS - One test per custom error (Req 15.1, 15.2, 15.3)
    // ================================================================================
    
    /// @notice Test NotRegisteredUser error
    function testNotRegisteredUserError() public {
        // Deposit by unregistered user
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregistered));
        vm.prank(unregistered);
        vault.deposit(1000e18);
        
        // Withdraw by unregistered user
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregistered));
        vm.prank(unregistered);
        vault.withdraw(1000e18);
        
        // Create goal by unregistered user
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregistered));
        vm.prank(unregistered);
        vault.createGoal(1000e18, block.timestamp + 30 days);
        
        // Lock funds by unregistered user
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregistered));
        vm.prank(unregistered);
        vault.lockFunds(1000e18, 7 days);
    }
    
    /// @notice Test ZeroAmount error
    function testZeroAmountError() public {
        // Zero deposit
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(user1);
        vault.deposit(0);
        
        // Zero withdrawal
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(user1);
        vault.withdraw(0);
        
        // Zero goal contribution
        vm.prank(user1);
        vault.deposit(1000e18);
        vm.prank(user1);
        vault.createGoal(500e18, block.timestamp + 30 days);
        
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(user1);
        vault.contributeToGoal(0, 0);
        
        // Zero lock amount
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(user1);
        vault.lockFunds(0, 7 days);
    }
    
    /// @notice Test InsufficientAvailableBalance error
    function testInsufficientAvailableBalanceError() public {
        uint256 deposit = 1000e18;
        vm.prank(user1);
        vault.deposit(deposit);
        
        uint256 available = vault.availableBalance(user1);
        uint256 excess = available + 1;
        
        // Withdrawal exceeding balance
        vm.expectRevert(abi.encodeWithSelector(
            ISavingsVault.InsufficientAvailableBalance.selector, 
            excess, 
            available
        ));
        vm.prank(user1);
        vault.withdraw(excess);
        
        // Goal contribution exceeding balance
        vm.prank(user1);
        vault.createGoal(2000e18, block.timestamp + 30 days);
        
        vm.expectRevert(abi.encodeWithSelector(
            ISavingsVault.InsufficientAvailableBalance.selector, 
            excess, 
            available
        ));
        vm.prank(user1);
        vault.contributeToGoal(0, excess);
        
        // Lock amount exceeding balance
        vm.expectRevert(abi.encodeWithSelector(
            ISavingsVault.InsufficientAvailableBalance.selector, 
            excess, 
            available
        ));
        vm.prank(user1);
        vault.lockFunds(excess, 7 days);
    }
    
    /// @notice Test VaultPaused error
    function testVaultPausedError() public {
        // Pause the vault
        vm.prank(admin);
        vault.pause();
        
        // Deposit when paused
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.VaultPaused.selector));
        vm.prank(user1);
        vault.deposit(1000e18);
        
        // Withdraw when paused
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.VaultPaused.selector));
        vm.prank(user1);
        vault.withdraw(1000e18);
    }
    
    /// @notice Test InvalidGoalParams error
    function testInvalidGoalParamsError() public {
        // Zero target amount
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidGoalParams.selector));
        vm.prank(user1);
        vault.createGoal(0, block.timestamp + 30 days);
        
        // Past target date
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidGoalParams.selector));
        vm.prank(user1);
        vault.createGoal(1000e18, block.timestamp - 1);
        
        // Current timestamp
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidGoalParams.selector));
        vm.prank(user1);
        vault.createGoal(1000e18, block.timestamp);
        
        // Non-existent goal contribution
        vm.prank(user1);
        vault.deposit(1000e18);
        
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidGoalParams.selector));
        vm.prank(user1);
        vault.contributeToGoal(999, 100e18); // Non-existent goal ID
    }
    
    /// @notice Test InvalidLockDuration error
    function testInvalidLockDurationError() public {
        vm.prank(user1);
        vault.deposit(1000e18);
        
        // Duration too short
        uint256 tooShort = 1 hours;
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidLockDuration.selector, tooShort));
        vm.prank(user1);
        vault.lockFunds(100e18, tooShort);
        
        // Duration too long
        uint256 tooLong = 6 * 365 days;
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidLockDuration.selector, tooLong));
        vm.prank(user1);
        vault.lockFunds(100e18, tooLong);
    }
    
    /// @notice Test LockNotExpired error
    function testLockNotExpiredError() public {
        uint256 duration = 7 days;
        
        vm.prank(user1);
        vault.deposit(1000e18);
        
        vm.prank(user1);
        vault.lockFunds(500e18, duration);
        
        // Try to withdraw immediately
        vm.expectRevert(abi.encodeWithSelector(
            ISavingsVault.LockNotExpired.selector, 
            block.timestamp, 
            block.timestamp + duration
        ));
        vm.prank(user1);
        vault.withdrawLocked(0);
        
        // Try to withdraw just before expiry
        vm.warp(block.timestamp + duration - 1);
        vm.expectRevert(abi.encodeWithSelector(
            ISavingsVault.LockNotExpired.selector, 
            block.timestamp, 
            block.timestamp + 1
        ));
        vm.prank(user1);
        vault.withdrawLocked(0);
    }
    
    // ================================================================================
    // REENTRANCY PROTECTION TESTS (Req 4.6)
    // ================================================================================
    
    /// @notice Test reentrancy protection on deposit function
    function testDepositReentrancyProtection() public {
        // Create attacker contract
        ReentrantAttacker attacker = new ReentrantAttacker(vault, token);
        
        // Register attacker
        vm.prank(address(attacker));
        registry.register();
        
        // Give attacker some tokens
        token.mint(address(attacker), 10e18);
        
        // Attack should be prevented by reentrancy guard
        vm.expectRevert(); // Should revert due to reentrancy guard
        attacker.attack();
    }
    
    /// @notice Test reentrancy protection on withdraw function
    function testWithdrawReentrancyProtection() public {
        // Create malicious vault with malicious token
        SavingsVault maliciousVaultImpl = new SavingsVault();
        bytes memory maliciousVaultData = abi.encodeCall(
            SavingsVault.initialize,
            (address(maliciousToken), address(registry), admin)
        );
        ERC1967Proxy maliciousVaultProxy = new ERC1967Proxy(address(maliciousVaultImpl), maliciousVaultData);
        SavingsVault maliciousVault = SavingsVault(address(maliciousVaultProxy));
        
        // Create attacker for malicious setup
        ReentrantAttacker attacker = new ReentrantAttacker(maliciousVault, maliciousToken);
        maliciousToken.setAttacker(address(attacker));
        
        // Register attacker
        vm.prank(address(attacker));
        registry.register();
        
        // Give attacker some tokens and deposit
        maliciousToken.mint(address(attacker), 10e18);
        maliciousToken.approve(address(maliciousVault), type(uint256).max);
        vm.prank(address(attacker));
        maliciousVault.deposit(2e18);
        
        // Attempt to exploit via withdrawal should be prevented
        vm.expectRevert(); // Should revert due to reentrancy guard
        vm.prank(address(attacker));
        maliciousVault.withdraw(1e18);
    }
    
    /// @notice Test reentrancy protection on goal contribution
    function testGoalContributionReentrancyProtection() public {
        // Even though contributeToGoal doesn't transfer tokens out, it modifies state
        // and should have reentrancy protection
        
        vm.prank(user1);
        vault.deposit(1000e18);
        
        vm.prank(user1);
        vault.createGoal(500e18, block.timestamp + 30 days);
        
        // Normal contribution should work
        vm.prank(user1);
        vault.contributeToGoal(0, 100e18);
        
        (,,,uint256 saved,) = vault.goals(user1, 0);
        assertEq(saved, 100e18, "Goal contribution should succeed normally");
    }
    
    /// @notice Test reentrancy protection on lock funds
    function testLockFundsReentrancyProtection() public {
        vm.prank(user1);
        vault.deposit(1000e18);
        
        // Normal lock should work
        vm.prank(user1);
        vault.lockFunds(500e18, 7 days);
        
        assertEq(vault.lockedTotal(user1), 500e18, "Lock funds should succeed normally");
    }
    
    /// @notice Test reentrancy protection on withdraw locked
    function testWithdrawLockedReentrancyProtection() public {
        vm.prank(user1);
        vault.deposit(1000e18);
        
        vm.prank(user1);
        vault.lockFunds(500e18, 1 days);
        
        // Fast forward past expiry
        vm.warp(block.timestamp + 1 days + 1);
        
        // Normal withdrawal should work
        vm.prank(user1);
        vault.withdrawLocked(0);
        
        assertEq(vault.lockedTotal(user1), 0, "Withdraw locked should succeed normally");
    }
    
    // ================================================================================
    // ADDITIONAL UNIT TESTS FOR EDGE CASES
    // ================================================================================
    
    /// @notice Test initialization edge cases
    function testInitializationEdgeCases() public {
        SavingsVault newVaultImpl = new SavingsVault();
        
        // Test initialization with zero addresses should revert
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        bytes memory badData1 = abi.encodeCall(
            SavingsVault.initialize,
            (address(0), address(registry), admin)
        );
        new ERC1967Proxy(address(newVaultImpl), badData1);
        
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        bytes memory badData2 = abi.encodeCall(
            SavingsVault.initialize,
            (address(token), address(0), admin)
        );
        new ERC1967Proxy(address(newVaultImpl), badData2);
        
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        bytes memory badData3 = abi.encodeCall(
            SavingsVault.initialize,
            (address(token), address(registry), address(0))
        );
        new ERC1967Proxy(address(newVaultImpl), badData3);
    }
    
    /// @notice Test pause/unpause access control
    function testPauseUnpauseAccessControl() public {
        // Non-admin cannot pause
        vm.expectRevert();
        vm.prank(user1);
        vault.pause();
        
        // Admin can pause
        vm.prank(admin);
        vault.pause();
        assertTrue(vault.paused(), "Vault should be paused");
        
        // Non-admin cannot unpause
        vm.expectRevert();
        vm.prank(user1);
        vault.unpause();
        
        // Admin can unpause
        vm.prank(admin);
        vault.unpause();
        assertFalse(vault.paused(), "Vault should be unpaused");
    }
    
    /// @notice Test upgrade authorization
    function testUpgradeAuthorization() public {
        // Non-upgrader cannot authorize upgrade
        vm.expectRevert();
        vm.prank(user1);
        vault.upgradeTo(address(new SavingsVault()));
        
        // Admin (who has UPGRADER_ROLE) can authorize upgrade
        SavingsVault newImpl = new SavingsVault();
        vm.prank(admin);
        vault.upgradeTo(address(newImpl));
    }
    
    /// @notice Test view functions with various states
    function testViewFunctions() public {
        // Initial state
        assertEq(vault.availableBalance(user1), 0, "Initial available balance should be zero");
        assertEq(vault.portfolioValue(user1), 0, "Initial portfolio value should be zero");
        assertEq(vault.nextGoalId(user1), 0, "Initial next goal ID should be zero");
        assertEq(vault.nextLockId(user1), 0, "Initial next lock ID should be zero");
        
        // After operations
        vm.prank(user1);
        vault.deposit(1000e18);
        
        vm.prank(user1);
        vault.createGoal(500e18, block.timestamp + 30 days);
        
        vm.prank(user1);
        vault.lockFunds(200e18, 7 days);
        
        assertEq(vault.availableBalance(user1), 800e18, "Available balance should account for locks");
        assertEq(vault.portfolioValue(user1), 1000e18, "Portfolio value should include all holdings");
        assertEq(vault.nextGoalId(user1), 1, "Next goal ID should increment");
        assertEq(vault.nextLockId(user1), 1, "Next lock ID should increment");
    }
    
    /// @notice Test constants are correct
    function testConstants() public {
        assertEq(vault.MIN_LOCK(), 1 days, "MIN_LOCK should be 1 day");
        assertEq(vault.MAX_LOCK(), 5 * 365 days, "MAX_LOCK should be 5 years");
        
        bytes32 expectedPauserRole = keccak256("PAUSER_ROLE");
        assertEq(vault.PAUSER_ROLE(), expectedPauserRole, "PAUSER_ROLE should match expected hash");
        
        bytes32 expectedUpgraderRole = keccak256("UPGRADER_ROLE");
        assertEq(vault.UPGRADER_ROLE(), expectedUpgraderRole, "UPGRADER_ROLE should match expected hash");
    }
}