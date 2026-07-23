// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Education} from "../src/Education.sol";
import {Registry} from "../src/Registry.sol";
import {IEducation} from "../src/interfaces/IEducation.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";

/**
 * Property-based test for Education certificate and achievement proof functionality.
 * **Property 22: Certificate and achievement proofs recorded once**
 * **Validates: Requirements 8.3, 8.5**
 */
contract EducationPropertyCertificatesTest is Test {
    Education public education;
    Registry public registry;
    
    address public admin = makeAddr("admin");
    address public issuer = makeAddr("issuer");
    address[] public users;
    
    uint256 public constant MAX_USERS = 10;
    uint256 public constant MAX_COURSES = 5;
    uint256 public constant MAX_BADGES = 5;
    uint256 public constant MAX_ACHIEVEMENTS = 5;
    
    bytes32[] public courseIds;
    bytes32[] public badgeIds;
    bytes32[] public achievementIds;
    string[] public metadataHashes;
    
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
        
        // Setup test users
        for (uint256 i = 0; i < MAX_USERS; i++) {
            address user = makeAddr(string(abi.encodePacked("user", i)));
            users.push(user);
            
            // Register each user
            vm.prank(user);
            registry.register();
        }
        
        // Setup test data
        for (uint256 i = 0; i < MAX_COURSES; i++) {
            courseIds.push(keccak256(abi.encodePacked("course", i)));
            metadataHashes.push(string(abi.encodePacked("QmHash", i)));
        }
        
        for (uint256 i = 0; i < MAX_BADGES; i++) {
            badgeIds.push(keccak256(abi.encodePacked("badge", i)));
        }
        
        for (uint256 i = 0; i < MAX_ACHIEVEMENTS; i++) {
            achievementIds.push(keccak256(abi.encodePacked("achievement", i)));
        }
    }
    
    /**
     * **Property 22: Certificate issuance is recorded once and prevents duplicates**
     * Test that certificates are issued exactly once and attempting to issue duplicates reverts.
     * **Validates: Requirements 8.3**
     */
    function testProperty_CertificateIssuedOnce(
        uint8 numUsers,
        uint8 numCourses,
        uint256 seed
    ) public {
        // Bound inputs
        numUsers = uint8(bound(numUsers, 1, MAX_USERS));
        numCourses = uint8(bound(numCourses, 1, MAX_COURSES));
        
        uint256 currentSeed = seed;
        
        // Issue certificates for random user-course combinations
        for (uint256 i = 0; i < numUsers * numCourses; i++) {
            address user = users[currentSeed % numUsers];
            bytes32 courseId = courseIds[currentSeed % numCourses];
            string memory metadataHash = metadataHashes[currentSeed % numCourses];
            
            currentSeed = uint256(keccak256(abi.encode(currentSeed, i)));
            
            // Check if certificate already exists
            if (!education.hasCertificate(user, courseId)) {
                // First issuance should succeed
                vm.prank(issuer);
                education.issueCertificate(user, courseId, metadataHash);
                
                // Verify certificate was issued
                assertTrue(education.hasCertificate(user, courseId), "Certificate should be recorded");
                
                IEducation.Certificate memory cert = education.getCertificate(user, courseId);
                assertGt(cert.id, 0, "Certificate ID should be greater than 0");
                assertEq(cert.courseId, courseId, "Course ID should match");
                assertEq(cert.ipfsMetadataHash, metadataHash, "Metadata hash should match");
                assertGt(cert.issuedAt, 0, "Issue timestamp should be set");
                
                // Second issuance should revert with CertificateAlreadyIssued
                vm.prank(issuer);
                vm.expectRevert(abi.encodeWithSelector(IEducation.CertificateAlreadyIssued.selector, user, courseId));
                education.issueCertificate(user, courseId, metadataHash);
                
                // Verify certificate state remains unchanged after failed duplicate attempt
                assertTrue(education.hasCertificate(user, courseId), "Certificate should still exist");
                IEducation.Certificate memory certAfter = education.getCertificate(user, courseId);
                assertEq(certAfter.id, cert.id, "Certificate ID should be unchanged");
                assertEq(certAfter.issuedAt, cert.issuedAt, "Issue timestamp should be unchanged");
            }
        }
    }
    
    /**
     * **Property 22: Badge awards are idempotent**
     * Test that badges are awarded once and subsequent awards are idempotent (no error, no duplicate).
     * **Validates: Requirements 8.5**
     */
    function testProperty_BadgeAwardIdempotent(
        uint8 numUsers,
        uint8 numBadges,
        uint8 numRepeats,
        uint256 seed
    ) public {
        // Bound inputs
        numUsers = uint8(bound(numUsers, 1, MAX_USERS));
        numBadges = uint8(bound(numBadges, 1, MAX_BADGES));
        numRepeats = uint8(bound(numRepeats, 1, 5));
        
        uint256 currentSeed = seed;
        
        // Award badges and track state
        for (uint256 i = 0; i < numUsers; i++) {
            address user = users[i];
            
            for (uint256 j = 0; j < numBadges; j++) {
                bytes32 badgeId = badgeIds[currentSeed % numBadges];
                currentSeed = uint256(keccak256(abi.encode(currentSeed, i, j)));
                
                // Skip if user already has this badge from a previous test iteration
                if (education.hasBadge(user, badgeId)) {
                    continue;
                }
                
                // Initially user should not have the badge
                assertFalse(education.hasBadge(user, badgeId), "User should not initially have badge");
                
                // Award badge for the first time
                vm.prank(issuer);
                education.awardBadge(user, badgeId);
                
                // Verify badge was awarded
                assertTrue(education.hasBadge(user, badgeId), "Badge should be awarded");
                
                // Award the same badge multiple times (should be idempotent)
                for (uint256 k = 0; k < numRepeats; k++) {
                    vm.prank(issuer);
                    education.awardBadge(user, badgeId); // Should not revert
                    
                    // Verify badge state remains true
                    assertTrue(education.hasBadge(user, badgeId), "Badge should still be awarded after repeat");
                }
            }
        }
    }
    
    /**
     * **Property 22: Achievement recording is idempotent with single reputation increase**
     * Test that achievements are recorded once and reputation is increased only once.
     * **Validates: Requirements 8.5**
     */
    function testProperty_AchievementRecordedOnceWithReputationIncrement(
        uint8 numUsers,
        uint8 numAchievements,
        uint8 numRepeats,
        uint256 seed
    ) public {
        // Bound inputs
        numUsers = uint8(bound(numUsers, 1, MAX_USERS));
        numAchievements = uint8(bound(numAchievements, 1, MAX_ACHIEVEMENTS));
        numRepeats = uint8(bound(numRepeats, 1, 5));
        
        uint256 currentSeed = seed;
        
        // Record achievements and verify reputation increases only once
        for (uint256 i = 0; i < numUsers; i++) {
            address user = users[i];
            uint256 initialReputation = registry.reputationOf(user);
            
            for (uint256 j = 0; j < numAchievements; j++) {
                bytes32 achievementId = achievementIds[currentSeed % numAchievements];
                uint256 reputationAmount = (currentSeed % 1000) + 1; // 1 to 1000 reputation points
                currentSeed = uint256(keccak256(abi.encode(currentSeed, i, j)));
                
                // Skip if user already has this achievement from a previous test iteration
                if (education.hasAchievement(user, achievementId)) {
                    continue;
                }
                
                // Initially user should not have the achievement
                assertFalse(education.hasAchievement(user, achievementId), "User should not initially have achievement");
                
                // Record achievement for the first time
                vm.prank(issuer);
                education.recordAchievement(user, achievementId, reputationAmount);
                
                // Verify achievement was recorded and reputation increased
                assertTrue(education.hasAchievement(user, achievementId), "Achievement should be recorded");
                uint256 expectedReputation = initialReputation + reputationAmount;
                assertEq(registry.reputationOf(user), expectedReputation, "Reputation should increase by exact amount");
                
                // Record the same achievement multiple times (should be idempotent)
                for (uint256 k = 0; k < numRepeats; k++) {
                    vm.prank(issuer);
                    education.recordAchievement(user, achievementId, reputationAmount); // Should not revert
                    
                    // Verify achievement state remains true and reputation doesn't increase again
                    assertTrue(education.hasAchievement(user, achievementId), "Achievement should still be recorded");
                    assertEq(registry.reputationOf(user), expectedReputation, "Reputation should not increase again");
                }
                
                // Update initial reputation for next achievement
                initialReputation = expectedReputation;
            }
        }
    }
    
    /**
     * **Property 22: Zero reputation achievement recording is idempotent**
     * Test that achievements with zero reputation are recorded once without reputation changes.
     * **Validates: Requirements 8.5**
     */
    function testProperty_ZeroReputationAchievementIdempotent(
        uint8 numUsers,
        uint8 numAchievements,
        uint256 seed
    ) public {
        // Bound inputs
        numUsers = uint8(bound(numUsers, 1, MAX_USERS));
        numAchievements = uint8(bound(numAchievements, 1, MAX_ACHIEVEMENTS));
        
        uint256 currentSeed = seed;
        
        // Record zero-reputation achievements
        for (uint256 i = 0; i < numUsers; i++) {
            address user = users[i % numUsers];
            uint256 initialReputation = registry.reputationOf(user);
            
            for (uint256 j = 0; j < numAchievements; j++) {
                bytes32 achievementId = achievementIds[currentSeed % numAchievements];
                currentSeed = uint256(keccak256(abi.encode(currentSeed, i, j)));
                
                // Record achievement with zero reputation
                vm.prank(issuer);
                education.recordAchievement(user, achievementId, 0);
                
                // Verify achievement was recorded but reputation unchanged
                assertTrue(education.hasAchievement(user, achievementId), "Achievement should be recorded");
                assertEq(registry.reputationOf(user), initialReputation, "Reputation should not change");
                
                // Record again (should be idempotent)
                vm.prank(issuer);
                education.recordAchievement(user, achievementId, 0);
                
                // Verify state remains unchanged
                assertTrue(education.hasAchievement(user, achievementId), "Achievement should still be recorded");
                assertEq(registry.reputationOf(user), initialReputation, "Reputation should still be unchanged");
            }
        }
    }
    
    /**
     * **Property 22: Certificate issuance with empty metadata hash fails without state change**
     * Test that attempting to issue certificates with empty metadata hash reverts without state change.
     * **Validates: Requirements 8.3**
     */
    function testProperty_EmptyMetadataHashRevertsWithoutStateChange(
        uint8 numUsers,
        uint8 numCourses,
        uint256 seed
    ) public {
        // Bound inputs
        numUsers = uint8(bound(numUsers, 1, MAX_USERS));
        numCourses = uint8(bound(numCourses, 1, MAX_COURSES));
        
        uint256 currentSeed = seed;
        
        // Test empty metadata hash failures
        for (uint256 i = 0; i < numUsers; i++) {
            address user = users[i % numUsers];
            
            for (uint256 j = 0; j < numCourses; j++) {
                bytes32 courseId = courseIds[currentSeed % numCourses];
                currentSeed = uint256(keccak256(abi.encode(currentSeed, i, j)));
                
                // Verify user doesn't have certificate initially
                assertFalse(education.hasCertificate(user, courseId), "User should not have certificate initially");
                
                // Attempt to issue certificate with empty metadata hash
                vm.prank(issuer);
                vm.expectRevert(IEducation.EmptyMetadataHash.selector);
                education.issueCertificate(user, courseId, "");
                
                // Verify no certificate was issued
                assertFalse(education.hasCertificate(user, courseId), "No certificate should be issued after empty hash failure");
                
                IEducation.Certificate memory cert = education.getCertificate(user, courseId);
                assertEq(cert.id, 0, "Certificate ID should remain 0");
                assertEq(cert.courseId, bytes32(0), "Course ID should remain empty");
                assertEq(cert.ipfsMetadataHash, "", "Metadata hash should remain empty");
                assertEq(cert.issuedAt, 0, "Issue timestamp should remain 0");
            }
        }
    }
}