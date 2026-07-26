// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Registry} from "../src/Registry.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {Education} from "../src/Education.sol";
import {Governance} from "../src/Governance.sol";
// import {MockERC20} from "../src/mocks/MockERC20.sol"; // REMOVED - Using real USDC only
import {BFNRoles} from "../src/base/BFNRoles.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Deploy
 * @notice Deploys all BFN contracts with UUPS proxies to Base Sepolia
 * 
 * This script deploys all five main contracts behind UUPS proxies, configures
 * initial roles, and outputs deployment addresses for the shared package.
 * 
 * Usage:
 *   forge script script/Deploy.s.sol:Deploy --rpc-url $BASE_SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast --verify
 */
contract Deploy is Script {
    // Contract instances
    Registry public registry;
    SavingsVault public savingsVault;  
    CommunityTreasury public communityTreasury;
    Education public education;
    Governance public governance;
    // MockERC20 public token; // DEPRECATED - Use real USDC in production
    
    // Proxy addresses
    address public registryProxy;
    address public savingsVaultProxy;
    address public communityTreasuryProxy;
    address public educationProxy;
    address public governanceProxy;
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying BFN contracts to Base Sepolia...");
        console.log("Deployer address:", deployer);
        console.log("Chain ID:", block.chainid);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // NOTE: This script is deprecated and cannot be used. Use DeployBaseSepolia.s.sol instead.
        console.log("ERROR: This script is deprecated. Use DeployBaseSepolia.s.sol for production deployment.");
        revert("Use DeployBaseSepolia.s.sol for production deployment with real USDC");
    }
    
    function _configurePermissions(address /* deployer */) internal {
        console.log("Configuring cross-contract permissions...");
        
        // Grant REPUTATION_ROLE to Education contract on Registry
        Registry(registryProxy).grantRole(
            BFNRoles.REPUTATION_ROLE,
            educationProxy
        );
        
        console.log("Granted REPUTATION_ROLE to Education contract");
        
        // Additional role configurations can be added here
    }
    
    function _outputDeploymentInfo() internal pure {
        console.log("");
        console.log("=== DEPRECATED SCRIPT ===");
        console.log("This script cannot be used. Use DeployBaseSepolia.s.sol instead.");
        console.log("");
    }
    
    function _updateSharedPackage() internal pure {
        console.log("To deploy with real USDC, use:");
        console.log("forge script script/DeployBaseSepolia.s.sol:DeployBaseSepolia --rpc-url $BASE_SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast --verify");
    }
}