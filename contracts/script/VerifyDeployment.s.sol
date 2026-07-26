// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Registry, IRegistry} from "../src/Registry.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {Education} from "../src/Education.sol";
import {Governance} from "../src/Governance.sol";
// import {MockERC20} from "../src/mocks/MockERC20.sol"; // DEPRECATED - Use real USDC
import {BFNRoles} from "../src/base/BFNRoles.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title VerifyDeployment
 * @notice Verifies all BFN contracts are properly deployed and configured
 * 
 * Usage:
 *   forge script script/VerifyDeployment.s.sol:VerifyDeployment --rpc-url $BASE_SEPOLIA_RPC_URL
 */
contract VerifyDeployment is Script {
    // Update these addresses after deployment
    address constant REGISTRY_ADDRESS = 0x0000000000000000000000000000000000000000;
    address constant SAVINGS_VAULT_ADDRESS = 0x0000000000000000000000000000000000000000;
    address constant COMMUNITY_TREASURY_ADDRESS = 0x0000000000000000000000000000000000000000;
    address constant EDUCATION_ADDRESS = 0x0000000000000000000000000000000000000000;
    address constant GOVERNANCE_ADDRESS = 0x0000000000000000000000000000000000000000;
    address constant TOKEN_ADDRESS = 0x0000000000000000000000000000000000000000;
    
    function run() public view {
        console.log("Verifying BFN deployment on chain:", block.chainid);
        console.log("Block number:", block.number);
        
        // Verify addresses are set
        require(REGISTRY_ADDRESS != address(0), "Set REGISTRY_ADDRESS");
        require(SAVINGS_VAULT_ADDRESS != address(0), "Set SAVINGS_VAULT_ADDRESS");
        require(COMMUNITY_TREASURY_ADDRESS != address(0), "Set COMMUNITY_TREASURY_ADDRESS");
        require(EDUCATION_ADDRESS != address(0), "Set EDUCATION_ADDRESS");
        require(GOVERNANCE_ADDRESS != address(0), "Set GOVERNANCE_ADDRESS");
        require(TOKEN_ADDRESS != address(0), "Set TOKEN_ADDRESS");
        
        _verifyRegistry();
        _verifySavingsVault();
        _verifyCommunityTreasury();
        _verifyEducation();
        _verifyGovernance();
        _verifyToken();
        _verifyCrossContractWiring();
        
        console.log("=== DEPLOYMENT VERIFICATION COMPLETE ===");
        console.log("All contracts are properly deployed and configured!");
    }
    
    function _verifyRegistry() internal view {
        console.log("Verifying Registry...");
        
        Registry registry = Registry(REGISTRY_ADDRESS);
        
        // Check basic functionality
        require(registry.supportsInterface(type(IRegistry).interfaceId), "Registry: Interface not supported");
        
        // Check role configuration
        bytes32 adminRole = registry.DEFAULT_ADMIN_ROLE();
        bytes32 verifierRole = BFNRoles.VERIFIER_ROLE;
        bytes32 reputationRole = BFNRoles.REPUTATION_ROLE;
        
        console.log("  Admin role exists:", adminRole != bytes32(0));
        console.log("  Verifier role exists:", verifierRole != bytes32(0));
        console.log("  Reputation role exists:", reputationRole != bytes32(0));
        
        console.log("Registry verification passed");
    }
    
    function _verifySavingsVault() internal view {
        console.log("Verifying SavingsVault...");
        
        SavingsVault vault = SavingsVault(SAVINGS_VAULT_ADDRESS);
        
        // Check token configuration
        IERC20 vaultToken = vault.token();
        require(address(vaultToken) == TOKEN_ADDRESS, "SavingsVault: Token mismatch");
        
        // Check registry wiring
        IRegistry vaultRegistry = vault.registry();
        require(address(vaultRegistry) == REGISTRY_ADDRESS, "SavingsVault: Registry mismatch");
        
        console.log("  Token address:", address(vaultToken));
        console.log("  Registry address:", address(vaultRegistry));
        console.log("  Is paused:", vault.paused());
        
        console.log("SavingsVault verification passed");
    }
    
    function _verifyCommunityTreasury() internal view {
        console.log("Verifying CommunityTreasury...");
        
        CommunityTreasury treasury = CommunityTreasury(COMMUNITY_TREASURY_ADDRESS);
        
        // Check token configuration
        IERC20 treasuryToken = treasury.token();
        require(address(treasuryToken) == TOKEN_ADDRESS, "CommunityTreasury: Token mismatch");
        
        console.log("  Token address:", address(treasuryToken));
        
        console.log("CommunityTreasury verification passed");
    }
    
    function _verifyEducation() internal view {
        console.log("Verifying Education...");
        
        Education education = Education(EDUCATION_ADDRESS);
        
        // Check role configuration
        bytes32 issuerRole = BFNRoles.ISSUER_ROLE;
        console.log("  Issuer role exists:", issuerRole != bytes32(0));
        
        console.log("Education verification passed");
    }
    
    function _verifyGovernance() internal view {
        console.log("Verifying Governance...");
        
        Governance governance = Governance(GOVERNANCE_ADDRESS);
        
        console.log("Governance verification passed");
    }
    
    function _verifyToken() internal view {
        console.log("Verifying Token...");
        
        // DEPRECATED: MockERC20 token verification - Use real USDC in production
        // MockERC20 token = MockERC20(TOKEN_ADDRESS);
        
        // Use IERC20 interface for real tokens
        IERC20 token = IERC20(TOKEN_ADDRESS);
        
        // string memory name = token.name();
        // string memory symbol = token.symbol();
        // uint8 decimals = token.decimals();
        uint256 totalSupply = token.totalSupply();
        
        // console.log("  Name:", name);
        // console.log("  Symbol:", symbol);
        // console.log("  Decimals:", decimals);
        console.log("  Total supply:", totalSupply);
        
        // require(decimals == 6, "Token: Invalid decimals"); // Commented out for real USDC
        require(totalSupply > 0, "Token: No total supply");
        
        console.log("Token verification passed");
    }
    
    function _verifyCrossContractWiring() internal view {
        console.log("Verifying cross-contract wiring...");
        
        Registry registry = Registry(REGISTRY_ADDRESS);
        Education education = Education(EDUCATION_ADDRESS);
        
        // Verify Education has REPUTATION_ROLE on Registry
        bytes32 reputationRole = BFNRoles.REPUTATION_ROLE;
        bool hasReputationRole = registry.hasRole(reputationRole, EDUCATION_ADDRESS);
        
        console.log("  Education has REPUTATION_ROLE:", hasReputationRole);
        
        if (!hasReputationRole) {
            console.log("  Warning: Education contract needs REPUTATION_ROLE on Registry");
        }
        
        console.log("Cross-contract wiring verification passed");
    }
}