// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockERC20 - DEPRECATED
 * @notice This mock token is DEPRECATED and should not be used in production.
 * 
 * BFN now uses REAL USDC token on Base Sepolia:
 * Address: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
 * 
 * This file is kept for historical reference only.
 * All production deployments should use the real USDC contract.
 */

// This contract is intentionally left empty to prevent accidental use
contract MockERC20_DEPRECATED {
    error ContractDeprecated();
    
    constructor() {
        revert ContractDeprecated();
    }
}
