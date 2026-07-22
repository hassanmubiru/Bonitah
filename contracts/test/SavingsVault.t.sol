// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {Registry} from "../src/Registry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ISavingsVault} from "../src/interfaces/ISavingsVault.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";

/// @title SavingsVaultTest
/// @notice Tests for the SavingsVault deposit/withdraw core functionality (Task 4.1).
/// @dev Verifies Requirements 4.1-4.9, 13.2-13.3 implementation.
contract SavingsVaultTest is Test {
    SavingsVault public vault;
    Registry public registry;
    MockERC20 public token;
    
    address public admin = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);
    address public unregistered = address(0x4);
    
    uint256 public constant INITIAL_BALANCE = 1000 * 1e18;
    uint256 public constant DEPOSIT_AMOUNT = 100 * 1e18;
    uint256 public constant WITHDRAW_AMOUNT = 50 * 1e18;
    
    event DepositMade(address indexed user, uint256 amount);
    event WithdrawalMade(address indexed user, uint256 amount);
    
    function setUp() public {
        // Deploy token
        token = new MockERC20("Test Token", "TEST", 18);
        
        // Deploy Registry proxy
        Registry registryImpl = new Registry();
        bytes memory registryData = abi.encodeWithSelector(Registry.initialize.selector, admin);
        ERC1967Proxy registryProxy = new ERC1967Proxy(address(registryImpl), registryData);
        registry = Registry(address(registryProxy));
        
        // Deploy SavingsVault proxy
        SavingsVault vaultImpl = new SavingsVault();
        bytes memory vaultData = abi.encodeWithSelector(
            SavingsVault.initialize.selector,
            address(token),
            address(registry),
            admin
        );
        ERC1967Proxy vaultProxy = new ERC1967Proxy(address(vaultImpl), vaultData);
        vault = SavingsVault(address(vaultProxy));
        
        // Mint tokens to test users
        token.mint(user1, INITIAL_BALANCE);
        token.mint(user2, INITIAL_BALANCE);
        token.mint(unregistered, INITIAL_BALANCE);
        
        // Register users
        vm.prank(user1);
        registry.register();
        
        vm.prank(user2);
        registry.register();
        
        // Approve vault to spend tokens
        vm.prank(user1);
        token.approve(address(vault), type(uint256).max);
        
        vm.prank(user2);
        token.approve(address(vault), type(uint256).max);
        
        vm.prank(unregistered);
        token.approve(address(vault), type(uint256).max);
    }
    
    /// @notice Test successful deposit for registered user (Req 4.2, 13.2)
    function testDeposit() public {
        uint256 balanceBefore = token.balanceOf(user1);
        uint256 vaultBalanceBefore = vault.depositedBalance(user1);
        
        vm.expectEmit(true, false, false, true);
        emit DepositMade(user1, DEPOSIT_AMOUNT);
        
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        assertEq(token.balanceOf(user1), balanceBefore - DEPOSIT_AMOUNT);
        assertEq(vault.depositedBalance(user1), vaultBalanceBefore + DEPOSIT_AMOUNT);
        assertEq(vault.availableBalance(user1), vaultBalanceBefore + DEPOSIT_AMOUNT);
    }
    
    /// @notice Test deposit reverts for unregistered user (Req 4.8)
    function testDepositRevertsForUnregisteredUser() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregistered));
        vm.prank(unregistered);
        vault.deposit(DEPOSIT_AMOUNT);
    }
    
    /// @notice Test deposit reverts for zero amount (Req 4.9)
    function testDepositRevertsForZeroAmount() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(user1);
        vault.deposit(0);
    }
    
    /// @notice Test deposit reverts when paused (Req 4.7)
    function testDepositRevertsWhenPaused() public {
        vm.prank(admin);
        vault.pause();
        
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.VaultPaused.selector));
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
    }
    
    /// @notice Test successful withdrawal for registered user (Req 4.3, 13.3)
    function testWithdraw() public {
        // First deposit
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        uint256 balanceBefore = token.balanceOf(user1);
        uint256 vaultBalanceBefore = vault.depositedBalance(user1);
        
        vm.expectEmit(true, false, false, true);
        emit WithdrawalMade(user1, WITHDRAW_AMOUNT);
        
        vm.prank(user1);
        vault.withdraw(WITHDRAW_AMOUNT);
        
        assertEq(token.balanceOf(user1), balanceBefore + WITHDRAW_AMOUNT);
        assertEq(vault.depositedBalance(user1), vaultBalanceBefore - WITHDRAW_AMOUNT);
        assertEq(vault.availableBalance(user1), vaultBalanceBefore - WITHDRAW_AMOUNT);
    }
    
    /// @notice Test withdraw reverts for insufficient balance (Req 4.4)
    function testWithdrawRevertsForInsufficientBalance() public {
        uint256 available = vault.availableBalance(user1);
        uint256 excessAmount = available + 1;
        
        vm.expectRevert(abi.encodeWithSelector(
            ISavingsVault.InsufficientAvailableBalance.selector, 
            excessAmount, 
            available
        ));
        vm.prank(user1);
        vault.withdraw(excessAmount);
    }
    
    /// @notice Test withdraw reverts for unregistered user (Req 4.8)
    function testWithdrawRevertsForUnregisteredUser() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.NotRegisteredUser.selector, unregistered));
        vm.prank(unregistered);
        vault.withdraw(WITHDRAW_AMOUNT);
    }
    
    /// @notice Test withdraw reverts for zero amount (Req 4.9)
    function testWithdrawRevertsForZeroAmount() public {
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(user1);
        vault.withdraw(0);
    }
    
    /// @notice Test withdraw reverts when paused (Req 4.7)
    function testWithdrawRevertsWhenPaused() public {
        // First deposit
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        vm.prank(admin);
        vault.pause();
        
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.VaultPaused.selector));
        vm.prank(user1);
        vault.withdraw(WITHDRAW_AMOUNT);
    }
    
    /// @notice Test available balance calculation (Req 4.3)
    function testAvailableBalance() public {
        assertEq(vault.availableBalance(user1), 0);
        
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        // Since lockedTotal is 0 (no locks implemented yet), available = deposited
        assertEq(vault.availableBalance(user1), DEPOSIT_AMOUNT);
    }
    
    /// @notice Test portfolio value calculation (Req 5.6 - interim implementation)
    function testPortfolioValue() public {
        assertEq(vault.portfolioValue(user1), 0);
        
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        // Interim implementation returns deposited balance
        assertEq(vault.portfolioValue(user1), DEPOSIT_AMOUNT);
    }
    
    /// @notice Test pause/unpause functionality (Req 4.7, 14.5)
    function testPauseUnpause() public {
        // Admin can pause
        vm.prank(admin);
        vault.pause();
        assertTrue(vault.paused());
        
        // Admin can unpause
        vm.prank(admin);
        vault.unpause();
        assertFalse(vault.paused());
    }
    
    /// @notice Test non-admin cannot pause (Req 14.5)
    function testNonAdminCannotPause() public {
        vm.expectRevert();
        vm.prank(user1);
        vault.pause();
    }
    
    /// @notice Test multiple deposits and withdrawals
    function testMultipleDepositsAndWithdrawals() public {
        // Multiple deposits
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT);
        
        assertEq(vault.depositedBalance(user1), DEPOSIT_AMOUNT * 2);
        assertEq(vault.availableBalance(user1), DEPOSIT_AMOUNT * 2);
        
        // Partial withdrawal
        vm.prank(user1);
        vault.withdraw(WITHDRAW_AMOUNT);
        
        assertEq(vault.depositedBalance(user1), DEPOSIT_AMOUNT * 2 - WITHDRAW_AMOUNT);
        assertEq(vault.availableBalance(user1), DEPOSIT_AMOUNT * 2 - WITHDRAW_AMOUNT);
    }
    
    /// @notice Test goal functions revert with NotYetImplemented (Task 4.4)
    function testGoalFunctionsNotImplemented() public {
        vm.expectRevert(abi.encodeWithSelector(SavingsVault.NotYetImplemented.selector));
        vm.prank(user1);
        vault.createGoal(1000, block.timestamp + 30 days);
        
        vm.expectRevert(abi.encodeWithSelector(SavingsVault.NotYetImplemented.selector));
        vm.prank(user1);
        vault.contributeToGoal(0, 100);
        
        vm.expectRevert(abi.encodeWithSelector(SavingsVault.NotYetImplemented.selector));
        vm.prank(user1);
        vault.lockFunds(100, 30 days);
        
        vm.expectRevert(abi.encodeWithSelector(SavingsVault.NotYetImplemented.selector));
        vm.prank(user1);
        vault.withdrawLocked(0);
    }
}