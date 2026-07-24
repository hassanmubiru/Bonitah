// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {Registry} from "../src/Registry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ISavingsVault} from "../src/interfaces/ISavingsVault.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";

/// @title SavingsVaultPropertyBalanceTest
/// @notice Property-based tests for SavingsVault balance conservation.
/// @dev Validates Requirements 4.2, 4.3, 5.6 implementation using Foundry fuzz testing.
contract SavingsVaultPropertyBalanceTest is Test {
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
    
    /// @notice **Property 11: Vault balance conservation and portfolio value**
    /// **Validates: Requirements 4.2, 4.3, 5.6**
    /// 
    /// This property verifies that the vault correctly maintains balance conservation across all operations:
    /// 1. Total system balance (user tokens + vault tokens) remains constant
    /// 2. Available balance = deposited balance - locked balance 
    /// 3. Portfolio value correctly reflects all user holdings
    /// 4. Individual user operations don't affect other users' balances
    function testProperty11_VaultBalanceConservationAndPortfolioValue(
        uint256 _depositAmount1,
        uint256 _withdrawAmount1,
        uint256 _goalContrib1,
        uint256 _lockAmount1,
        uint256 _depositAmount2,
        uint256 _withdrawAmount2
    ) public {
        // Bound amounts to reasonable ranges
        uint256 depositAmount1 = bound(_depositAmount1, 1e18, INITIAL_TOKEN_BALANCE / 4);
        uint256 depositAmount2 = bound(_depositAmount2, 1e18, INITIAL_TOKEN_BALANCE / 4);
        uint256 withdrawAmount1 = bound(_withdrawAmount1, 0, depositAmount1);
        uint256 withdrawAmount2 = bound(_withdrawAmount2, 0, depositAmount2);
        
        // Calculate total system balance initially
        uint256 initialSystemBalance = token.balanceOf(user1) + token.balanceOf(user2) + token.balanceOf(address(vault));
        
        // User1 operations
        vm.prank(user1);
        vault.deposit(depositAmount1);
        
        // Verify balance conservation after deposit
        uint256 systemBalanceAfterDeposit = token.balanceOf(user1) + token.balanceOf(user2) + token.balanceOf(address(vault));
        assertEq(systemBalanceAfterDeposit, initialSystemBalance, "System balance should be conserved after deposit");
        
        // Verify available balance calculation
        assertEq(vault.availableBalance(user1), depositAmount1, "Available balance should equal deposited amount when no locks");
        assertEq(vault.portfolioValue(user1), depositAmount1, "Portfolio value should equal deposited amount initially");
        
        // User2 operations (should not affect user1)
        uint256 user1BalanceBeforeUser2Ops = vault.depositedBalance(user1);
        vm.prank(user2);
        vault.deposit(depositAmount2);
        
        assertEq(vault.depositedBalance(user1), user1BalanceBeforeUser2Ops, "User1 balance should be unchanged by user2 operations");
        
        // Test goal contribution if we have enough balance
        uint256 goalContrib1 = bound(_goalContrib1, 0, vault.availableBalance(user1));
        if (goalContrib1 > 0) {
            // Create goal first
            vm.prank(user1);
            vault.createGoal(goalContrib1 * 2, block.timestamp + 30 days);
            
            uint256 availableBefore = vault.availableBalance(user1);
            uint256 portfolioBefore = vault.portfolioValue(user1);
            
            vm.prank(user1);
            vault.contributeToGoal(0, goalContrib1);
            
            // Available balance should decrease by contribution
            assertEq(vault.availableBalance(user1), availableBefore - goalContrib1, "Available balance should decrease by goal contribution");
            // Portfolio value should remain the same (goal savings still count)
            assertEq(vault.portfolioValue(user1), portfolioBefore, "Portfolio value should remain unchanged after goal contribution");
        }
        
        // Test locked savings if we have enough available balance
        uint256 lockAmount1 = bound(_lockAmount1, 0, vault.availableBalance(user1));
        if (lockAmount1 > 0) {
            uint256 availableBefore = vault.availableBalance(user1);
            uint256 portfolioBefore = vault.portfolioValue(user1);
            uint256 lockedBefore = vault.lockedTotal(user1);
            
            vm.prank(user1);
            vault.lockFunds(lockAmount1, 7 days);
            
            // Available balance should decrease, locked total should increase
            assertEq(vault.availableBalance(user1), availableBefore - lockAmount1, "Available balance should decrease by locked amount");
            assertEq(vault.lockedTotal(user1), lockedBefore + lockAmount1, "Locked total should increase by locked amount");
            // Portfolio value should remain the same (locked funds still count)
            assertEq(vault.portfolioValue(user1), portfolioBefore, "Portfolio value should remain unchanged after locking funds");
        }
        
        // Test withdrawals
        if (withdrawAmount1 > 0 && withdrawAmount1 <= vault.availableBalance(user1)) {
            uint256 userTokensBefore = token.balanceOf(user1);
            uint256 vaultTokensBefore = token.balanceOf(address(vault));
            uint256 depositedBefore = vault.depositedBalance(user1);
            uint256 portfolioBefore = vault.portfolioValue(user1);
            
            vm.prank(user1);
            vault.withdraw(withdrawAmount1);
            
            // Verify token transfers
            assertEq(token.balanceOf(user1), userTokensBefore + withdrawAmount1, "User should receive withdrawn tokens");
            assertEq(token.balanceOf(address(vault)), vaultTokensBefore - withdrawAmount1, "Vault should lose withdrawn tokens");
            assertEq(vault.depositedBalance(user1), depositedBefore - withdrawAmount1, "Deposited balance should decrease");
            
            // Portfolio value should decrease by withdrawal amount
            assertEq(vault.portfolioValue(user1), portfolioBefore - withdrawAmount1, "Portfolio value should decrease by withdrawal amount");
        }
        
        if (withdrawAmount2 > 0 && withdrawAmount2 <= vault.availableBalance(user2)) {
            uint256 user1BalanceBeforeUser2Withdrawal = vault.depositedBalance(user1);
            
            vm.prank(user2);
            vault.withdraw(withdrawAmount2);
            
            // User1 balance should remain unchanged
            assertEq(vault.depositedBalance(user1), user1BalanceBeforeUser2Withdrawal, "User1 balance should be unchanged by user2 withdrawal");
        }
        
        // Final system balance check
        uint256 finalSystemBalance = token.balanceOf(user1) + token.balanceOf(user2) + token.balanceOf(address(vault));
        assertEq(finalSystemBalance, initialSystemBalance, "System balance should be conserved throughout all operations");
        
        // Verify available balance invariant: available = deposited - locked
        assertEq(vault.availableBalance(user1), vault.depositedBalance(user1) - vault.lockedTotal(user1), "Available balance invariant should hold for user1");
        assertEq(vault.availableBalance(user2), vault.depositedBalance(user2) - vault.lockedTotal(user2), "Available balance invariant should hold for user2");
    }
    
    /// @notice Test balance conservation during complex multi-user scenarios
    function testProperty11_MultiUserBalanceConservation(
        uint256 _numOperations,
        uint256 _operationSeed
    ) public {
        uint256 numOperations = bound(_numOperations, 1, 10);
        
        uint256 initialSystemBalance = token.balanceOf(user1) + token.balanceOf(user2) + token.balanceOf(address(vault));
        
        for (uint256 i = 0; i < numOperations; i++) {
            uint256 seed = uint256(keccak256(abi.encode(_operationSeed, i)));
            address user = (seed % 2 == 0) ? user1 : user2;
            uint256 operationType = seed % 4; // 0: deposit, 1: withdraw, 2: goal, 3: lock
            
            if (operationType == 0) {
                // Deposit operation
                uint256 amount = bound(seed >> 8, 1e17, 1e19); // 0.1 to 10 tokens
                if (token.balanceOf(user) >= amount) {
                    vm.prank(user);
                    vault.deposit(amount);
                }
            } else if (operationType == 1) {
                // Withdraw operation
                uint256 available = vault.availableBalance(user);
                if (available > 0) {
                    uint256 amount = bound(seed >> 8, 1, available);
                    vm.prank(user);
                    vault.withdraw(amount);
                }
            } else if (operationType == 2) {
                // Goal contribution
                uint256 available = vault.availableBalance(user);
                if (available > 1e17) {
                    // Create a goal first if user doesn't have one
                    uint256 goalId = vault.nextGoalId(user);
                    if (goalId == 0) {
                        vm.prank(user);
                        vault.createGoal(available * 2, block.timestamp + 30 days);
                    }
                    uint256 amount = bound(seed >> 8, 1e17, available / 2);
                    vm.prank(user);
                    vault.contributeToGoal(0, amount);
                }
            } else {
                // Lock funds
                uint256 available = vault.availableBalance(user);
                if (available > 1e17) {
                    uint256 amount = bound(seed >> 8, 1e17, available / 2);
                    vm.prank(user);
                    vault.lockFunds(amount, 1 days);
                }
            }
            
            // Verify balance conservation after each operation
            uint256 currentSystemBalance = token.balanceOf(user1) + token.balanceOf(user2) + token.balanceOf(address(vault));
            assertEq(currentSystemBalance, initialSystemBalance, "System balance should be conserved after each operation");
            
            // Verify invariants
            assertEq(vault.availableBalance(user1), vault.depositedBalance(user1) - vault.lockedTotal(user1), "Available balance invariant should hold for user1");
            assertEq(vault.availableBalance(user2), vault.depositedBalance(user2) - vault.lockedTotal(user2), "Available balance invariant should hold for user2");
        }
    }
    
    /// @notice Test that portfolio value correctly accounts for all user holdings
    function testProperty11_PortfolioValueAccuracy(
        uint256 _deposit,
        uint256 _goalContrib,
        uint256 _lockAmount
    ) public {
        uint256 deposit = bound(_deposit, 1e18, INITIAL_TOKEN_BALANCE / 2);
        
        // Initial state
        assertEq(vault.portfolioValue(user1), 0, "Initial portfolio value should be zero");
        
        // After deposit
        vm.prank(user1);
        vault.deposit(deposit);
        
        assertEq(vault.portfolioValue(user1), deposit, "Portfolio value should equal deposit amount");
        
        // After goal contribution
        uint256 goalContrib = bound(_goalContrib, 0, deposit / 2);
        if (goalContrib > 0) {
            vm.prank(user1);
            vault.createGoal(goalContrib * 2, block.timestamp + 30 days);
            
            vm.prank(user1);
            vault.contributeToGoal(0, goalContrib);
            
            // Portfolio value should remain the same (moved from deposited to goal savings)
            assertEq(vault.portfolioValue(user1), deposit, "Portfolio value should remain unchanged after goal contribution");
        }
        
        // After locking funds
        uint256 lockAmount = bound(_lockAmount, 0, vault.availableBalance(user1));
        if (lockAmount > 0) {
            vm.prank(user1);
            vault.lockFunds(lockAmount, 7 days);
            
            // Portfolio value should remain the same (locked funds still count)
            assertEq(vault.portfolioValue(user1), deposit, "Portfolio value should remain unchanged after locking funds");
        }
    }
    
    /// @notice Test edge case: zero balance operations
    function testProperty11_ZeroBalanceEdgeCases() public {
        // Available balance should be zero initially
        assertEq(vault.availableBalance(user1), 0, "Initial available balance should be zero");
        assertEq(vault.portfolioValue(user1), 0, "Initial portfolio value should be zero");
        
        // After deposit and full withdrawal
        uint256 amount = 1e18;
        vm.prank(user1);
        vault.deposit(amount);
        
        vm.prank(user1);
        vault.withdraw(amount);
        
        assertEq(vault.availableBalance(user1), 0, "Available balance should be zero after full withdrawal");
        assertEq(vault.portfolioValue(user1), 0, "Portfolio value should be zero after full withdrawal");
    }
}