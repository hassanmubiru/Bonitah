// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Registry} from "../src/Registry.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {Education} from "../src/Education.sol";
import {Governance} from "../src/Governance.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployProxiesOnly
 * @notice Deploy only the UUPS proxies using already deployed implementations
 */
contract DeployProxiesOnly is Script {
    // Already deployed implementations on Base Sepolia
    address private constant REGISTRY_IMPL = 0x3CaC459c3b4013AEb64Cc60501498D441e025104;
    address private constant SAVINGS_VAULT_IMPL = 0x8d2f43c7D0ea45E6492eE075B2031AB28E83eCd1;
    address private constant COMMUNITY_TREASURY_IMPL = 0x4AAaCC58066Eb11E19E4B43C5c9ff6c1DD880D63;
    address private constant EDUCATION_IMPL = 0xc7B76755d433D084a1d91312c6192Fb41e74F172;
    address private constant GOVERNANCE_IMPL = 0xd216a50F4DE6985F2759709E8d505Cff486c9474;
    address private constant MOCK_ERC20 = 0x4FD1403945341786DBa53e31156C2dEdee40Ef34;
    
    // Chain ID validation
    uint256 private constant BASE_SEPOLIA_CHAIN_ID = 84532;
    
    // Deployed proxy addresses
    address private registryProxy;
    address private savingsVaultProxy;
    address private communityTreasuryProxy;
    address private educationProxy;
    address private governanceProxy;
    
    address private deployer;
    
    function run() external {
        // Validate chain
        require(block.chainid == BASE_SEPOLIA_CHAIN_ID, 
            "ERROR: Expected Base Sepolia (chain ID 84532)");
        
        // Setup deployment environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== BFN Proxy Deployment ===");
        console.log("Chain ID:      %d", block.chainid);
        console.log("Deployer:      %s", deployer);
        console.log("Block:         %d", block.number);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        _deployProxies();
        _configureRoles();
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("SUCCESS: All proxies deployed and configured successfully!");
        console.log("Registry proxy:        %s", registryProxy);
        console.log("SavingsVault proxy:    %s", savingsVaultProxy);
        console.log("CommunityTreasury proxy: %s", communityTreasuryProxy);
        console.log("Education proxy:       %s", educationProxy);
        console.log("Governance proxy:      %s", governanceProxy);
    }
    
    function _deployProxies() private {
        console.log("Deploying UUPS proxies with initialization...");
        
        // Deploy Registry proxy
        bytes memory registryInitData = abi.encodeCall(Registry.initialize, (deployer));
        registryProxy = address(new ERC1967Proxy(REGISTRY_IMPL, registryInitData));
        console.log("  Registry proxy:        %s", registryProxy);
        
        // Deploy SavingsVault proxy
        bytes memory vaultInitData = abi.encodeCall(
            SavingsVault.initialize,
            (MOCK_ERC20, registryProxy, deployer)
        );
        savingsVaultProxy = address(new ERC1967Proxy(SAVINGS_VAULT_IMPL, vaultInitData));
        console.log("  SavingsVault proxy:    %s", savingsVaultProxy);
        
        // Deploy CommunityTreasury proxy
        bytes memory treasuryInitData = abi.encodeCall(
            CommunityTreasury.initialize,
            (deployer, IERC20(MOCK_ERC20))
        );
        communityTreasuryProxy = address(new ERC1967Proxy(COMMUNITY_TREASURY_IMPL, treasuryInitData));
        console.log("  CommunityTreasury proxy: %s", communityTreasuryProxy);
        
        // Deploy Education proxy
        bytes memory educationInitData = abi.encodeCall(
            Education.initialize,
            (deployer, registryProxy)
        );
        educationProxy = address(new ERC1967Proxy(EDUCATION_IMPL, educationInitData));
        console.log("  Education proxy:       %s", educationProxy);
        
        // Deploy Governance proxy
        bytes memory governanceInitData = abi.encodeCall(
            Governance.initialize,
            (deployer, registryProxy)
        );
        governanceProxy = address(new ERC1967Proxy(GOVERNANCE_IMPL, governanceInitData));
        console.log("  Governance proxy:      %s", governanceProxy);
    }
    
    function _configureRoles() private {
        console.log("Configuring roles and permissions...");
        
        Registry registry = Registry(registryProxy);
        
        // Grant REPUTATION_ROLE to Education contract on Registry
        registry.grantRole(BFNRoles.REPUTATION_ROLE, educationProxy);
        console.log("  Granted REPUTATION_ROLE to Education");
        
        // Grant VERIFIER_ROLE to deployer (admin can transfer later)
        registry.grantRole(BFNRoles.VERIFIER_ROLE, deployer);
        console.log("  Granted VERIFIER_ROLE to deployer");
        
        // Grant ISSUER_ROLE to deployer on Education (admin can transfer later)
        Education(educationProxy).grantRole(BFNRoles.ISSUER_ROLE, deployer);
        console.log("  Granted ISSUER_ROLE to deployer on Education");
        
        console.log("  Role configuration completed");
    }
}