// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SavingsVault} from "../../src/SavingsVault.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SavingsVaultReentrancyAttacker
 * @notice Mock contract to test reentrancy protection in SavingsVault
 * @dev Attempts to exploit reentrancy vulnerabilities in various SavingsVault functions
 */
contract SavingsVaultReentrancyAttacker {
    SavingsVault public immutable vault;
    MockERC20 public immutable token;
    
    // Attack state variables
    bool private attacking;
    uint256 private attackAmount;
    uint256 private attackGoalId;
    uint256 private attackLockId;
    uint256 private attackDuration;
    
    // Track attack attempts for verification
    uint256 public depositAttempts;
    uint256 public withdrawAttempts;
    uint256 public contributeAttempts;
    uint256 public lockAttempts;
    uint256 public unlockAttempts;
    
    constructor(SavingsVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;
    }
    
    /**
     * Setup function to approve vault to spend tokens
     */
    function setup(uint256 amount) external {
        token.approve(address(vault), amount);
    }
    
    /**
     * Attempt reentrancy attack on deposit function
     */
    function attackDeposit(uint256 amount) external {
        attackAmount = amount;
        attacking = true;
        
        vault.deposit(amount);
    }
    
    /**
     * Attempt reentrancy attack on withdraw function
     */
    function attackWithdraw(uint256 amount) external {
        attackAmount = amount;
        attacking = true;
        
        vault.withdraw(amount);
    }
    
    /**
     * Attempt reentrancy attack on contributeToGoal function
     */
    function attackContributeToGoal(uint256 goalId, uint256 amount) external {
        attackGoalId = goalId;
        attackAmount = amount;
        attacking = true;
        
        vault.contributeToGoal(goalId, amount);
    }
    
    /**
     * Attempt reentrancy attack on lockFunds function
     */
    function attackLockFunds(uint256 amount, uint256 duration) external {
        attackAmount = amount;
        attackDuration = duration;
        attacking = true;
        
        vault.lockFunds(amount, duration);
    }
    
    /**
     * Attempt reentrancy attack on withdrawLocked function
     */
    function attackWithdrawLocked(uint256 lockId) external {
        attackLockId = lockId;
        attacking = true;
        
        vault.withdrawLocked(lockId);
    }
    
    /**
     * Receive function that attempts reentrancy when receiving tokens
     * This gets called during token transfers out of the vault
     */
    receive() external payable {
        if (attacking) {
            attacking = false; // Prevent infinite recursion
            
            // Attempt to call back into vault functions
            try vault.deposit(attackAmount) {
                depositAttempts++;
            } catch {}
            
            try vault.withdraw(attackAmount) {
                withdrawAttempts++;
            } catch {}
            
            try vault.contributeToGoal(attackGoalId, attackAmount) {
                contributeAttempts++;
            } catch {}
            
            try vault.lockFunds(attackAmount, attackDuration) {
                lockAttempts++;
            } catch {}
            
            try vault.withdrawLocked(attackLockId) {
                unlockAttempts++;
            } catch {}
        }
    }
    
    /**
     * Fallback function for any other calls
     */
    fallback() external payable {
        if (attacking) {
            attacking = false; // Prevent infinite recursion
            
            // Attempt reentrancy on fallback
            try vault.deposit(attackAmount) {
                depositAttempts++;
            } catch {}
            
            try vault.withdraw(attackAmount) {
                withdrawAttempts++;
            } catch {}
        }
    }
    
    /**
     * Reset attack attempt counters
     */
    function resetCounters() external {
        depositAttempts = 0;
        withdrawAttempts = 0;
        contributeAttempts = 0;
        lockAttempts = 0;
        unlockAttempts = 0;
    }
}