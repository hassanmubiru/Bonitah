// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Education} from "../src/Education.sol";
import {Registry} from "../src/Registry.sol";
import {IEducation} from "../src/interfaces/IEducation.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";

/// @title EducationUnitEventRevertTest
/// @notice Comprehensive unit, event, and revert tests for Education contract (Task 6.3).
/// @dev Validates Requirements 13.9, 15.1, 15.2, 15.3 implementation.
contract EducationUnitEventRevertTest is Test {
    Education public education;
    Registry public registry;
    
    address public admin = makeAddr("admin");
    address public issuer = makeAddr("issuer");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public unauthorizedUser = makeAddr("unauthorizedUser");
    
    bytes32 public constant COURSE_ID_1 = keccak256("financial-literacy-101");
    bytes32 public constant COURSE_ID_2 = keccak256("advanced-investing");
    bytes32 public constant BADGE_ID_1 = keccak256("early-adopter");
    bytes32 public constant BADGE_ID_2 = keccak256("milestone-achiever");
    bytes32 public constant ACHIEVEMENT_ID_1 = keccak256("first-certificate");
    bytes32 public constant ACHIEVEMENT_ID_2 = keccak256("expert-level");
    string public constant METADATA_HASH = "QmTestHash123456789";
    string public constant EMPTY_HASH = "";
    
    // Event declarations for testing
    event CertificateIssued(address indexed user, uint256 indexed certificateId, bytes32 indexed courseId);
    event BadgeAwarded(address indexed user, bytes32 indexed badgeId);
    event AchievementRecorded(address indexed user, bytes32 indexed achievementId, uint256 reputationAwarded);

    function setUp() public {
        // Deploy Registry proxy
        Registry registryImpl = new Registry();
        bytes memory registryData = abi.encodeWithSelector(Registry.initialize.selector, admin);
        ERC1967Proxy registryProxy = new ERC1967Proxy(address(registryImpl), registryData);
        registry = Registry(address(registryProxy));

        // Deploy Education proxy
        Education educationImpl = new Education();
        bytes memory educationData = abi.encodeWithSelector(Education.initialize.selector, admin, address(registry));
        ERC1967Proxy educationProxy = new ERC1967Proxy(address(educationImpl), educationData);
        education = Education(address(educationProxy));

        // Setup roles
        vm.startPrank(admin);
        education.grantRole(BFNRoles.ISSUER_ROLE, issuer);
        registry.grantRole(BFNRoles.REPUTATION_ROLE, address(education));
        vm.stopPrank();

        // Register users
        vm.prank(user1);
        registry.register();
        vm.prank(user2);
        registry.register();
    }

    // ========================================================================
    // UNIT TESTS - Testing all public/external functions (Req 15.1)
    // ========================================================================

    /// @notice Test successful certificate issuance (Req 8.3, 8.4)
    function test_IssueCertificate_Success() public {
        assertFalse(education.hasCertificate(user1, COURSE_ID_1));
        
        vm.prank(issuer);
        education.issueCertificate(user1, COURSE_ID_1, METADATA_HASH);

        // Verify certificate was issued
        assertTrue(education.hasCertificate(user1, COURSE_ID_1));
        
        IEducation.Certificate memory cert = education.getCertificate(user1, COURSE_ID_1);
        assertEq(cert.id, 1);
        assertEq(cert.courseId, COURSE_ID_1);
        assertEq(cert.ipfsMetadataHash, METADATA_HASH);
        assertGt(cert.issuedAt, 0);
        assertEq(cert.issuedAt, block.timestamp);
    }

    /// @notice Test multiple certificate issuance with incremental IDs
    function test_IssueCertificate_MultipleUsers() public {
        // Issue first certificate
        vm.prank(issuer);
        education.issueCertificate(user1, COURSE_ID_1, METADATA_HASH);
        
        // Issue second certificate to different user
        vm.prank(issuer);
        education.issueCertificate(user2, COURSE_ID_1, METADATA_HASH);
        
        // Issue third certificate to same user for different course
        vm.prank(issuer);
        education.issueCertificate(user1, COURSE_ID_2, METADATA_HASH);

        // Verify all certificates
        assertTrue(education.hasCertificate(user1, COURSE_ID_1));
        assertTrue(education.hasCertificate(user2, COURSE_ID_1));
        assertTrue(education.hasCertificate(user1, COURSE_ID_2));
        
        assertEq(education.getCertificate(user1, COURSE_ID_1).id, 1);
        assertEq(education.getCertificate(user2, COURSE_ID_1).id, 2);
        assertEq(education.getCertificate(user1, COURSE_ID_2).id, 3);
    }

    /// @notice Test successful badge awarding (Req 8.5)
    function test_AwardBadge_Success() public {
        assertFalse(education.hasBadge(user1, BADGE_ID_1));

        vm.prank(issuer);
        education.awardBadge(user1, BADGE_ID_1);

        assertTrue(education.hasBadge(user1, BADGE_ID_1));
    }

    /// @notice Test badge awarding is idempotent
    function test_AwardBadge_Idempotent() public {
        vm.startPrank(issuer);
        education.awardBadge(user1, BADGE_ID_1);
        assertTrue(education.hasBadge(user1, BADGE_ID_1));
        
        // Second award should not revert
        education.awardBadge(user1, BADGE_ID_1);
        assertTrue(education.hasBadge(user1, BADGE_ID_1));
        vm.stopPrank();
    }

    /// @notice Test multiple badge awards to same user
    function test_AwardBadge_MultipleBadges() public {
        vm.startPrank(issuer);
        education.awardBadge(user1, BADGE_ID_1);
        education.awardBadge(user1, BADGE_ID_2);
        vm.stopPrank();

        assertTrue(education.hasBadge(user1, BADGE_ID_1));
        assertTrue(education.hasBadge(user1, BADGE_ID_2));
    }

    /// @notice Test successful achievement recording with reputation (Req 8.5, 8.7)
    function test_RecordAchievement_WithReputation() public {
        uint256 reputationAmount = 100;
        uint256 initialReputation = registry.reputationOf(user1);
        
        assertFalse(education.hasAchievement(user1, ACHIEVEMENT_ID_1));

        vm.prank(issuer);
        education.recordAchievement(user1, ACHIEVEMENT_ID_1, reputationAmount);

        assertTrue(education.hasAchievement(user1, ACHIEVEMENT_ID_1));
        assertEq(registry.reputationOf(user1), initialReputation + reputationAmount);
    }

    /// @notice Test achievement recording without reputation increase
    function test_RecordAchievement_ZeroReputation() public {
        uint256 initialReputation = registry.reputationOf(user1);

        vm.prank(issuer);
        education.recordAchievement(user1, ACHIEVEMENT_ID_1, 0);

        assertTrue(education.hasAchievement(user1, ACHIEVEMENT_ID_1));
        assertEq(registry.reputationOf(user1), initialReputation); // No change
    }

    /// @notice Test achievement recording is idempotent
    function test_RecordAchievement_Idempotent() public {
        uint256 reputationAmount = 100;
        uint256 initialReputation = registry.reputationOf(user1);

        vm.startPrank(issuer);
        education.recordAchievement(user1, ACHIEVEMENT_ID_1, reputationAmount);
        
        // Second record should not add reputation again
        education.recordAchievement(user1, ACHIEVEMENT_ID_1, reputationAmount);
        vm.stopPrank();

        assertTrue(education.hasAchievement(user1, ACHIEVEMENT_ID_1));
        assertEq(registry.reputationOf(user1), initialReputation + reputationAmount); // Only added once
    }

    /// @notice Test view functions for non-existent data
    function test_ViewFunctions_NonExistentData() public {
        // Non-existent certificate
        assertFalse(education.hasCertificate(user1, COURSE_ID_1));
        
        IEducation.Certificate memory cert = education.getCertificate(user1, COURSE_ID_1);
        assertEq(cert.id, 0);
        assertEq(cert.courseId, bytes32(0));
        assertEq(cert.ipfsMetadataHash, "");
        assertEq(cert.issuedAt, 0);

        // Non-existent badge
        assertFalse(education.hasBadge(user1, BADGE_ID_1));

        // Non-existent achievement
        assertFalse(education.hasAchievement(user1, ACHIEVEMENT_ID_1));
    }

    // ========================================================================
    // EVENT TESTS - Testing event emissions with correct arguments (Req 15.2)
    // ========================================================================

    /// @notice Test CertificateIssued event emitted correctly (Req 13.9)
    function test_Event_CertificateIssued() public {
        vm.expectEmit(true, true, true, false);
        emit CertificateIssued(user1, 1, COURSE_ID_1);
        
        vm.prank(issuer);
        education.issueCertificate(user1, COURSE_ID_1, METADATA_HASH);
    }

    /// @notice Test CertificateIssued event with multiple certificates
    function test_Event_CertificateIssued_Multiple() public {
        // First certificate
        vm.expectEmit(true, true, true, false);
        emit CertificateIssued(user1, 1, COURSE_ID_1);
        
        vm.prank(issuer);
        education.issueCertificate(user1, COURSE_ID_1, METADATA_HASH);

        // Second certificate (different user, same course)
        vm.expectEmit(true, true, true, false);
        emit CertificateIssued(user2, 2, COURSE_ID_1);
        
        vm.prank(issuer);
        education.issueCertificate(user2, COURSE_ID_1, METADATA_HASH);
    }

    /// @notice Test BadgeAwarded event emitted correctly (Req 13.9)
    function test_Event_BadgeAwarded() public {
        vm.expectEmit(true, true, false, false);
        emit BadgeAwarded(user1, BADGE_ID_1);
        
        vm.prank(issuer);
        education.awardBadge(user1, BADGE_ID_1);
    }

    /// @notice Test BadgeAwarded event not emitted on duplicate award
    function test_Event_BadgeAwarded_NotEmittedOnDuplicate() public {
        vm.prank(issuer);
        education.awardBadge(user1, BADGE_ID_1);

        // Second award should NOT emit event
        vm.recordLogs();
        vm.prank(issuer);
        education.awardBadge(user1, BADGE_ID_1);
        
        // Verify no events were emitted
        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 0);
    }

    /// @notice Test AchievementRecorded event emitted correctly (Req 13.9)
    function test_Event_AchievementRecorded() public {
        uint256 reputationAmount = 150;
        
        vm.expectEmit(true, true, false, true);
        emit AchievementRecorded(user1, ACHIEVEMENT_ID_1, reputationAmount);
        
        vm.prank(issuer);
        education.recordAchievement(user1, ACHIEVEMENT_ID_1, reputationAmount);
    }

    /// @notice Test AchievementRecorded event with zero reputation
    function test_Event_AchievementRecorded_ZeroReputation() public {
        vm.expectEmit(true, true, false, true);
        emit AchievementRecorded(user1, ACHIEVEMENT_ID_1, 0);
        
        vm.prank(issuer);
        education.recordAchievement(user1, ACHIEVEMENT_ID_1, 0);
    }

    /// @notice Test AchievementRecorded event not emitted on duplicate record
    function test_Event_AchievementRecorded_NotEmittedOnDuplicate() public {
        vm.prank(issuer);
        education.recordAchievement(user1, ACHIEVEMENT_ID_1, 100);

        // Second record should NOT emit event
        vm.recordLogs();
        vm.prank(issuer);
        education.recordAchievement(user1, ACHIEVEMENT_ID_1, 100);
        
        // Verify no events were emitted
        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 0);
    }

    // ========================================================================
    // REVERT TESTS - Testing all custom errors (Req 15.3)
    // ========================================================================

    /// @notice Test EmptyMetadataHash error (Req 8.9)
    function test_Revert_EmptyMetadataHash() public {
        vm.prank(issuer);
        vm.expectRevert(IEducation.EmptyMetadataHash.selector);
        education.issueCertificate(user1, COURSE_ID_1, EMPTY_HASH);
    }

    /// @notice Test CertificateAlreadyIssued error (Req 8.10)
    function test_Revert_CertificateAlreadyIssued() public {
        // Issue first certificate
        vm.prank(issuer);
        education.issueCertificate(user1, COURSE_ID_1, METADATA_HASH);
        
        // Attempt to issue duplicate certificate
        vm.expectRevert(abi.encodeWithSelector(IEducation.CertificateAlreadyIssued.selector, user1, COURSE_ID_1));
        vm.prank(issuer);
        education.issueCertificate(user1, COURSE_ID_1, METADATA_HASH);
    }

    /// @notice Test unauthorized caller reverts for issueCertificate (Req 8.3)
    function test_Revert_IssueCertificate_UnauthorizedCaller() public {
        vm.expectRevert(); // AccessControl revert (generic revert expected)
        vm.prank(unauthorizedUser);
        education.issueCertificate(user1, COURSE_ID_1, METADATA_HASH);
    }

    /// @notice Test unauthorized caller reverts for awardBadge
    function test_Revert_AwardBadge_UnauthorizedCaller() public {
        vm.expectRevert(); // AccessControl revert
        vm.prank(unauthorizedUser);
        education.awardBadge(user1, BADGE_ID_1);
    }

    /// @notice Test unauthorized caller reverts for recordAchievement
    function test_Revert_RecordAchievement_UnauthorizedCaller() public {
        vm.expectRevert(); // AccessControl revert
        vm.prank(unauthorizedUser);
        education.recordAchievement(user1, ACHIEVEMENT_ID_1, 100);
    }

    // ========================================================================
    // ACCESS CONTROL TESTS - Testing role-based permissions (Req 14.5)
    // ========================================================================

    /// @notice Test only ISSUER_ROLE can issue certificates
    function test_AccessControl_IssueCertificate() public {
        // Issuer can issue certificates
        vm.prank(issuer);
        education.issueCertificate(user1, COURSE_ID_1, METADATA_HASH);
        assertTrue(education.hasCertificate(user1, COURSE_ID_1));

        // Admin cannot issue certificates (doesn't have ISSUER_ROLE)
        vm.expectRevert();
        vm.prank(admin);
        education.issueCertificate(user2, COURSE_ID_2, METADATA_HASH);

        // Regular user cannot issue certificates
        vm.expectRevert();
        vm.prank(user1);
        education.issueCertificate(user2, COURSE_ID_2, METADATA_HASH);
    }

    /// @notice Test role management
    function test_AccessControl_RoleManagement() public {
        // Admin can grant/revoke ISSUER_ROLE
        address newIssuer = makeAddr("newIssuer");
        
        vm.startPrank(admin);
        education.grantRole(BFNRoles.ISSUER_ROLE, newIssuer);
        assertTrue(education.hasRole(BFNRoles.ISSUER_ROLE, newIssuer));
        
        education.revokeRole(BFNRoles.ISSUER_ROLE, newIssuer);
        assertFalse(education.hasRole(BFNRoles.ISSUER_ROLE, newIssuer));
        vm.stopPrank();
    }

    // ========================================================================
    // INTEGRATION TESTS - Testing contract interactions
    // ========================================================================

    /// @notice Test complete education workflow
    function test_Integration_CompleteWorkflow() public {
        vm.startPrank(issuer);
        
        // Award badge first
        education.awardBadge(user1, BADGE_ID_1);
        assertTrue(education.hasBadge(user1, BADGE_ID_1));
        
        // Record achievement with reputation
        uint256 initialReputation = registry.reputationOf(user1);
        education.recordAchievement(user1, ACHIEVEMENT_ID_1, 50);
        assertTrue(education.hasAchievement(user1, ACHIEVEMENT_ID_1));
        assertEq(registry.reputationOf(user1), initialReputation + 50);
        
        // Issue certificate
        education.issueCertificate(user1, COURSE_ID_1, METADATA_HASH);
        assertTrue(education.hasCertificate(user1, COURSE_ID_1));
        
        vm.stopPrank();
        
        // Verify final state
        IEducation.Certificate memory cert = education.getCertificate(user1, COURSE_ID_1);
        assertEq(cert.id, 1);
        assertEq(cert.courseId, COURSE_ID_1);
        assertEq(cert.ipfsMetadataHash, METADATA_HASH);
        assertGt(cert.issuedAt, 0);
    }

    /// @notice Test state consistency across multiple operations
    function test_Integration_StateConsistency() public {
        vm.startPrank(issuer);
        
        // Issue multiple certificates to different users
        education.issueCertificate(user1, COURSE_ID_1, METADATA_HASH);
        education.issueCertificate(user2, COURSE_ID_1, METADATA_HASH);
        education.issueCertificate(user1, COURSE_ID_2, METADATA_HASH);
        
        // Award badges
        education.awardBadge(user1, BADGE_ID_1);
        education.awardBadge(user2, BADGE_ID_1);
        education.awardBadge(user1, BADGE_ID_2);
        
        // Record achievements
        education.recordAchievement(user1, ACHIEVEMENT_ID_1, 100);
        education.recordAchievement(user2, ACHIEVEMENT_ID_1, 75);
        
        vm.stopPrank();
        
        // Verify all states are independent and correct
        assertTrue(education.hasCertificate(user1, COURSE_ID_1));
        assertTrue(education.hasCertificate(user2, COURSE_ID_1));
        assertTrue(education.hasCertificate(user1, COURSE_ID_2));
        assertFalse(education.hasCertificate(user2, COURSE_ID_2));
        
        assertTrue(education.hasBadge(user1, BADGE_ID_1));
        assertTrue(education.hasBadge(user2, BADGE_ID_1));
        assertTrue(education.hasBadge(user1, BADGE_ID_2));
        assertFalse(education.hasBadge(user2, BADGE_ID_2));
        
        assertTrue(education.hasAchievement(user1, ACHIEVEMENT_ID_1));
        assertTrue(education.hasAchievement(user2, ACHIEVEMENT_ID_1));
        assertFalse(education.hasAchievement(user1, ACHIEVEMENT_ID_2));
        
        // Check certificate IDs are sequential
        assertEq(education.getCertificate(user1, COURSE_ID_1).id, 1);
        assertEq(education.getCertificate(user2, COURSE_ID_1).id, 2);
        assertEq(education.getCertificate(user1, COURSE_ID_2).id, 3);
    }
}