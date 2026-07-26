// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

// Core BFN Contracts
import {Registry} from "../src/Registry.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {Education} from "../src/Education.sol";
import {Governance} from "../src/Governance.sol";

// New On-Chain Backend Contracts
import {EducationContent} from "../src/EducationContent.sol";
import {ConversationManager} from "../src/ConversationManager.sol";
import {EventIndexer} from "../src/EventIndexer.sol";

import {BFNRoles} from "../src/base/BFNRoles.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployFullOnChain - Complete On-Chain Backend Deployment
 * @notice Deploys all BFN contracts + on-chain backend services using REAL USDC
 * 
 * This deployment script creates a fully decentralized BFN platform with:
 * - Core financial contracts (Registry, SavingsVault, CommunityTreasury, Education, Governance)
 * - On-chain backend services (EducationContent, ConversationManager, EventIndexer)
 * - No off-chain dependencies for critical functionality
 * - Complete smart contract-based architecture
 * 
 * Usage:
 *   forge script script/DeployFullOnChain.s.sol:DeployFullOnChain \
 *     --rpc-url $BASE_SEPOLIA_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 */
contract DeployFullOnChain is Script {
    // Chain ID validation
    uint256 private constant BASE_SEPOLIA_CHAIN_ID = 84532;
    
    // REAL USDC Token Address on Base Sepolia
    address private constant REAL_USDC_ADDRESS = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    
    // Core contract implementations
    Registry private registryImpl;
    SavingsVault private savingsVaultImpl;
    CommunityTreasury private communityTreasuryImpl;
    Education private educationImpl;
    Governance private governanceImpl;
    
    // Backend contract implementations
    EducationContent private educationContentImpl;
    ConversationManager private conversationManagerImpl;
    EventIndexer private eventIndexerImpl;
    
    // Proxy addresses
    address private registryProxy;
    address private savingsVaultProxy;
    address private communityTreasuryProxy;
    address private educationProxy;
    address private governanceProxy;
    address private educationContentProxy;
    address private conversationManagerProxy;
    address private eventIndexerProxy;
    
    address private deployer;
    uint256 private deploymentBlock;
    
    function run() external {
        console.log("Current chain ID:", block.chainid);
        console.log("Expected chain ID:", BASE_SEPOLIA_CHAIN_ID);
        
        require(block.chainid == BASE_SEPOLIA_CHAIN_ID, 
            "ERROR: Expected Base Sepolia (chain ID 84532)");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== BFN FULL ON-CHAIN DEPLOYMENT ===");
        console.log("Chain ID:      %d", block.chainid);
        console.log("Deployer:      %s", deployer);
        console.log("Block:         %d", block.number);
        console.log("USDC Token:    %s (REAL Circle USDC)", REAL_USDC_ADDRESS);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        deploymentBlock = block.number;
        
        // Phase 1: Validate REAL USDC
        _validateRealToken();
        
        // Phase 2: Deploy core contract implementations
        _deployCoreImplementations();
        
        // Phase 3: Deploy backend contract implementations  
        _deployBackendImplementations();
        
        // Phase 4: Deploy core proxies
        _deployCoreProxies();
        
        // Phase 5: Deploy backend proxies
        _deployBackendProxies();
        
        // Phase 6: Configure roles and cross-contract dependencies
        _configureSystem();
        
        vm.stopBroadcast();
        
        // Phase 7: Output deployment information
        _outputDeploymentInfo();
        
        console.log("");
        console.log("SUCCESS: Full on-chain BFN platform deployed!");
    }
    
    function _validateRealToken() private view {
        console.log("Phase 1: Validating REAL USDC token...");
        
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(REAL_USDC_ADDRESS)
        }
        require(codeSize > 0, "VALIDATION_FAILED: REAL_USDC_ADDRESS has no contract code");
        
        IERC20 usdc = IERC20(REAL_USDC_ADDRESS);
        try usdc.totalSupply() returns (uint256 supply) {
            console.log("  REAL USDC total supply: %d", supply);
        } catch {
            revert("VALIDATION_FAILED: REAL_USDC_ADDRESS does not implement ERC20");
        }
        
        console.log("  [OK] REAL USDC validated");
    }
    
    function _deployCoreImplementations() private {
        console.log("Phase 2: Deploying core contract implementations...");
        
        registryImpl = new Registry();
        console.log("  Registry impl:           %s", address(registryImpl));
        
        savingsVaultImpl = new SavingsVault();
        console.log("  SavingsVault impl:       %s", address(savingsVaultImpl));
        
        communityTreasuryImpl = new CommunityTreasury();
        console.log("  CommunityTreasury impl:  %s", address(communityTreasuryImpl));
        
        educationImpl = new Education();
        console.log("  Education impl:          %s", address(educationImpl));
        
        governanceImpl = new Governance();
        console.log("  Governance impl:         %s", address(governanceImpl));
    }
    
    function _deployBackendImplementations() private {
        console.log("Phase 3: Deploying on-chain backend implementations...");
        
        educationContentImpl = new EducationContent();
        console.log("  EducationContent impl:   %s", address(educationContentImpl));
        
        conversationManagerImpl = new ConversationManager();
        console.log("  ConversationManager impl: %s", address(conversationManagerImpl));
        
        eventIndexerImpl = new EventIndexer();
        console.log("  EventIndexer impl:       %s", address(eventIndexerImpl));
    }
    
    function _deployCoreProxies() private {
        console.log("Phase 4: Deploying core UUPS proxies...");
        
        // Registry
        bytes memory registryInitData = abi.encodeCall(Registry.initialize, (deployer));
        registryProxy = address(new ERC1967Proxy(address(registryImpl), registryInitData));
        console.log("  Registry proxy:          %s", registryProxy);
        
        // SavingsVault
        bytes memory vaultInitData = abi.encodeCall(
            SavingsVault.initialize,
            (REAL_USDC_ADDRESS, registryProxy, deployer)
        );
        savingsVaultProxy = address(new ERC1967Proxy(address(savingsVaultImpl), vaultInitData));
        console.log("  SavingsVault proxy:      %s", savingsVaultProxy);
        
        // CommunityTreasury
        bytes memory treasuryInitData = abi.encodeCall(
            CommunityTreasury.initialize,
            (deployer, IERC20(REAL_USDC_ADDRESS))
        );
        communityTreasuryProxy = address(new ERC1967Proxy(address(communityTreasuryImpl), treasuryInitData));
        console.log("  CommunityTreasury proxy: %s", communityTreasuryProxy);
        
        // Education
        bytes memory educationInitData = abi.encodeCall(
            Education.initialize,
            (deployer, registryProxy)
        );
        educationProxy = address(new ERC1967Proxy(address(educationImpl), educationInitData));
        console.log("  Education proxy:         %s", educationProxy);
        
        // Governance
        bytes memory governanceInitData = abi.encodeCall(
            Governance.initialize,
            (deployer, registryProxy)
        );
        governanceProxy = address(new ERC1967Proxy(address(governanceImpl), governanceInitData));
        console.log("  Governance proxy:        %s", governanceProxy);
    }
    
    function _deployBackendProxies() private {
        console.log("Phase 5: Deploying on-chain backend proxies...");
        
        // EducationContent
        bytes memory educationContentInitData = abi.encodeCall(
            EducationContent.initialize,
            (deployer, registryProxy)
        );
        educationContentProxy = address(new ERC1967Proxy(address(educationContentImpl), educationContentInitData));
        console.log("  EducationContent proxy:  %s", educationContentProxy);
        
        // ConversationManager
        bytes memory conversationInitData = abi.encodeCall(
            ConversationManager.initialize,
            (deployer, registryProxy)
        );
        conversationManagerProxy = address(new ERC1967Proxy(address(conversationManagerImpl), conversationInitData));
        console.log("  ConversationManager proxy: %s", conversationManagerProxy);
        
        // EventIndexer
        bytes memory indexerInitData = abi.encodeCall(
            EventIndexer.initialize,
            (deployer)
        );
        eventIndexerProxy = address(new ERC1967Proxy(address(eventIndexerImpl), indexerInitData));
        console.log("  EventIndexer proxy:      %s", eventIndexerProxy);
    }
    
    function _configureSystem() private {
        console.log("Phase 6: Configuring system roles and dependencies...");
        
        Registry registry = Registry(registryProxy);
        
        // Core role configuration
        registry.grantRole(BFNRoles.REPUTATION_ROLE, educationProxy);
        registry.grantRole(BFNRoles.VERIFIER_ROLE, deployer);
        Education(educationProxy).grantRole(BFNRoles.ISSUER_ROLE, deployer);
        
        // Backend service roles
        EducationContent(educationContentProxy).grantRole(BFNRoles.ISSUER_ROLE, deployer);
        ConversationManager(conversationManagerProxy).grantRole(BFNRoles.DEFAULT_ADMIN_ROLE, deployer);
        EventIndexer(eventIndexerProxy).grantRole(BFNRoles.DEFAULT_ADMIN_ROLE, deployer);
        
        console.log("  Core roles configured");
        console.log("  Backend service roles configured");
        console.log("  System ready for on-chain operation");
    }
    
    function _outputDeploymentInfo() private view {
        console.log("Phase 7: Deployment complete!");
        console.log("");
        console.log("=== FULL ON-CHAIN DEPLOYMENT ADDRESSES ===");
        console.log("Chain ID: %d", block.chainid);
        console.log("Block: %d", deploymentBlock);
        console.log("Deployer: %s", deployer);
        console.log("");
        console.log("=== CORE FINANCIAL CONTRACTS ===");
        console.log("Registry:           %s", registryProxy);
        console.log("SavingsVault:       %s", savingsVaultProxy);
        console.log("CommunityTreasury:  %s", communityTreasuryProxy);
        console.log("Education:          %s", educationProxy);
        console.log("Governance:         %s", governanceProxy);
        console.log("");
        console.log("=== ON-CHAIN BACKEND SERVICES ===");
        console.log("EducationContent:   %s", educationContentProxy);
        console.log("ConversationManager: %s", conversationManagerProxy);
        console.log("EventIndexer:       %s", eventIndexerProxy);
        console.log("");
        console.log("=== REAL ASSET INTEGRATION ===");
        console.log("USDC Token:         %s (REAL Circle USDC)", REAL_USDC_ADDRESS);
        console.log("");
        console.log("=== PLATFORM FEATURES ===");
        console.log("✅ Fully decentralized backend");
        console.log("✅ On-chain course management");
        console.log("✅ On-chain chat history");
        console.log("✅ On-chain event indexing");
        console.log("✅ Real USDC integration");
        console.log("✅ Zero off-chain dependencies");
        console.log("");
        
        // Update command for shared package
        string memory updateCommand = string(abi.encodePacked(
            "Update shared/addresses.ts with all contract addresses including backend services"
        ));
        console.log("Next step: %s", updateCommand);
    }
}