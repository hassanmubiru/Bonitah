// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * @title DeployMockToken - DEPRECATED
 * @notice This script is DEPRECATED and should not be used.
 * 
 * BFN now uses REAL USDC token on Base Sepolia:
 * Address: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
 * 
 * Use the real USDC deployment for all production operations.
 * This file is kept for historical reference only.
 */

import {Script, console} from "forge-std/Script.sol";

contract DeployMockToken_DEPRECATED is Script {
    error ScriptDeprecated();
    
    function run() public {
        console.log("ERROR: This script is deprecated!");
        console.log("BFN now uses REAL USDC on Base Sepolia:");
        console.log("Address: 0x036CbD53842c5426634e7929541eC2318f3dCF7e");
        console.log("Use DeployBaseSepolia.s.sol for production deployments.");
        
        revert ScriptDeprecated();
    }
}