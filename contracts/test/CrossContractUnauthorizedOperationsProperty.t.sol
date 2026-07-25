// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Registry} from "../src/Registry.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {ICommunityTreasury} from "../src/interfaces/ICommunityTreasury.sol";
import {Governance} from "../src/Governance.sol";
import {IGovernance} from "../src/interfaces/IGovernance.sol";
import {Education} from "../src/Education.sol";
import {IEducation} from "../src/interfaces/IEducation.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";

/// @title CrossContractUnauthorizedOperationsPropertyTest
/// @notice Property-based tests for unauthorized privileged operations across all BFN contracts.
/// @dev **Property 26: Unauthorized privileged operations revert without state change**
/// **Validates: Requirements 3.10, 6.5, 9.7, 9.10, 14.5, 14.7, 14.9**
/// 
/// This test validates that:
/// - Registry role-based operations (VERIFIER_ROLE, REPUTATION_ROLE) reject unauthorized calls
/// - CommunityTreasury admin operations reject unauthorized calls  
/// - Governance treasury operations (TREASURY_ROLE) reject unauthorized calls
/// - Education certificate operations (ISSUER_ROLE) reject unauthorized calls
/// - UUPS upgrade operations (UPGRADER_ROLE) reject unauthorized calls
/// - All unauthorized operations revert without changing contract state
/// 
/// Uses Foundry's fuzzing with minimum 100 iterations to test various unauthorized addresses.
contract CrossContractUnauthorizedOperationsPropertyTest is Test {
    // Contract instances
    Registry public registry;
    CommunityTreasury public communityTreasury;  
    Governance public governance;
    Education public education;
    SavingsVault public savingsVault;
    MockERC20 public token;

    // Test addresses
    address public admin = makeAddr("admin");
    address public authorizedUser = makeAddr("authorizedUser");
    
    // Test constants
    uint256 public constant INITIAL_BALANCE = 10_000e18;
    
    function setUp() public {
        // Deploy mock ERC20 token
        token = new MockERC20("Test Token", "TEST", 18);
        
        // Deploy Registry
        Registry registryImpl = new Registry();
        bytes memory registryInitData = abi.encodeCall(Registry.initialize, (admin));
        ERC1967Proxy registryProxy = new ERC1967Proxy(address(registryImpl), registryInitData);
        registry = Registry(address(registryProxy));
        
        // Deploy CommunityTreasury
        CommunityTreasury treasuryImpl = new CommunityTreasury();
        bytes memory treasuryInitData = abi.encodeCall(CommunityTreasury.initialize, (admin, IERC20(address(token))));
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(address(treasuryImpl), treasuryInitData);
        communityTreasury = CommunityTreasury(address(treasuryProxy));
        
        // Deploy Governance
        Governance governanceImpl = new Governance();
        bytes memory governanceInitData = abi.encodeCall(Governance.initialize, (admin, address(registry)));
        ERC1967Proxy governanceProxy = new ERC1967Proxy(address(governanceImpl), governanceInitData);
        governance = Governance(address(governanceProxy));
        
        // Deploy Education
        Education educationImpl = new Education();
        bytes memory educationInitData = abi.encodeCall(Education.initialize, (admin, address(registry)));
        ERC1967Proxy educationProxy = new ERC1967Proxy(address(educationImpl), educationInitData);
        education = Education(address(educationProxy));
        
        // Deploy SavingsVault
        SavingsVault vaultImpl = new SavingsVault();
        bytes memory vaultInitData = abi.encodeCall(SavingsVault.initialize, (address(token), address(registry), admin));
        ERC1967Proxy vaultProxy = new ERC1967Proxy(address(vaultImpl), vaultInitData);
        savingsVault = SavingsVault(address(vaultProxy));
        
        // Grant some roles to authorized user for state change validation
        vm.startPrank(admin);
        registry.grantRole(BFNRoles.VERIFIER_ROLE, authorizedUser);
        registry.grantRole(BFNRoles.REPUTATION_ROLE, authorizedUser);
        governance.grantRole(BFNRoles.TREASURY_ROLE, authorizedUser);
        education.grantRole(BFNRoles.ISSUER_ROLE, authorizedUser);
        // Grant REPUTATION_ROLE to Education contract so it can increase reputation
        registry.grantRole(BFNRoles.REPUTATION_ROLE, address(education));
        vm.stopPrank();
        
        // Setup a registered user for testing
        vm.prank(authorizedUser);
        registry.register();
    }

    /// @notice **Property 26: Unauthorized privileged operations revert without state change**
    /// **Validates: Requirements 3.10, 6.5, 9.7, 9.10, 14.5, 14.7, 14.9**
    /// 
    /// This property tests that unauthorized calls to privileged operations:
    /// 1. Always revert with appropriate access control errors
    /// 2. Never change the contract state 
    /// 3. Reject calls from randomly generated unauthorized addresses
    /// 
    /// Tests across all contracts:
    /// - Registry: verifyUser (VERIFIER_ROLE), increaseReputation (REPUTATION_ROLE)
    /// - Governance: executeTreasury (TREASURY_ROLE)  
    /// - Education: issueCertificate, awardBadge, recordAchievement (ISSUER_ROLE)
    /// - All: UUPS upgrades (UPGRADER_ROLE)
    function testProperty26_UnauthorizedPrivilegedOperationsRevert(
        address unauthorizedCaller,
        uint256 testAmount,
        uint256 seed
    ) public {
        // Bound parameters
        testAmount = bound(testAmount, 1, 1000);
        
        // Skip admin and authorized addresses
        vm.assume(unauthorizedCaller != admin);
        vm.assume(unauthorizedCaller != authorizedUser);
        vm.assume(unauthorizedCaller != address(0));
        
        // Ensure caller doesn't have any roles
        vm.assume(!registry.hasRole(BFNRoles.VERIFIER_ROLE, unauthorizedCaller));
        vm.assume(!registry.hasRole(BFNRoles.REPUTATION_ROLE, unauthorizedCaller));
        vm.assume(!registry.hasRole(BFNRoles.TREASURY_ROLE, unauthorizedCaller));
        vm.assume(!registry.hasRole(BFNRoles.ISSUER_ROLE, unauthorizedCaller));
        vm.assume(!registry.hasRole(BFNRoles.UPGRADER_ROLE, unauthorizedCaller));
        vm.assume(!registry.hasRole(BFNRoles.PAUSER_ROLE, unauthorizedCaller));
        vm.assume(!registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), unauthorizedCaller));
        
        // Test Registry unauthorized operations (Req 3.10, 14.5)
        _testRegistryUnauthorizedOperations(unauthorizedCaller, testAmount);
        
        // Test CommunityTreasury unauthorized operations (Req 6.5)
        _testCommunityTreasuryUnauthorizedOperations(unauthorizedCaller);
        
        // Test SavingsVault unauthorized operations  
        _testSavingsVaultUnauthorizedOperations(unauthorizedCaller);
        
        // Test Governance unauthorized operations (Req 9.7, 9.10)  
        _testGovernanceUnauthorizedOperations(unauthorizedCaller, seed);
        
        // Test Education unauthorized operations (Req 14.5)
        _testEducationUnauthorizedOperations(unauthorizedCaller, seed);
        
        // Test UUPS upgrade unauthorized operations (Req 14.9)
        _testUpgradeUnauthorizedOperations(unauthorizedCaller);
    }
    
    /// @notice Test Registry unauthorized operations
    /// @dev Tests verifyUser (VERIFIER_ROLE) and increaseReputation (REPUTATION_ROLE)
    function _testRegistryUnauthorizedOperations(address unauthorizedCaller, uint256 testAmount) internal {
        // Capture initial state
        IRegistry.UserProfile memory initialProfile = registry.getProfile(authorizedUser);
        
        // Test unauthorized verifyUser call (Req 3.10)
        vm.prank(unauthorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                unauthorizedCaller,
                BFNRoles.VERIFIER_ROLE
            )
        );
        registry.verifyUser(authorizedUser);
        
        // Verify state unchanged
        IRegistry.UserProfile memory profileAfterVerifyAttempt = registry.getProfile(authorizedUser);
        assertEq(profileAfterVerifyAttempt.verified, initialProfile.verified, "Verified status should be unchanged");
        
        // Test unauthorized increaseReputation call (Req 8.7, 14.5)
        vm.prank(unauthorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                unauthorizedCaller,
                BFNRoles.REPUTATION_ROLE
            )
        );
        registry.increaseReputation(authorizedUser, testAmount);
        
        // Verify state unchanged
        IRegistry.UserProfile memory profileAfterReputationAttempt = registry.getProfile(authorizedUser);
        assertEq(profileAfterReputationAttempt.reputationScore, initialProfile.reputationScore, "Reputation should be unchanged");
    }
    
    /// @notice Test Governance unauthorized operations
    /// @dev Tests executeTreasury (TREASURY_ROLE)
    function _testGovernanceUnauthorizedOperations(address unauthorizedCaller, uint256 seed) internal {
        // Create test treasury action
        bytes memory treasuryAction = abi.encode("test_action", seed);
        
        // Test unauthorized executeTreasury call (Req 9.7, 9.10)
        vm.prank(unauthorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                unauthorizedCaller,
                BFNRoles.TREASURY_ROLE
            )
        );
        governance.executeTreasury(treasuryAction);
        
        // No specific state to check since executeTreasury is a placeholder,
        // but the revert proves unauthorized access is blocked
    }
    
    /// @notice Test Education unauthorized operations  
    /// @dev Tests issueCertificate, awardBadge, recordAchievement (ISSUER_ROLE)
    function _testEducationUnauthorizedOperations(address unauthorizedCaller, uint256 seed) internal {
        bytes32 courseId = keccak256(abi.encode("course", seed));
        bytes32 badgeId = keccak256(abi.encode("badge", seed));
        bytes32 achievementId = keccak256(abi.encode("achievement", seed));
        string memory ipfsHash = "QmTestHash";
        
        // Capture initial state
        bool initialCertificate = education.hasCertificate(authorizedUser, courseId);
        bool initialBadge = education.hasBadge(authorizedUser, badgeId);
        bool initialAchievement = education.hasAchievement(authorizedUser, achievementId);
        uint256 initialReputation = registry.reputationOf(authorizedUser);
        
        // Test unauthorized issueCertificate call (Req 8.3, 14.5)
        vm.prank(unauthorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                unauthorizedCaller,
                BFNRoles.ISSUER_ROLE
            )
        );
        education.issueCertificate(authorizedUser, courseId, ipfsHash);
        
        // Verify state unchanged
        assertEq(education.hasCertificate(authorizedUser, courseId), initialCertificate, "Certificate status should be unchanged");
        
        // Test unauthorized awardBadge call (Req 8.5, 14.5)
        vm.prank(unauthorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                unauthorizedCaller,
                BFNRoles.ISSUER_ROLE
            )
        );
        education.awardBadge(authorizedUser, badgeId);
        
        // Verify state unchanged
        assertEq(education.hasBadge(authorizedUser, badgeId), initialBadge, "Badge status should be unchanged");
        
        // Test unauthorized recordAchievement call (Req 8.5, 8.7, 14.5)  
        vm.prank(unauthorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                unauthorizedCaller,
                BFNRoles.ISSUER_ROLE
            )
        );
        education.recordAchievement(authorizedUser, achievementId, 10);
        
        // Verify state unchanged
        assertEq(education.hasAchievement(authorizedUser, achievementId), initialAchievement, "Achievement status should be unchanged");
        assertEq(registry.reputationOf(authorizedUser), initialReputation, "Reputation should be unchanged");
    }
    
    /// @notice Test UUPS upgrade unauthorized operations
    /// @dev Tests upgradeToAndCall (UPGRADER_ROLE) across all contracts
    function _testUpgradeUnauthorizedOperations(address unauthorizedCaller) internal {
        // Create dummy new implementation (same as current for testing)
        Registry newRegistryImpl = new Registry();
        Governance newGovernanceImpl = new Governance();
        Education newEducationImpl = new Education();
        CommunityTreasury newTreasuryImpl = new CommunityTreasury();
        SavingsVault newVaultImpl = new SavingsVault();
        
        // Test unauthorized Registry upgrade (Req 14.9, 14.8)
        vm.prank(unauthorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                unauthorizedCaller,
                BFNRoles.UPGRADER_ROLE
            )
        );
        UUPSUpgradeable(address(registry)).upgradeToAndCall(address(newRegistryImpl), "");
        
        // Test unauthorized Governance upgrade (Req 14.9, 14.8)
        vm.prank(unauthorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                unauthorizedCaller,
                BFNRoles.UPGRADER_ROLE
            )
        );
        UUPSUpgradeable(address(governance)).upgradeToAndCall(address(newGovernanceImpl), "");
        
        // Test unauthorized Education upgrade (Req 14.9, 14.8)  
        vm.prank(unauthorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                unauthorizedCaller,
                BFNRoles.UPGRADER_ROLE
            )
        );
        UUPSUpgradeable(address(education)).upgradeToAndCall(address(newEducationImpl), "");
        
        // Test unauthorized CommunityTreasury upgrade (Req 14.9, 14.8)
        vm.prank(unauthorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                unauthorizedCaller,
                BFNRoles.UPGRADER_ROLE
            )
        );
        UUPSUpgradeable(address(communityTreasury)).upgradeToAndCall(address(newTreasuryImpl), "");
        
        // Test unauthorized SavingsVault upgrade (Req 14.9, 14.8)
        vm.prank(unauthorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                unauthorizedCaller,
                BFNRoles.UPGRADER_ROLE
            )
        );
        UUPSUpgradeable(address(savingsVault)).upgradeToAndCall(address(newVaultImpl), "");
    }
    
    /// @notice Test that authorized operations work correctly
    /// @dev This validates our test setup and shows the difference between authorized and unauthorized calls
    function testProperty26_AuthorizedOperationsSucceed() public {
        // Test authorized Registry operations
        vm.prank(authorizedUser);
        registry.verifyUser(authorizedUser);
        assertTrue(registry.getProfile(authorizedUser).verified, "Authorized verifyUser should succeed");
        
        vm.prank(authorizedUser);
        registry.increaseReputation(authorizedUser, 100);
        assertEq(registry.reputationOf(authorizedUser), 100, "Authorized increaseReputation should succeed");
        
        // Test authorized Education operations
        vm.prank(authorizedUser);
        education.issueCertificate(authorizedUser, keccak256("testCourse"), "QmTestHash");
        assertTrue(education.hasCertificate(authorizedUser, keccak256("testCourse")), "Authorized issueCertificate should succeed");
        
        vm.prank(authorizedUser);
        education.awardBadge(authorizedUser, keccak256("testBadge"));
        assertTrue(education.hasBadge(authorizedUser, keccak256("testBadge")), "Authorized awardBadge should succeed");
        
        vm.prank(authorizedUser);
        education.recordAchievement(authorizedUser, keccak256("testAchievement"), 50);
        assertTrue(education.hasAchievement(authorizedUser, keccak256("testAchievement")), "Authorized recordAchievement should succeed");
        
        // Test authorized Governance operations
        vm.prank(authorizedUser);
        governance.executeTreasury(abi.encode("authorized_action"));
        // No revert means success
        
        // Test authorized upgrade operations  
        Registry newImpl = new Registry();
        vm.prank(admin); // Admin has UPGRADER_ROLE
        UUPSUpgradeable(address(registry)).upgradeToAndCall(address(newImpl), "");
        // No revert means success
    }
    
    /// @notice Test edge case: zero address should be rejected
    function testProperty26_ZeroAddressRejected() public {
        // Zero address should not have any roles and operations should revert
        assertFalse(registry.hasRole(BFNRoles.VERIFIER_ROLE, address(0)), "Zero address should not have VERIFIER_ROLE");
        assertFalse(registry.hasRole(BFNRoles.REPUTATION_ROLE, address(0)), "Zero address should not have REPUTATION_ROLE");
        
        vm.prank(address(0));
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                address(0),
                BFNRoles.VERIFIER_ROLE
            )
        );
        registry.verifyUser(authorizedUser);
    }
    
    /// @notice Test that contract addresses without roles are also rejected
    function testProperty26_ContractAddressesRejected() public {
        address contractAddr = address(token); // Use token contract as unauthorized contract
        
        vm.assume(!registry.hasRole(BFNRoles.VERIFIER_ROLE, contractAddr));
        
        vm.prank(contractAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                contractAddr,
                BFNRoles.VERIFIER_ROLE
            )
        );
        registry.verifyUser(authorizedUser);
    }
    
    /// @notice Test multiple consecutive unauthorized operations to ensure consistent behavior
    function testProperty26_ConsistentUnauthorizedBehavior(address unauthorizedCaller) public {
        vm.assume(unauthorizedCaller != admin);
        vm.assume(unauthorizedCaller != authorizedUser);
        vm.assume(unauthorizedCaller != address(0));
        vm.assume(!registry.hasRole(BFNRoles.VERIFIER_ROLE, unauthorizedCaller));
        
        // Capture initial state (user is already verified from the authorized test)
        IRegistry.UserProfile memory initialProfile = registry.getProfile(authorizedUser);
        
        // Multiple attempts should all revert consistently
        for (uint i = 0; i < 3; i++) {
            vm.prank(unauthorizedCaller);
            vm.expectRevert(
                abi.encodeWithSelector(
                    IAccessControl.AccessControlUnauthorizedAccount.selector,
                    unauthorizedCaller,
                    BFNRoles.VERIFIER_ROLE
                )
            );
            registry.verifyUser(authorizedUser);
        }
        
        // State should remain unchanged after all attempts
        IRegistry.UserProfile memory finalProfile = registry.getProfile(authorizedUser);
        assertEq(finalProfile.verified, initialProfile.verified, "Verified status should remain unchanged after multiple unauthorized attempts");
        assertEq(finalProfile.reputationScore, initialProfile.reputationScore, "Reputation should remain unchanged after multiple unauthorized attempts");
    }
}