// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Education} from "../src/Education.sol";
import {IEducation} from "../src/interfaces/IEducation.sol";

/// @title EducationUnitTest  
/// @notice Unit tests for Education contract basic functionality
contract EducationUnitTest is Test {
    Education public education;
    
    address public admin = makeAddr("admin");
    address public issuer = makeAddr("issuer");
    address public user = makeAddr("user");
    address public mockRegistry = makeAddr("mockRegistry");
    
    bytes32 public constant COURSE_ID = keccak256("financial-literacy-101");
    bytes32 public constant BADGE_ID = keccak256("early-adopter");
    bytes32 public constant ACHIEVEMENT_ID = keccak256("first-certificate");
    string public constant METADATA_HASH = "QmTestHash123";

    function setUp() public {
        // Deploy implementation directly for unit testing
        education = new Education();
        
        // Initialize with mock addresses to avoid dependencies 
        vm.prank(admin);
        education.initialize(admin, mockRegistry);
        
        // Grant issuer role to test basic functionality
        vm.prank(admin);
        education.grantRole(keccak256("ISSUER_ROLE"), issuer);
    }

    function test_Initialize_SetsCorrectState() public {
        assertTrue(education.hasRole(education.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(education.hasRole(keccak256("UPGRADER_ROLE"), admin));
    }

    function test_IssueCertificate_EmptyHash_Reverts() public {
        vm.prank(issuer);
        vm.expectRevert(IEducation.EmptyMetadataHash.selector);
        education.issueCertificate(user, COURSE_ID, "");
    }

    function test_IssueCertificate_Duplicate_Reverts() public {
        vm.startPrank(issuer);
        // First certificate should succeed
        education.issueCertificate(user, COURSE_ID, METADATA_HASH);
        
        // Second certificate for same user/course should revert
        vm.expectRevert(abi.encodeWithSelector(IEducation.CertificateAlreadyIssued.selector, user, COURSE_ID));
        education.issueCertificate(user, COURSE_ID, METADATA_HASH);
        vm.stopPrank();
    }

    function test_IssueCertificate_Success() public {
        vm.prank(issuer);
        education.issueCertificate(user, COURSE_ID, METADATA_HASH);

        assertTrue(education.hasCertificate(user, COURSE_ID));
        
        IEducation.Certificate memory cert = education.getCertificate(user, COURSE_ID);
        assertEq(cert.id, 1);
        assertEq(cert.courseId, COURSE_ID);
        assertEq(cert.ipfsMetadataHash, METADATA_HASH);
        assertGt(cert.issuedAt, 0);
    }

    function test_AwardBadge_Success() public {
        vm.prank(issuer);
        education.awardBadge(user, BADGE_ID);

        assertTrue(education.hasBadge(user, BADGE_ID));
    }

    function test_AwardBadge_Idempotent() public {
        vm.startPrank(issuer);
        education.awardBadge(user, BADGE_ID);
        education.awardBadge(user, BADGE_ID); // Should not revert or emit duplicate events
        vm.stopPrank();

        assertTrue(education.hasBadge(user, BADGE_ID));
    }

    function test_RecordAchievement_Success() public {
        // Mock the registry call to avoid external dependency
        vm.mockCall(
            mockRegistry,
            abi.encodeWithSignature("increaseReputation(address,uint256)", user, 100),
            ""
        );

        vm.prank(issuer);
        education.recordAchievement(user, ACHIEVEMENT_ID, 100);

        assertTrue(education.hasAchievement(user, ACHIEVEMENT_ID));
    }

    function test_RecordAchievement_Idempotent() public {
        // Mock the registry call
        vm.mockCall(
            mockRegistry,
            abi.encodeWithSignature("increaseReputation(address,uint256)", user, 100),
            ""
        );

        vm.startPrank(issuer);
        education.recordAchievement(user, ACHIEVEMENT_ID, 100);
        education.recordAchievement(user, ACHIEVEMENT_ID, 100); // Should not call registry again
        vm.stopPrank();

        assertTrue(education.hasAchievement(user, ACHIEVEMENT_ID));
    }

    function test_Events_CertificateIssued() public {
        vm.expectEmit(true, true, true, false);
        emit IEducation.CertificateIssued(user, 1, COURSE_ID);
        
        vm.prank(issuer);
        education.issueCertificate(user, COURSE_ID, METADATA_HASH);
    }

    function test_Events_BadgeAwarded() public {
        vm.expectEmit(true, true, false, false);
        emit IEducation.BadgeAwarded(user, BADGE_ID);
        
        vm.prank(issuer);
        education.awardBadge(user, BADGE_ID);
    }

    function test_Events_AchievementRecorded() public {
        vm.mockCall(
            mockRegistry,
            abi.encodeWithSignature("increaseReputation(address,uint256)", user, 100),
            ""
        );

        vm.expectEmit(true, true, false, true);
        emit IEducation.AchievementRecorded(user, ACHIEVEMENT_ID, 100);
        
        vm.prank(issuer);
        education.recordAchievement(user, ACHIEVEMENT_ID, 100);
    }
}