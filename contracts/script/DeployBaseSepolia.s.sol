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
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployBaseSepolia
 * @notice Comprehensive deployment script for Base Sepolia (Chain ID: 84532)
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
    
    // Implementation contracts
    Registry private registryImpl;
    SavingsVault private savingsVaultImpl;
    CommunityTreasury private communityTreasuryImpl;
    Education private educationImpl;
    Governance private governanceImpl;
    MockERC20 private token;
    
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
        // Validate chain
        require(block.chainid == BASE_SEPOLIA_CHAIN_ID, 
            "ERROR: Expected Base Sepolia (chain ID 84532)");
        
        // Setup deployment environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== BFN Base Sepolia Deployment ===");
        console.log("Chain ID:      %d", block.chainid);
        console.log("Deployer:      %s", deployer);
        console.log("Block:         %d", block.number);
        console.log("Timestamp:     %d", block.timestamp);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Record deployment block
        deploymentBlock = block.number;
        
        // Phase 1: Deploy test token
        _deployToken();
        
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
        console.log("SUCCESS: All contracts deployed and configured successfully!");
    }
    
    /**
     * @dev Deploy test ERC20 token for Base Sepolia
     */
    function _deployToken() private {
        console.log("Phase 1: Deploying test token...");
        
        token = new MockERC20("Bonitah Test USD", "bUSD", 6);
        console.log("  MockERC20:    %s", address(token));
        
        // Validate deployment
        require(address(token) != address(0), "DEPLOYMENT_FAILED: MockERC20");
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
     * @dev Deploy UUPS proxies with proper initialization
     */
    function _deployProxies() private {
        console.log("Phase 3: Deploying UUPS proxies with initialization...");
        
        // Deploy Registry proxy
        bytes memory registryInitData = abi.encodeCall(Registry.initialize, (deployer));
        registryProxy = address(new ERC1967Proxy(address(registryImpl), registryInitData));
        console.log("  Registry proxy:        %s", registryProxy);
        require(registryProxy != address(0), "DEPLOYMENT_FAILED: Registry Proxy");
        
        // Deploy SavingsVault proxy
        bytes memory vaultInitData = abi.encodeCall(
            SavingsVault.initialize,
            (address(token), registryProxy, deployer)
        );
        savingsVaultProxy = address(new ERC1967Proxy(address(savingsVaultImpl), vaultInitData));
        console.log("  SavingsVault proxy:    %s", savingsVaultProxy);
        require(savingsVaultProxy != address(0), "DEPLOYMENT_FAILED: SavingsVault Proxy");
        
        // Deploy CommunityTreasury proxy
        bytes memory treasuryInitData = abi.encodeCall(
            CommunityTreasury.initialize,
            (deployer, IERC20(address(token)))
        );
        communityTreasuryProxy = address(new ERC1967Proxy(address(communityTreasuryImpl), treasuryInitData));
        console.log("  CommunityTreasury proxy: %s", communityTreasuryProxy);
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
     * @dev Record deployment addresses to deployment/base-sepolia.json
     */
    function _recordDeployment() private {
        console.log("Phase 5: Recording deployment addresses...");
        
        string memory deploymentJson = string(abi.encodePacked(
            "{\n",
            '  "chainId": ', Strings.toString(block.chainid), ",\n",
            '  "network": "Base Sepolia",\n',
            '  "deployedAt": {\n',
            '    "block": ', Strings.toString(deploymentBlock), ",\n",
            '    "timestamp": ', Strings.toString(block.timestamp), "\n",
            "  },\n",
            '  "deployer": "', Strings.toHexString(deployer), '",\n',
            '  "contracts": {\n',
            '    "Registry": {\n',
            '      "proxy": "', Strings.toHexString(registryProxy), '",\n',
            '      "implementation": "', Strings.toHexString(address(registryImpl)), '"\n',
            "    },\n",
            '    "SavingsVault": {\n',
            '      "proxy": "', Strings.toHexString(savingsVaultProxy), '",\n',
            '      "implementation": "', Strings.toHexString(address(savingsVaultImpl)), '"\n',
            "    },\n",
            '    "CommunityTreasury": {\n',
            '      "proxy": "', Strings.toHexString(communityTreasuryProxy), '",\n',
            '      "implementation": "', Strings.toHexString(address(communityTreasuryImpl)), '"\n',
            "    },\n",
            '    "Education": {\n',
            '      "proxy": "', Strings.toHexString(educationProxy), '",\n',
            '      "implementation": "', Strings.toHexString(address(educationImpl)), '"\n',
            "    },\n",
            '    "Governance": {\n',
            '      "proxy": "', Strings.toHexString(governanceProxy), '",\n',
            '      "implementation": "', Strings.toHexString(address(governanceImpl)), '"\n',
            "    }\n",
            "  },\n",
            '  "token": "', Strings.toHexString(address(token)), '"\n',
            "}"
        ));
        
        // Write deployment record using vm.writeFile
        string memory filePath = "./deployment/base-sepolia.json";
        vm.writeFile(filePath, deploymentJson);
        
        console.log("  Deployment recorded to: %s", filePath);
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
            Strings.toHexString(address(token)), " ",
            Strings.toString(deploymentBlock)
        ));
        
        console.log("%s", updateCommand);
    }
}