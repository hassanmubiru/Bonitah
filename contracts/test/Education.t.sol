// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Education} from "../src/Education.sol";
import {Registry} from "../src/Registry.sol";
import {IEducation} from "../src/interfaces/IEducation.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";

contract EducationTest is Test {
    Education public education;
    Registry public registry;
    
    address public admin = makeAddr("admin");
    address public issuer = makeAddr("issuer");
    address public user = makeAddr("user");
    
    bytes32 public constant COURSE_ID = keccak256("financial-literacy-101");
    bytes32 public constant BADGE_ID = keccak256("early-adopter");
    bytes32 public constant ACHIEVEMENT_ID = keccak256("first-certificate");
    string public constant METADATA_HASH = "QmTestHash123";

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

        // Register user
        vm.prank(user);
        registry.register();
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

    function test_IssueCertificate_EmptyHash_Reverts() public {
        vm.prank(issuer);
        vm.expectRevert(IEducation.EmptyMetadataHash.selector);
        education.issueCertificate(user, COURSE_ID, "");
    }

    function test_IssueCertificate_Duplicate_Reverts() public {
        vm.startPrank(issuer);
        education.issueCertificate(user, COURSE_ID, METADATA_HASH);
        
        vm.expectRevert(abi.encodeWithSelector(IEducation.CertificateAlreadyIssued.selector, user, COURSE_ID));
        education.issueCertificate(user, COURSE_ID, METADATA_HASH);
        vm.stopPrank();
    }

    function test_IssueCertificate_UnauthorizedCaller_Reverts() public {
        vm.prank(user);
        vm.expectRevert(); // AccessControl revert
        education.issueCertificate(user, COURSE_ID, METADATA_HASH);
    }

    function test_AwardBadge_Success() public {
        vm.prank(issuer);
        education.awardBadge(user, BADGE_ID);

        assertTrue(education.hasBadge(user, BADGE_ID));
    }

    function test_AwardBadge_Idempotent() public {
        vm.startPrank(issuer);
        education.awardBadge(user, BADGE_ID);
        education.awardBadge(user, BADGE_ID); // Should not revert
        vm.stopPrank();

        assertTrue(education.hasBadge(user, BADGE_ID));
    }

    function test_RecordAchievement_Success() public {
        uint256 reputationAmount = 100;
        uint256 initialReputation = registry.reputationOf(user);

        vm.prank(issuer);
        education.recordAchievement(user, ACHIEVEMENT_ID, reputationAmount);

        assertTrue(education.hasAchievement(user, ACHIEVEMENT_ID));
        assertEq(registry.reputationOf(user), initialReputation + reputationAmount);
    }

    function test_RecordAchievement_ZeroReputation() public {
        uint256 initialReputation = registry.reputationOf(user);

        vm.prank(issuer);
        education.recordAchievement(user, ACHIEVEMENT_ID, 0);

        assertTrue(education.hasAchievement(user, ACHIEVEMENT_ID));
        assertEq(registry.reputationOf(user), initialReputation); // No change
    }

    function test_RecordAchievement_Idempotent() public {
        uint256 reputationAmount = 100;
        uint256 initialReputation = registry.reputationOf(user);

        vm.startPrank(issuer);
        education.recordAchievement(user, ACHIEVEMENT_ID, reputationAmount);
        education.recordAchievement(user, ACHIEVEMENT_ID, reputationAmount); // Should not add reputation again
        vm.stopPrank();

        assertTrue(education.hasAchievement(user, ACHIEVEMENT_ID));
        assertEq(registry.reputationOf(user), initialReputation + reputationAmount); // Only added once
    }

    function test_Events_EmittedCorrectly() public {
        // Test CertificateIssued event
        vm.expectEmit(true, true, true, false);
        emit IEducation.CertificateIssued(user, 1, COURSE_ID);
        
        vm.prank(issuer);
        education.issueCertificate(user, COURSE_ID, METADATA_HASH);

        // Test BadgeAwarded event
        vm.expectEmit(true, true, false, false);
        emit IEducation.BadgeAwarded(user, BADGE_ID);
        
        vm.prank(issuer);
        education.awardBadge(user, BADGE_ID);

        // Test AchievementRecorded event
        vm.expectEmit(true, true, false, true);
        emit IEducation.AchievementRecorded(user, ACHIEVEMENT_ID, 100);
        
        vm.prank(issuer);
        education.recordAchievement(user, ACHIEVEMENT_ID, 100);
    }
}