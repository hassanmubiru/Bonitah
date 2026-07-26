// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {Registry} from "../src/Registry.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {Education} from "../src/Education.sol";
import {Governance} from "../src/Governance.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployBaseSepolia - Real Production Deployment
 * @notice Production deployment script for Base Sepolia using REAL USDC (Chain ID: 84532)
 * 
 * This deployment script uses the official USDC token on Base Sepolia instead of mock tokens.
 * USDC Address: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
 * 
 * Deploys all five BFN contracts behind UUPS proxies with proper initialization,
 * configures cross-contract dependencies and roles, records addresses to deployment/,
 * and exports to shared/ package. Uses require() for all-or-nothing deployment 
 * per Req 16.5, 16.6.
 * 
 * Usage:
 *   forge script script/DeployBaseSepolia.s.sol:DeployBaseSepolia \
 *     --rpc-url $BASE_SEPOLIA_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 * 
 * Environment Variables Required:
 *   - PRIVATE_KEY: Deployer private key
 *   - BASE_SEPOLIA_RPC_URL: RPC endpoint for Base Sepolia
 */
contract DeployBaseSepolia is Script {
    // Chain ID validation
    uint256 private constant BASE_SEPOLIA_CHAIN_ID = 84532;
    
    // REAL USDC Token Address on Base Sepolia (6 decimals)
    // This is the official Circle USDC deployment on Base Sepolia
    address private constant REAL_USDC_ADDRESS = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    
    // Implementation contracts
    Registry private registryImpl;
    SavingsVault private savingsVaultImpl;
    CommunityTreasury private communityTreasuryImpl;
    Education private educationImpl;
    Governance private governanceImpl;
    
    // Proxy addresses (the actual deployed contracts)
    address private registryProxy;
    address private savingsVaultProxy;
    address private communityTreasuryProxy;
    address private educationProxy;
    address private governanceProxy;
    
    // Deployment metadata
    address private deployer;
    uint256 private deploymentBlock;
    
    function run() external {
        console.log("Current chain ID:", block.chainid);
        console.log("Expected chain ID:", BASE_SEPOLIA_CHAIN_ID);
        
        // Validate chain
        require(block.chainid == BASE_SEPOLIA_CHAIN_ID, 
            "ERROR: Expected Base Sepolia (chain ID 84532)");
        
        // Setup deployment environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== BFN Base Sepolia PRODUCTION Deployment ===");
        console.log("Chain ID:      %d", block.chainid);
        console.log("Deployer:      %s", deployer);
        console.log("Block:         %d", block.number);
        console.log("Timestamp:     %d", block.timestamp);
        console.log("USDC Token:    %s (REAL Circle USDC)", REAL_USDC_ADDRESS);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Record deployment block
        deploymentBlock = block.number;
        
        // Phase 1: Validate REAL USDC token exists
        _validateRealToken();
        
        // Phase 2: Deploy implementation contracts
        _deployImplementations();
        
        // Phase 3: Deploy UUPS proxies with initialization
        _deployProxies();
        
        // Phase 4: Configure cross-contract permissions and roles
        _configureRoles();
        
        vm.stopBroadcast();
        
        // Phase 5: Record deployment addresses
        _recordDeployment();
        
        // Phase 6: Output for shared package update
        _outputSharedPackageUpdate();
        
        console.log("");
        console.log("SUCCESS: All contracts deployed with REAL USDC and configured successfully!");
    }
    
    /**
     * @dev Validate the real USDC token exists and has expected properties
     */
    function _validateRealToken() private view {
        console.log("Phase 1: Validating REAL USDC token...");
        
        // Verify the token contract exists
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(REAL_USDC_ADDRESS)
        }
        require(codeSize > 0, "VALIDATION_FAILED: REAL_USDC_ADDRESS has no contract code");
        
        // Verify it's an ERC20 by checking basic interface
        IERC20 usdc = IERC20(REAL_USDC_ADDRESS);
        try usdc.totalSupply() returns (uint256 supply) {
            console.log("  REAL USDC total supply: %d", supply);
        } catch {
            revert("VALIDATION_FAILED: REAL_USDC_ADDRESS does not implement ERC20");
        }
        
        console.log("  [OK] REAL USDC:    %s (validated)", REAL_USDC_ADDRESS);
    }
    
    /**
     * @dev Deploy all implementation contracts
     */
    function _deployImplementations() private {
        console.log("Phase 2: Deploying implementation contracts...");
        
        registryImpl = new Registry();
        console.log("  Registry impl:         %s", address(registryImpl));
        require(address(registryImpl) != address(0), "DEPLOYMENT_FAILED: Registry");
        
        savingsVaultImpl = new SavingsVault();
        console.log("  SavingsVault impl:     %s", address(savingsVaultImpl));
        require(address(savingsVaultImpl) != address(0), "DEPLOYMENT_FAILED: SavingsVault");
        
        communityTreasuryImpl = new CommunityTreasury();
        console.log("  CommunityTreasury impl: %s", address(communityTreasuryImpl));
        require(address(communityTreasuryImpl) != address(0), "DEPLOYMENT_FAILED: CommunityTreasury");
        
        educationImpl = new Education();
        console.log("  Education impl:        %s", address(educationImpl));
        require(address(educationImpl) != address(0), "DEPLOYMENT_FAILED: Education");
        
        governanceImpl = new Governance();
        console.log("  Governance impl:       %s", address(governanceImpl));
        require(address(governanceImpl) != address(0), "DEPLOYMENT_FAILED: Governance");
    }
    
    /**
     * @dev Deploy UUPS proxies with proper initialization using REAL USDC
     */
    function _deployProxies() private {
        console.log("Phase 3: Deploying UUPS proxies with REAL USDC integration...");
        
        // Deploy Registry proxy
        bytes memory registryInitData = abi.encodeCall(Registry.initialize, (deployer));
        registryProxy = address(new ERC1967Proxy(address(registryImpl), registryInitData));
        console.log("  Registry proxy:        %s", registryProxy);
        require(registryProxy != address(0), "DEPLOYMENT_FAILED: Registry Proxy");
        
        // Deploy SavingsVault proxy with REAL USDC
        bytes memory vaultInitData = abi.encodeCall(
            SavingsVault.initialize,
            (REAL_USDC_ADDRESS, registryProxy, deployer)
        );
        savingsVaultProxy = address(new ERC1967Proxy(address(savingsVaultImpl), vaultInitData));
        console.log("  SavingsVault proxy:    %s (using REAL USDC)", savingsVaultProxy);
        require(savingsVaultProxy != address(0), "DEPLOYMENT_FAILED: SavingsVault Proxy");
        
        // Deploy CommunityTreasury proxy with REAL USDC
        bytes memory treasuryInitData = abi.encodeCall(
            CommunityTreasury.initialize,
            (deployer, IERC20(REAL_USDC_ADDRESS))
        );
        communityTreasuryProxy = address(new ERC1967Proxy(address(communityTreasuryImpl), treasuryInitData));
        console.log("  CommunityTreasury proxy: %s (using REAL USDC)", communityTreasuryProxy);
        require(communityTreasuryProxy != address(0), "DEPLOYMENT_FAILED: CommunityTreasury Proxy");
        
        // Deploy Education proxy
        bytes memory educationInitData = abi.encodeCall(
            Education.initialize,
            (deployer, registryProxy)
        );
        educationProxy = address(new ERC1967Proxy(address(educationImpl), educationInitData));
        console.log("  Education proxy:       %s", educationProxy);
        require(educationProxy != address(0), "DEPLOYMENT_FAILED: Education Proxy");
        
        // Deploy Governance proxy
        bytes memory governanceInitData = abi.encodeCall(
            Governance.initialize,
            (deployer, registryProxy)
        );
        governanceProxy = address(new ERC1967Proxy(address(governanceImpl), governanceInitData));
        console.log("  Governance proxy:      %s", governanceProxy);
        require(governanceProxy != address(0), "DEPLOYMENT_FAILED: Governance Proxy");
    }
    
    /**
     * @dev Configure cross-contract roles and permissions
     */
    function _configureRoles() private {
        console.log("Phase 4: Configuring roles and permissions...");
        
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
    
    /**
     * @dev Record deployment addresses
     * Note: File writing disabled due to Foundry security restrictions
     */
    function _recordDeployment() private view {
        console.log("Phase 5: PRODUCTION deployment addresses recorded in logs...");
        
        // Just log the addresses for manual extraction
        console.log("=== PRODUCTION DEPLOYMENT RECORD ===");
        console.log("Chain ID: %d", block.chainid);
        console.log("Block: %d", deploymentBlock);
        console.log("Timestamp: %d", block.timestamp);
        console.log("Registry: %s", registryProxy);
        console.log("SavingsVault: %s", savingsVaultProxy);
        console.log("CommunityTreasury: %s", communityTreasuryProxy);
        console.log("Education: %s", educationProxy);
        console.log("Governance: %s", governanceProxy);
        console.log("USDC Token: %s (REAL Circle USDC)", REAL_USDC_ADDRESS);
        console.log("=====================================");
    }
    
    /**
     * @dev Output command to update shared package addresses
     */
    function _outputSharedPackageUpdate() private view {
        console.log("Phase 6: Shared package update command:");
        console.log("Run the following command to update shared addresses:");
        console.log("");
        
        string memory updateCommand = string(abi.encodePacked(
            "node scripts/update-addresses.js ",
            Strings.toString(block.chainid), " ",
            Strings.toHexString(registryProxy), " ",
            Strings.toHexString(savingsVaultProxy), " ",
            Strings.toHexString(communityTreasuryProxy), " ",
            Strings.toHexString(educationProxy), " ",
            Strings.toHexString(governanceProxy), " ",
            Strings.toHexString(REAL_USDC_ADDRESS), " ",
            Strings.toString(deploymentBlock)
        ));
        
        console.log("%s", updateCommand);
    }
}