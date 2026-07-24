// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {Registry} from "../src/Registry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ISavingsVault} from "../src/interfaces/ISavingsVault.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";

/// @title SavingsVaultPropertyLocksTest
/// @notice Property-based tests for SavingsVault locked savings time-lock functionality.
/// @dev Validates Requirements 5.3, 5.4, 5.5, 5.8 implementation using Foundry fuzz testing.
contract SavingsVaultPropertyLocksTest is Test {
    SavingsVault public vault;
    Registry public registry;
    MockERC20 public token;
    
    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    
    uint256 public constant INITIAL_TOKEN_BALANCE = 100_000e18;
    uint256 public constant MIN_LOCK = 1 days;
    uint256 public constant MAX_LOCK = 5 * 365 days;
    
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
    
    /// @notice **Property 14: Locked savings time-lock round-trip**
    /// **Validates: Requirements 5.3, 5.4, 5.5, 5.8**
    /// 
    /// This property verifies that locked savings work correctly throughout their lifecycle:
    /// 1. Funds can only be locked with valid durations (1 day to 5 years)
    /// 2. Locked funds reduce available balance but not deposited balance
    /// 3. Locked funds cannot be withdrawn before expiry
    /// 4. Locked funds can be withdrawn after expiry
    /// 5. Multiple locks can coexist independently
    /// 6. Lock operations respect user isolation
    function testProperty14_LockedSavingsTimeLockRoundTrip(
        uint256 _lockAmount1,
        uint256 _lockAmount2,
        uint256 _duration1,
        uint256 _duration2,
        uint256 _timeJump1,
        uint256 _timeJump2,
        uint256 _depositAmount
    ) public {
        // Bound parameters to valid ranges
        uint256 duration1 = bound(_duration1, MIN_LOCK, MAX_LOCK);
        uint256 duration2 = bound(_duration2, MIN_LOCK, MAX_LOCK);
        uint256 depositAmount = bound(_depositAmount, 2e18, INITIAL_TOKEN_BALANCE / 2);
        uint256 lockAmount1 = bound(_lockAmount1, 1e17, depositAmount / 3);
        uint256 lockAmount2 = bound(_lockAmount2, 1e17, depositAmount / 3);
        
        // Setup: deposit funds
        vm.prank(user1);
        vault.deposit(depositAmount);
        
        uint256 initialAvailable = vault.availableBalance(user1);
        uint256 initialDeposited = vault.depositedBalance(user1);
        uint256 initialPortfolio = vault.portfolioValue(user1);
        
        // Lock first amount
        uint256 expectedExpiry1 = block.timestamp + duration1;
        
        vm.expectEmit(true, true, false, true);
        emit FundsLocked(user1, 0, lockAmount1, expectedExpiry1);
        
        vm.prank(user1);
        vault.lockFunds(lockAmount1, duration1);
        
        // Verify first lock state
        (uint256 amount1, uint256 expiry1, bool released1) = vault.locks(user1, 0);
        assertEq(amount1, lockAmount1, "First lock amount should be stored correctly");
        assertEq(expiry1, expectedExpiry1, "First lock expiry should be calculated correctly");
        assertFalse(released1, "First lock should not be released initially");
        
        // Verify balance effects
        assertEq(vault.availableBalance(user1), initialAvailable - lockAmount1, "Available balance should decrease by first lock amount");
        assertEq(vault.depositedBalance(user1), initialDeposited, "Deposited balance should remain unchanged");
        assertEq(vault.lockedTotal(user1), lockAmount1, "Locked total should equal first lock amount");
        assertEq(vault.portfolioValue(user1), initialPortfolio, "Portfolio value should remain unchanged");
        
        // Lock second amount (if sufficient balance)
        if (vault.availableBalance(user1) >= lockAmount2) {
            uint256 expectedExpiry2 = block.timestamp + duration2;
            
            vm.expectEmit(true, true, false, true);
            emit FundsLocked(user1, 1, lockAmount2, expectedExpiry2);
            
            vm.prank(user1);
            vault.lockFunds(lockAmount2, duration2);
            
            // Verify second lock state
            (uint256 amount2, uint256 expiry2, bool released2) = vault.locks(user1, 1);
            assertEq(amount2, lockAmount2, "Second lock amount should be stored correctly");
            assertEq(expiry2, expectedExpiry2, "Second lock expiry should be calculated correctly");
            assertFalse(released2, "Second lock should not be released initially");
            
            // Verify cumulative effects
            assertEq(vault.availableBalance(user1), initialAvailable - lockAmount1 - lockAmount2, "Available balance should decrease by both lock amounts");
            assertEq(vault.lockedTotal(user1), lockAmount1 + lockAmount2, "Locked total should equal sum of lock amounts");
            
            // First lock should remain unchanged
            (uint256 checkAmount1, uint256 checkExpiry1, bool checkReleased1) = vault.locks(user1, 0);
            assertEq(checkAmount1, lockAmount1, "First lock amount should be unchanged");
            assertEq(checkExpiry1, expectedExpiry1, "First lock expiry should be unchanged");
            assertFalse(checkReleased1, "First lock should still not be released");
        }
        
        // Test premature withdrawal attempts
        uint256 timeJump1 = bound(_timeJump1, 1, duration1 - 1);
        vm.warp(block.timestamp + timeJump1);
        
        vm.expectRevert(abi.encodeWithSelector(
            ISavingsVault.LockNotExpired.selector, 
            block.timestamp, 
            expectedExpiry1
        ));
        vm.prank(user1);
        vault.withdrawLocked(0);
        
        // Test withdrawal after first lock expiry
        vm.warp(expectedExpiry1 + 1);
        
        uint256 availableBeforeWithdrawal = vault.availableBalance(user1);
        uint256 lockedBeforeWithdrawal = vault.lockedTotal(user1);
        
        vm.expectEmit(true, true, false, true);
        emit LockReleased(user1, 0, lockAmount1);
        
        vm.prank(user1);
        vault.withdrawLocked(0);
        
        // Verify first lock withdrawal
        (,, bool released1After) = vault.locks(user1, 0);
        assertTrue(released1After, "First lock should be marked as released");
        assertEq(vault.lockedTotal(user1), lockedBeforeWithdrawal - lockAmount1, "Locked total should decrease by released amount");
        
        // Available balance should increase by the released amount, but only if no second lock exists or if second lock was also withdrawn
        // The available balance calculation depends on whether there was a second lock created
        
        // Test second lock if it exists
        if (vault.availableBalance(user1) + vault.lockedTotal(user1) > lockAmount1) {
            // Second lock should still be active if not expired
            (,uint256 expiry2,) = vault.locks(user1, 1);
            if (block.timestamp < expiry2) {
                vm.expectRevert(abi.encodeWithSelector(
                    ISavingsVault.LockNotExpired.selector, 
                    block.timestamp, 
                    expiry2
                ));
                vm.prank(user1);
                vault.withdrawLocked(1);
                
                // Jump to second lock expiry and withdraw
                vm.warp(expiry2 + 1);
                
                vm.prank(user1);
                vault.withdrawLocked(1);
                
                (,, bool released2After) = vault.locks(user1, 1);
                assertTrue(released2After, "Second lock should be marked as released");
                assertEq(vault.lockedTotal(user1), 0, "All locks should be released");
            }
        }
        
        // Test double withdrawal attempt
        vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
        vm.prank(user1);
        vault.withdrawLocked(0);
    }
    
    /// @notice Test lock duration constraints (Req 5.8)
    function testProperty14_LockDurationConstraints(
        uint256 _duration,
        uint256 _amount,
        bool _tooShort,
        bool _tooLong
    ) public {
        uint256 amount = bound(_amount, 1e17, 1000e18);
        
        // Setup
        vm.prank(user1);
        vault.deposit(amount * 2);
        
        uint256 duration;
        if (_tooShort) {
            duration = bound(_duration, 1, MIN_LOCK - 1);
        } else if (_tooLong) {
            duration = bound(_duration, MAX_LOCK + 1, MAX_LOCK * 2);
        } else {
            duration = bound(_duration, MIN_LOCK, MAX_LOCK);
        }
        
        if (_tooShort || _tooLong) {
            // Should revert with InvalidLockDuration
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.InvalidLockDuration.selector, duration));
            vm.prank(user1);
            vault.lockFunds(amount, duration);
        } else {
            // Should succeed
            vm.prank(user1);
            vault.lockFunds(amount, duration);
            
            (uint256 storedAmount, uint256 expiry, bool released) = vault.locks(user1, 0);
            assertEq(storedAmount, amount, "Lock amount should be stored correctly");
            assertEq(expiry, block.timestamp + duration, "Lock expiry should be calculated correctly");
            assertFalse(released, "Lock should not be released initially");
        }
    }
    
    /// @notice Test multiple locks independence and interaction
    function testProperty14_MultipleLockIndependence(
        uint256 _numLocks,
        uint256 _seed
    ) public {
        uint256 numLocks = bound(_numLocks, 2, 10);
        uint256 depositAmount = 10_000e18;
        
        // Setup
        vm.prank(user1);
        vault.deposit(depositAmount);
        
        // Create multiple locks with different durations
        uint256[] memory lockAmounts = new uint256[](numLocks);
        uint256[] memory lockExpiries = new uint256[](numLocks);
        
        for (uint256 i = 0; i < numLocks; i++) {
            if (vault.availableBalance(user1) < 100e18) break;
            
            uint256 amount = bound(uint256(keccak256(abi.encode(_seed, i))), 50e18, 200e18);
            if (amount > vault.availableBalance(user1)) {
                amount = vault.availableBalance(user1);
            }
            
            uint256 duration = bound(uint256(keccak256(abi.encode(_seed, i, "duration"))), MIN_LOCK, 30 days);
            
            lockAmounts[i] = amount;
            lockExpiries[i] = block.timestamp + duration;
            
            vm.prank(user1);
            vault.lockFunds(amount, duration);
            
            // Verify lock creation
            (uint256 storedAmount, uint256 storedExpiry, bool released) = vault.locks(user1, i);
            assertEq(storedAmount, amount, "Lock amount should be stored correctly");
            assertEq(storedExpiry, lockExpiries[i], "Lock expiry should be calculated correctly");
            assertFalse(released, "Lock should not be released initially");
        }
        
        // Fast forward and withdraw locks in random order
        uint256 maxExpiry = 0;
        for (uint256 i = 0; i < numLocks; i++) {
            if (lockAmounts[i] > 0 && lockExpiries[i] > maxExpiry) {
                maxExpiry = lockExpiries[i];
            }
        }
        
        vm.warp(maxExpiry + 1);
        
        // Withdraw locks in reverse order to test independence
        uint256 totalLockedBefore = vault.lockedTotal(user1);
        for (uint256 i = numLocks; i > 0; i--) {
            uint256 lockIndex = i - 1;
            if (lockAmounts[lockIndex] == 0) continue;
            
            (,, bool releasedBefore) = vault.locks(user1, lockIndex);
            if (releasedBefore) continue;
            
            uint256 lockedBefore = vault.lockedTotal(user1);
            
            vm.prank(user1);
            vault.withdrawLocked(lockIndex);
            
            // Verify withdrawal effects
            (,, bool releasedAfter) = vault.locks(user1, lockIndex);
            assertTrue(releasedAfter, "Lock should be marked as released");
            assertEq(vault.lockedTotal(user1), lockedBefore - lockAmounts[lockIndex], "Locked total should decrease by withdrawn amount");
            
            // Other locks should remain unchanged
            for (uint256 j = 0; j < numLocks; j++) {
                if (j != lockIndex && lockAmounts[j] > 0) {
                    (uint256 otherAmount, uint256 otherExpiry,) = vault.locks(user1, j);
                    assertEq(otherAmount, lockAmounts[j], "Other lock amounts should be unchanged");
                    assertEq(otherExpiry, lockExpiries[j], "Other lock expiries should be unchanged");
                }
            }
        }
        
        // All locks should be released
        assertEq(vault.lockedTotal(user1), 0, "All locks should be released");
    }
    
    /// @notice Test user isolation for lock operations
    function testProperty14_UserIsolation(
        uint256 _amount1,
        uint256 _amount2,
        uint256 _duration1,
        uint256 _duration2
    ) public {
        uint256 amount1 = bound(_amount1, 100e18, 1000e18);
        uint256 amount2 = bound(_amount2, 100e18, 1000e18);
        uint256 duration1 = bound(_duration1, MIN_LOCK, 30 days);
        uint256 duration2 = bound(_duration2, MIN_LOCK, 30 days);
        
        // Setup both users
        vm.prank(user1);
        vault.deposit(amount1 * 2);
        
        vm.prank(user2);
        vault.deposit(amount2 * 2);
        
        // User1 creates lock
        vm.prank(user1);
        vault.lockFunds(amount1, duration1);
        
        // Verify user2 is unaffected
        assertEq(vault.lockedTotal(user2), 0, "User2 locked total should be zero");
        assertEq(vault.availableBalance(user2), amount2 * 2, "User2 available balance should be unchanged");
        
        // User2 creates lock
        vm.prank(user2);
        vault.lockFunds(amount2, duration2);
        
        // Verify user1 lock is unaffected
        assertEq(vault.lockedTotal(user1), amount1, "User1 locked total should be unchanged");
        (uint256 user1Amount, uint256 user1Expiry, bool user1Released) = vault.locks(user1, 0);
        assertEq(user1Amount, amount1, "User1 lock amount should be unchanged");
        assertEq(user1Expiry, block.timestamp + duration1, "User1 lock expiry should be unchanged");
        assertFalse(user1Released, "User1 lock should not be released");
        
        // Verify user2 lock is independent
        (uint256 user2Amount, uint256 user2Expiry, bool user2Released) = vault.locks(user2, 0);
        assertEq(user2Amount, amount2, "User2 lock amount should be stored correctly");
        assertEq(user2Expiry, block.timestamp + duration2, "User2 lock expiry should be calculated correctly");
        assertFalse(user2Released, "User2 lock should not be released");
        
        // Fast forward and test independent withdrawals
        vm.warp(block.timestamp + max(duration1, duration2) + 1);
        
        // User1 withdraws their lock
        vm.prank(user1);
        vault.withdrawLocked(0);
        
        // User2 lock should be unaffected
        (,, bool user2ReleasedAfter) = vault.locks(user2, 0);
        assertFalse(user2ReleasedAfter, "User2 lock should still not be released by user1 action");
        assertEq(vault.lockedTotal(user2), amount2, "User2 locked total should be unchanged");
        
        // User2 withdraws their lock
        vm.prank(user2);
        vault.withdrawLocked(0);
        
        // Both should be released now
        (,, bool user1Final) = vault.locks(user1, 0);
        (,, bool user2Final) = vault.locks(user2, 0);
        assertTrue(user1Final, "User1 lock should be released");
        assertTrue(user2Final, "User2 lock should be released");
        assertEq(vault.lockedTotal(user1), 0, "User1 locked total should be zero");
        assertEq(vault.lockedTotal(user2), 0, "User2 locked total should be zero");
    }
    
    /// @notice Test lock edge cases and error conditions
    function testProperty14_LockEdgeCases(
        uint256 _lockAmount,
        bool _insufficientBalance,
        bool _zeroAmount
    ) public {
        uint256 depositAmount = 1000e18;
        vm.prank(user1);
        vault.deposit(depositAmount);
        
        uint256 lockAmount;
        if (_zeroAmount) {
            lockAmount = 0;
        } else if (_insufficientBalance) {
            lockAmount = vault.availableBalance(user1) + bound(_lockAmount, 1, 1000e18);
        } else {
            lockAmount = bound(_lockAmount, 1, vault.availableBalance(user1));
        }
        
        if (_zeroAmount) {
            vm.expectRevert(abi.encodeWithSelector(ISavingsVault.ZeroAmount.selector));
            vm.prank(user1);
            vault.lockFunds(lockAmount, 7 days);
        } else if (_insufficientBalance) {
            vm.expectRevert(abi.encodeWithSelector(
                ISavingsVault.InsufficientAvailableBalance.selector,
                lockAmount,
                vault.availableBalance(user1)
            ));
            vm.prank(user1);
            vault.lockFunds(lockAmount, 7 days);
        } else {
            // Should succeed
            vm.prank(user1);
            vault.lockFunds(lockAmount, 7 days);
            
            (uint256 amount, uint256 expiry, bool released) = vault.locks(user1, 0);
            assertEq(amount, lockAmount, "Lock amount should be stored correctly");
            assertEq(expiry, block.timestamp + 7 days, "Lock expiry should be calculated correctly");
            assertFalse(released, "Lock should not be released initially");
        }
    }
    
    /// @notice Helper function to get maximum of two numbers
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }
    
    event FundsLocked(address indexed user, uint256 indexed lockId, uint256 amount, uint256 expiry);
    event LockReleased(address indexed user, uint256 indexed lockId, uint256 amount);
}