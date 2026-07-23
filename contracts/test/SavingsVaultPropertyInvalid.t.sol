// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {Registry} from "../src/Registry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ISavingsVault} from "../src/interfaces/ISavingsVault.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";

/// @title SavingsVaultPropertyInvalidTest
/// @notice Property-based tests for invalid SavingsVault operations.
/// @dev Validates Requirements 4.4, 4.7, 4.8, 4.9 implementation using Foundry fuzz testing.
contract SavingsVaultPropertyInvalidTest is Test {
    SavingsVault public vault;
    Registry public registry;
    MockERC20 public token;
    
    address public admin = makeAddr("admin");
    address public registeredUser = makeAddr("registered");
    address public unregisteredUser = makeAddr("unregistered");
    
    uint256 public constant INITIAL_TOKEN_BALANCE = 10_000e18;
    uint256 public constant TEST_DEPOSIT = 1000e18;
    
    // Bounded parameters for property testing
    struct InvalidOpParams {
        uint256 amount;          // Test amount (0 to max)
        bool userRegistered;     // Whether user is registered
        bool vaultPaused;        // Whether vault is paused
        uint256 userBalance;     // User's current vault balance
        uint256 lockedAmount;    // Amount locked (affects available balance)
    }
    
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
        
        // Register the registered user
        vm.prank(registeredUser);
        registry.register();
        
        // Mint tokens to both users
        token.mint(registeredUser, INITIAL_TOKEN_BALANCE);
        token.mint(unregisteredUser, INITIAL_TOKEN_BALANCE);
        
        // Approve vault to spend tokens
        vm.prank(registeredUser);
        token.approve(address(vault), type(uint256).max);
        vm.prank(unregisteredUser);
        token.approve(address(vault), type(uint256).max);
        
        // Give registered user some initial balance for withdrawal tests
        vm.prank(registeredUser);
        vault.deposit(TEST_DEPOSIT);
    }
    
    /// @notice **Property 12: Invalid vault operations revert without state change**
    /// **Validates: Requirements 4.4, 4.7, 4.8, 4.9**
    /// 
    /// This property verifies that invalid deposit and withdrawal operations revert with 
    /// the appropriate custom error and leave all balances unchanged. Invalid operations include:
    /// - Zero-amount deposits/withdrawals (Req 4.9)
    /// - Operations by unregistered users (Req 4.8) 
    /// - Operations when vault is paused (Req 4.7)
    /// - Withdrawals exceeding available balance (Req 4.4)
    function testProperty12_InvalidVaultOperationsRevertWithoutStateChange(
        uint256 _amount,
        bool _userRegistered,
        bool _vaultPaused,
        uint256 _withdrawAmount
    ) public {
        // Bound parameters to valid ranges
        uint256 amount = bound(_amount, 0, INITIAL_TOKEN_BALANCE);
        uint256 withdrawAmount = bound(_withdrawAmount, 0, INITIAL_TOKEN_BALANCE * 2); // Allow exceeding balance
        
        address testUser = _userRegistered ? registeredUser : unregisteredUser;
        
        // Set vault pause state
        if (_vaultPaused) {
            vm.prank(admin);
            vault.pause();
        }
        
        // Capture initial state
        uint256 initialUserTokenBalance = token.balanceOf(testUser);
        uint256 initialVaultTokenBalance = token.balanceOf(address(vault));
        uint256 initialDepositedBalance = vault.depositedBalance(testUser);
        uint256 initialAvailableBalance = vault.availableBalance(testUser);
        uint256 initialPortfolioValue = vault.portfolioValue(testUser);
        
        // Test invalid deposit operations
        _testInvalidDeposit(testUser, amount, _userRegistered, _vaultPaused);
        
        // Verify state unchanged after invalid deposit
        assertEq(token.balanceOf(testUser), initialUserTokenBalance, "User token balance should be unchanged after invalid deposit");
        assertEq(token.balanceOf(address(vault)), initialVaultTokenBalance, "Vault token balance should be unchanged after invalid deposit");
        assertEq(vault.depositedBalance(testUser), initialDepositedBalance, "Deposited balance should be unchanged after invalid deposit");
        assertEq(vault.availableBalance(testUser), initialAvailableBalance, "Available balance should be unchanged after invalid deposit");
        assertEq(vault.portfolioValue(testUser), initialPortfolioValue, "Portfolio value should be unchanged after invalid deposit");
        
        // Test invalid withdrawal operations
        _testInvalidWithdrawal(testUser, withdrawAmount, _userRegistered, _vaultPaused);
        
        // Verify state still unchanged after invalid withdrawal
        assertEq(token.balanceOf(testUser), initialUserTokenBalance, "User token balance should be unchanged after invalid withdrawal");
        assertEq(token.balanceOf(address(vault)), initialVaultTokenBalance, "Vault token balance should be unchanged after invalid withdrawal");
        assertEq(vault.depositedBalance(testUser), initialDepositedBalance, "Deposited balance should be unchanged after invalid withdrawal");
        assertEq(vault.availableBalance(testUser), initialAvailableBalance, "Available balance should be unchanged after invalid withdrawal");
        assertEq(vault.portfolioValue(testUser), initialPortfolioValue, "Portfolio value should be unchanged after invalid withdrawal");
    }
    
    /// @notice Test invalid deposit operations and verify proper revert reasons
    function _testInvalidDeposit(
        address user,
        uint256 amount,
        bool userRegistered,
        bool vaultPaused
    ) internal {
        // Determine the expected revert reason based on conditions
        // Priority order: paused > unregistered > zero amount
        if (vaultPaused) {
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.VaultPaused.selector));
        } else if (!userRegistered) {
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, user));
        } else if (amount == 0) {
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        } else {
            // This is a valid deposit - skip the test
            return;
        }
        
        vm.prank(user);
        vault.deposit(amount);
    }
    
    /// @notice Test invalid withdrawal operations and verify proper revert reasons
    function _testInvalidWithdrawal(
        address user,
        uint256 amount,
        bool userRegistered,
        bool vaultPaused
    ) internal {
        uint256 availableBalance = vault.availableBalance(user);
        
        // Determine the expected revert reason based on conditions
        // Priority order: paused > unregistered > zero amount > insufficient balance
        if (vaultPaused) {
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.VaultPaused.selector));
        } else if (!userRegistered) {
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, user));
        } else if (amount == 0) {
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        } else if (amount > availableBalance) {
            vm.expectRevert(abi.encodeWithSelector(
                ISavingsVault.InsufficientAvailableBalance.selector, 
                amount, 
                availableBalance
            ));
        } else {
            // This is a valid withdrawal - skip the test
            return;
        }
        
        vm.prank(user);
        vault.withdraw(amount);
    }
    
    /// @notice Test specific edge case: zero amount operations (Req 4.9)
    function testProperty12_ZeroAmountOperationsRevert() public {
        // Test zero deposit
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(registeredUser);
        vault.deposit(0);
        
        // Test zero withdrawal
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(registeredUser);
        vault.withdraw(0);
    }
    
    /// @notice Test specific edge case: unregistered user operations (Req 4.8)
    function testProperty12_UnregisteredUserOperationsRevert(uint256 amount) public {
        amount = bound(amount, 1, INITIAL_TOKEN_BALANCE);
        
        // Test deposit by unregistered user
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregisteredUser));
        vm.prank(unregisteredUser);
        vault.deposit(amount);
        
        // Test withdrawal by unregistered user
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregisteredUser));
        vm.prank(unregisteredUser);
        vault.withdraw(amount);
    }
    
    /// @notice Test specific edge case: operations when paused (Req 4.7)
    function testProperty12_PausedVaultOperationsRevert(uint256 amount) public {
        amount = bound(amount, 1, INITIAL_TOKEN_BALANCE);
        
        // Pause the vault
        vm.prank(admin);
        vault.pause();
        
        // Test deposit when paused
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.VaultPaused.selector));
        vm.prank(registeredUser);
        vault.deposit(amount);
        
        // Test withdrawal when paused
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.VaultPaused.selector));
        vm.prank(registeredUser);
        vault.withdraw(amount);
    }
    
    /// @notice Test specific edge case: insufficient balance withdrawal (Req 4.4)
    function testProperty12_InsufficientBalanceWithdrawalReverts(uint256 excessAmount) public {
        uint256 availableBalance = vault.availableBalance(registeredUser);
        // Ensure we're testing an amount that exceeds available balance
        excessAmount = bound(excessAmount, availableBalance + 1, availableBalance + INITIAL_TOKEN_BALANCE);
        
        vm.expectRevert(abi.encodeWithSelector(
            ISavingsVault.InsufficientAvailableBalance.selector, 
            excessAmount, 
            availableBalance
        ));
        vm.prank(registeredUser);
        vault.withdraw(excessAmount);
    }
    
    /// @notice Test edge case: maximum valid amounts don't revert
    function testProperty12_ValidOperationsDontRevert() public {
        // Unpause if paused
        if (vault.paused()) {
            vm.prank(admin);
            vault.unpause();
        }
        
        uint256 depositAmount = 100e18;
        uint256 availableBefore = vault.availableBalance(registeredUser);
        
        // Valid deposit should succeed
        vm.prank(registeredUser);
        vault.deposit(depositAmount);
        
        uint256 availableAfter = vault.availableBalance(registeredUser);
        assertEq(availableAfter, availableBefore + depositAmount, "Valid deposit should increase available balance");
        
        // Valid withdrawal should succeed
        vm.prank(registeredUser);
        vault.withdraw(depositAmount);
        
        uint256 availableFinal = vault.availableBalance(registeredUser);
        assertEq(availableFinal, availableBefore, "Valid withdrawal should restore available balance");
    }
    
    /// @notice Test that goal and lock operations also respect invalid operation rules
    function testProperty12_GoalAndLockOperationsRespectInvalidRules(
        uint256 targetAmount,
        uint256 targetDate,
        uint256 amount,
        uint256 duration
    ) public {
        // Bound parameters
        targetAmount = bound(targetAmount, 1, INITIAL_TOKEN_BALANCE);
        targetDate = bound(targetDate, block.timestamp + 1, block.timestamp + 365 days);
        amount = bound(amount, 1, INITIAL_TOKEN_BALANCE);
        duration = bound(duration, 1 days, 365 days);
        
        // Test unregistered user cannot create goals
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregisteredUser));
        vm.prank(unregisteredUser);
        vault.createGoal(targetAmount, targetDate);
        
        // Test unregistered user cannot lock funds
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregisteredUser));
        vm.prank(unregisteredUser);
        vault.lockFunds(amount, duration);
        
        // Pause vault
        vm.prank(admin);
        vault.pause();
        
        // Note: createGoal and lockFunds use whenNotPaused modifier which throws EnforcedPause() not VaultPaused()
        // Test registered user cannot create goals when paused
        vm.expectRevert(); // OpenZeppelin's EnforcedPause() error
        vm.prank(registeredUser);
        vault.createGoal(targetAmount, targetDate);
        
        // Test registered user cannot lock funds when paused
        vm.expectRevert(); // OpenZeppelin's EnforcedPause() error
        vm.prank(registeredUser);
        vault.lockFunds(amount, duration);
    }
}