// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Registry} from "../src/Registry.sol";
import {Education} from "../src/Education.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";

/**
 * @title ConfigureRoles
 * @notice Configures roles for deployed BFN contracts
 * 
 * This script grants necessary roles to accounts after deployment.
 * Customize the addresses and roles as needed.
 * 
 * Usage:
 *   forge script script/ConfigureRoles.s.sol:ConfigureRoles --rpc-url $BASE_SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast
 */
contract ConfigureRoles is Script {
    // Update these addresses after deployment
    address constant REGISTRY_ADDRESS = 0x0000000000000000000000000000000000000000;
    address constant EDUCATION_ADDRESS = 0x0000000000000000000000000000000000000000;
    
    // Accounts to grant roles to (update with actual addresses)
    address constant VERIFIER_ACCOUNT = 0x0000000000000000000000000000000000000000;
    address constant ISSUER_ACCOUNT = 0x0000000000000000000000000000000000000000;
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Validate addresses are set
        require(REGISTRY_ADDRESS != address(0), "Set REGISTRY_ADDRESS");
        require(EDUCATION_ADDRESS != address(0), "Set EDUCATION_ADDRESS");
        require(VERIFIER_ACCOUNT != address(0), "Set VERIFIER_ACCOUNT");
        require(ISSUER_ACCOUNT != address(0), "Set ISSUER_ACCOUNT");
        
        console.log("Configuring roles for BFN contracts...");
        
        vm.startBroadcast(deployerPrivateKey);
        
        Registry registry = Registry(REGISTRY_ADDRESS);
        Education education = Education(EDUCATION_ADDRESS);
        
        // Grant VERIFIER_ROLE to verification account
        bytes32 verifierRole = BFNRoles.VERIFIER_ROLE;
        if (!registry.hasRole(verifierRole, VERIFIER_ACCOUNT)) {
            registry.grantRole(verifierRole, VERIFIER_ACCOUNT);
            console.log("Granted VERIFIER_ROLE to:", VERIFIER_ACCOUNT);
        } else {
            console.log("VERIFIER_ROLE already granted to:", VERIFIER_ACCOUNT);
        }
        
        // Grant ISSUER_ROLE to certificate issuer account
        bytes32 issuerRole = BFNRoles.ISSUER_ROLE;
        if (!education.hasRole(issuerRole, ISSUER_ACCOUNT)) {
            education.grantRole(issuerRole, ISSUER_ACCOUNT);
            console.log("Granted ISSUER_ROLE to:", ISSUER_ACCOUNT);
        } else {
            console.log("ISSUER_ROLE already granted to:", ISSUER_ACCOUNT);
        }
        
        vm.stopBroadcast();
        
        console.log("Role configuration completed!");
    }
}