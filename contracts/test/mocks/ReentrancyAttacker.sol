// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CommunityTreasury} from "../../src/CommunityTreasury.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ReentrancyAttacker
 * @notice Mock contract to test reentrancy protection in CommunityTreasury
 * @dev Attempts to exploit reentrancy vulnerabilities in various functions
 */
contract ReentrancyAttacker {
    CommunityTreasury public immutable treasury;
    MockERC20 public immutable token;
    
    // Attack state variables
    bool private attacking;
    uint256 private attackPoolId;
    uint256 private attackAmount;
    uint256 private attackActionId;
    
    constructor(CommunityTreasury _treasury, MockERC20 _token) {
        treasury = _treasury;
        token = _token;
    }
    
    /**
     * Attempt reentrancy attack on contribute function
     */
    function attackContribute(uint256 poolId, uint256 amount) external {
        attackPoolId = poolId;
        attackAmount = amount;
        attacking = true;
        
        // This will trigger the receive() function during token transfer
        treasury.contribute(poolId, amount);
    }
    
    /**
     * Attempt reentrancy attack on contributeToPool function
     */
    function attackContributeToPool(uint256 poolId, uint256 amount) external {
        attackPoolId = poolId;
        attackAmount = amount;
        attacking = true;
        
        // This will trigger the receive() function during token transfer
        treasury.contributeToPool(poolId, amount);
    }
    
    /**
     * Attempt reentrancy attack on vote function
     */
    function attackVote(uint256 actionId) external {
        attackActionId = actionId;
        attacking = true;
        
        // This will trigger the receive() function if action gets executed
        treasury.vote(actionId);
    }
    
    /**
     * Receive function that attempts reentrancy when receiving tokens
     */
    receive() external payable {
        if (attacking) {
            attacking = false; // Prevent infinite recursion
            
            // Attempt to call back into treasury functions
            try treasury.contribute(attackPoolId, attackAmount) {
                // Should fail due to reentrancy guard
            } catch {}
            
            try treasury.contributeToPool(attackPoolId, attackAmount) {
                // Should fail due to reentrancy guard
            } catch {}
            
            try treasury.vote(attackActionId) {
                // Should fail due to reentrancy guard
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
            try treasury.contribute(attackPoolId, attackAmount) {
                // Should fail due to reentrancy guard
            } catch {}
        }
    }
}