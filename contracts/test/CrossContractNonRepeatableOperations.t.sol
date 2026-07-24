// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Registry} from "../src/Registry.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {Education} from "../src/Education.sol";
import {Governance} from "../src/Governance.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

import {IRegistry} from "../src/interfaces/IRegistry.sol";
import {ICommunityTreasury} from "../src/interfaces/ICommunityTreasury.sol";
import {IEducation} from "../src/interfaces/IEducation.sol";
import {IGovernance} from "../src/interfaces/IGovernance.sol";

import {BFNRoles} from "../src/base/BFNRoles.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CrossContractNonRepeatableOperationsTest
 * @notice Property-based test for cross-contract non-repeatable operations.
 * **Property 18: Repeated operations are rejected while prior state is retained**
 * **Validates: Requirements 3.2, 6.10, 8.10, 9.9**
 * 
 * This test validates that the following operations are non-repeatable:
 * 1. Registry registration (Req 3.2)
 * 2. Circle joining (Req 6.10) 
 * 3. Certificate issuance for the same course (Req 8.10)
 * 4. Governance voting on the same proposal (Req 9.9)
 */
contract CrossContractNonRepeatableOperationsTest is Test {
    // Core contracts
    Registry public registry;
    CommunityTreasury public treasury;
    Education public education;
    Governance public governance;
    MockERC20 public token;
    
    // Test accounts
    address public admin = makeAddr("admin");
    address public verifier = makeAddr("verifier");
    address public issuer = makeAddr("issuer");
    address public reputationManager = makeAddr("reputationManager");
    
    // Test data arrays for fuzzing
    address[] public testUsers;
    bytes32[] public testCourseIds;
    string[] public testMetadataHashes;
    
    uint256 public constant MAX_USERS = 20;
    uint256 public constant MAX_COURSES = 10;
    uint256 public constant MAX_CIRCLES = 5;
    uint256 public constant INITIAL_TOKEN_BALANCE = 100_000e18;
    
    function setUp() public {
        // Deploy mock ERC20 token
        token = new MockERC20("Test Token", "TEST", 18);
        
        // Deploy Registry proxy
        Registry registryImpl = new Registry();
        bytes memory registryData = abi.encodeCall(Registry.initialize, admin);
        ERC1967Proxy registryProxy = new ERC1967Proxy(address(registryImpl), registryData);
        registry = Registry(address(registryProxy));
        
        // Deploy CommunityTreasury proxy
        CommunityTreasury treasuryImpl = new CommunityTreasury();
        bytes memory treasuryData = abi.encodeCall(CommunityTreasury.initialize, (admin, IERC20(address(token))));
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(address(treasuryImpl), treasuryData);
        treasury = CommunityTreasury(address(treasuryProxy));
        
        // Deploy Education proxy
        Education educationImpl = new Education();
        bytes memory educationData = abi.encodeCall(Education.initialize, (admin, address(registry)));
        ERC1967Proxy educationProxy = new ERC1967Proxy(address(educationImpl), educationData);
        education = Education(address(educationProxy));
        
        // Deploy Governance proxy
        Governance governanceImpl = new Governance();
        bytes memory governanceData = abi.encodeCall(Governance.initialize, (admin, address(registry)));
        ERC1967Proxy governanceProxy = new ERC1967Proxy(address(governanceImpl), governanceData);
        governance = Governance(address(governanceProxy));
        
        // Setup roles
        vm.startPrank(admin);
        registry.grantRole(BFNRoles.VERIFIER_ROLE, verifier);
        registry.grantRole(BFNRoles.REPUTATION_ROLE, reputationManager);
        education.grantRole(BFNRoles.ISSUER_ROLE, issuer);
        registry.grantRole(BFNRoles.REPUTATION_ROLE, address(education));
        vm.stopPrank();
        
        // Initialize test data
        _setupTestData();
    }
    
    function _setupTestData() internal {
        // Create test users
        for (uint256 i = 0; i < MAX_USERS; i++) {
            address user = makeAddr(string(abi.encodePacked("user", i)));
            testUsers.push(user);
            
            // Mint tokens to users for treasury contributions
            token.mint(user, INITIAL_TOKEN_BALANCE);
        }
        
        // Create test course IDs and metadata hashes
        for (uint256 i = 0; i < MAX_COURSES; i++) {
            testCourseIds.push(keccak256(abi.encodePacked("course", i)));
            testMetadataHashes.push(string(abi.encodePacked("QmHash", i)));
        }
    }
    
    /**
     * @notice **Property 18: Registry registration is non-repeatable**
     * @dev Tests that attempting to register an already registered user reverts
     *      with AlreadyRegistered error while preserving the original registration state.
     * **Validates: Requirement 3.2**
     */
    function testProperty18_RegistryRegistrationNonRepeatable(
        uint8 userIndex,
        uint8 repeatAttempts
    ) public {
        // Bound inputs
        userIndex = uint8(bound(userIndex, 0, testUsers.length - 1));
        repeatAttempts = uint8(bound(repeatAttempts, 1, 10));
        
        address user = testUsers[userIndex];
        
        // Verify user is not initially registered
        assertFalse(registry.isRegistered(user), "User should not be initially registered");
        
        // First registration should succeed
        vm.prank(user);
        registry.register();
        
        // Verify successful registration
        assertTrue(registry.isRegistered(user), "User should be registered after first attempt");
        IRegistry.UserProfile memory initialProfile = registry.getProfile(user);
        assertTrue(initialProfile.registered, "Profile should show registered");
        uint256 initialTimestamp = initialProfile.registeredAt;
        assertGt(initialTimestamp, 0, "Registration timestamp should be set");
        
        // Attempt repeated registrations - all should revert with AlreadyRegistered
        for (uint256 i = 0; i < repeatAttempts; i++) {
            vm.prank(user);
            vm.expectRevert(abi.encodeWithSelector(IRegistry.AlreadyRegistered.selector, user));
            registry.register();
            
            // Verify state remains unchanged after failed attempt
            assertTrue(registry.isRegistered(user), "User should remain registered after failed repeat");
            IRegistry.UserProfile memory profileAfterFail = registry.getProfile(user);
            assertTrue(profileAfterFail.registered, "Profile should still show registered");
            assertEq(profileAfterFail.registeredAt, initialTimestamp, "Registration timestamp should be unchanged");
            assertEq(profileAfterFail.reputationScore, initialProfile.reputationScore, "Reputation should be unchanged");
            assertEq(profileAfterFail.verified, initialProfile.verified, "Verification status should be unchanged");
            assertEq(profileAfterFail.ipfsProfileHash, initialProfile.ipfsProfileHash, "Profile hash should be unchanged");
        }
    }
    
    /**
     * @notice **Property 18: Circle joining is non-repeatable**
     * @dev Tests that attempting to join a circle that a user is already a member of
     *      reverts with AlreadyMember error while preserving the existing membership.
     * **Validates: Requirement 6.10**
     */
    function testProperty18_CircleJoiningNonRepeatable(
        uint8 creatorIndex,
        uint8 joinerIndex,
        uint8 maxMembers,
        uint8 threshold,
        uint8 repeatAttempts
    ) public {
        // Bound inputs
        creatorIndex = uint8(bound(creatorIndex, 0, testUsers.length - 1));
        joinerIndex = uint8(bound(joinerIndex, 0, testUsers.length - 1));
        maxMembers = uint8(bound(maxMembers, 2, 10)); // Small range for testing
        threshold = uint8(bound(threshold, 1, 100));
        repeatAttempts = uint8(bound(repeatAttempts, 1, 10));
        
        // Ensure different users
        vm.assume(creatorIndex != joinerIndex);
        
        address creator = testUsers[creatorIndex];
        address joiner = testUsers[joinerIndex];
        
        // Register users (required for circle operations)
        vm.prank(creator);
        registry.register();
        vm.prank(joiner);
        registry.register();
        
        // Creator creates a circle
        vm.prank(creator);
        uint256 poolId = treasury.createCircle(maxMembers, threshold);
        
        // Verify initial circle state
        ICommunityTreasury.Circle memory initialCircle = treasury.getCircle(poolId);
        assertEq(initialCircle.memberCount, 1, "Circle should start with 1 member (creator)");
        assertTrue(treasury.isMember(poolId, creator), "Creator should be a member");
        assertFalse(treasury.isMember(poolId, joiner), "Joiner should not initially be a member");
        
        // First join should succeed
        vm.prank(joiner);
        treasury.joinCircle(poolId);
        
        // Verify successful join
        assertTrue(treasury.isMember(poolId, joiner), "Joiner should be a member after first join");
        ICommunityTreasury.Circle memory circleAfterJoin = treasury.getCircle(poolId);
        assertEq(circleAfterJoin.memberCount, 2, "Member count should increment to 2");
        
        // Attempt repeated joins - all should revert with AlreadyMember
        for (uint256 i = 0; i < repeatAttempts; i++) {
            vm.prank(joiner);
            vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.AlreadyMember.selector, joiner, poolId));
            treasury.joinCircle(poolId);
            
            // Verify membership state remains unchanged after failed attempt
            assertTrue(treasury.isMember(poolId, joiner), "Joiner should remain a member after failed repeat");
            ICommunityTreasury.Circle memory circleAfterFail = treasury.getCircle(poolId);
            assertEq(circleAfterFail.memberCount, 2, "Member count should remain 2 after failed repeat");
            assertEq(circleAfterFail.creator, creator, "Circle creator should be unchanged");
            assertEq(circleAfterFail.maxMembers, maxMembers, "Max members should be unchanged");
            assertEq(circleAfterFail.approvalThreshold, threshold, "Approval threshold should be unchanged");
        }
        
        // Test creator attempting to join own circle (should also fail)
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.AlreadyMember.selector, creator, poolId));
        treasury.joinCircle(poolId);
    }
    
    /**
     * @notice **Property 18: Certificate issuance is non-repeatable for same course**
     * @dev Tests that attempting to issue a certificate for a user/course combination
     *      that already has a certificate reverts with CertificateAlreadyIssued error
     *      while preserving the original certificate data.
     * **Validates: Requirement 8.10**
     */
    function testProperty18_CertificateIssuanceNonRepeatable(
        uint8 userIndex,
        uint8 courseIndex,
        uint8 repeatAttempts
    ) public {
        // Bound inputs
        userIndex = uint8(bound(userIndex, 0, testUsers.length - 1));
        courseIndex = uint8(bound(courseIndex, 0, testCourseIds.length - 1));
        repeatAttempts = uint8(bound(repeatAttempts, 1, 10));
        
        address user = testUsers[userIndex];
        bytes32 courseId = testCourseIds[courseIndex];
        string memory metadataHash = testMetadataHashes[courseIndex];
        
        // Register user (required for certificate issuance)
        vm.prank(user);
        registry.register();
        
        // Verify user doesn't initially have certificate
        assertFalse(education.hasCertificate(user, courseId), "User should not initially have certificate");
        
        // First certificate issuance should succeed
        vm.prank(issuer);
        education.issueCertificate(user, courseId, metadataHash);
        
        // Verify successful issuance
        assertTrue(education.hasCertificate(user, courseId), "User should have certificate after first issuance");
        IEducation.Certificate memory initialCert = education.getCertificate(user, courseId);
        assertGt(initialCert.id, 0, "Certificate ID should be greater than 0");
        assertEq(initialCert.courseId, courseId, "Course ID should match");
        assertEq(initialCert.ipfsMetadataHash, metadataHash, "Metadata hash should match");
        assertGt(initialCert.issuedAt, 0, "Issue timestamp should be set");
        
        // Attempt repeated issuances - all should revert with CertificateAlreadyIssued
        for (uint256 i = 0; i < repeatAttempts; i++) {
            vm.prank(issuer);
            vm.expectRevert(abi.encodeWithSelector(IEducation.CertificateAlreadyIssued.selector, user, courseId));
            education.issueCertificate(user, courseId, metadataHash);
            
            // Verify certificate state remains unchanged after failed attempt
            assertTrue(education.hasCertificate(user, courseId), "User should still have certificate after failed repeat");
            IEducation.Certificate memory certAfterFail = education.getCertificate(user, courseId);
            assertEq(certAfterFail.id, initialCert.id, "Certificate ID should be unchanged");
            assertEq(certAfterFail.courseId, initialCert.courseId, "Course ID should be unchanged");
            assertEq(certAfterFail.ipfsMetadataHash, initialCert.ipfsMetadataHash, "Metadata hash should be unchanged");
            assertEq(certAfterFail.issuedAt, initialCert.issuedAt, "Issue timestamp should be unchanged");
        }
        
        // Test that the same user can get certificates for different courses
        if (testCourseIds.length > 1) {
            uint256 secondCourseIndex = (courseIndex + 1) % testCourseIds.length;
            bytes32 secondCourseId = testCourseIds[secondCourseIndex];
            string memory secondMetadataHash = testMetadataHashes[secondCourseIndex];
            
            // Should succeed for different course
            assertFalse(education.hasCertificate(user, secondCourseId), "User should not have second certificate initially");
            vm.prank(issuer);
            education.issueCertificate(user, secondCourseId, secondMetadataHash);
            assertTrue(education.hasCertificate(user, secondCourseId), "User should have second certificate");
            
            // Original certificate should remain unchanged
            assertTrue(education.hasCertificate(user, courseId), "User should still have original certificate");
            IEducation.Certificate memory originalCertAfter = education.getCertificate(user, courseId);
            assertEq(originalCertAfter.id, initialCert.id, "Original certificate should be unchanged");
        }
    }
    
    /**
     * @notice **Property 18: Governance voting is non-repeatable for same proposal**
     * @dev Tests that attempting to vote on a proposal that a user has already voted on
     *      reverts with AlreadyVoted error while preserving the original vote.
     * **Validates: Requirement 9.9**
     */
    function testProperty18_GovernanceVotingNonRepeatable(
        uint8 proposerIndex,
        uint8 voterIndex,
        bool initialSupport,
        bool repeatSupport,
        uint8 repeatAttempts
    ) public {
        // Bound inputs
        proposerIndex = uint8(bound(proposerIndex, 0, testUsers.length - 1));
        voterIndex = uint8(bound(voterIndex, 0, testUsers.length - 1));
        repeatAttempts = uint8(bound(repeatAttempts, 1, 10));
        
        address proposer = testUsers[proposerIndex];
        address voter = testUsers[voterIndex];
        
        // Register users and give them reputation (required for voting power)
        vm.prank(proposer);
        registry.register();
        vm.prank(voter);
        registry.register();
        
        // Give users reputation for voting power
        vm.prank(reputationManager);
        registry.increaseReputation(proposer, 100);
        vm.prank(reputationManager);
        registry.increaseReputation(voter, 100);
        
        // Verify voting power
        assertGt(governance.votingPowerOf(proposer), 0, "Proposer should have voting power");
        assertGt(governance.votingPowerOf(voter), 0, "Voter should have voting power");
        
        // Create a proposal
        bytes memory testAction = abi.encode("test_action", block.timestamp);
        uint256 votingPeriod = 7 days;
        
        vm.prank(proposer);
        uint256 proposalId = governance.propose(testAction, votingPeriod);
        
        // Verify proposal state
        IGovernance.Proposal memory initialProposal = governance.getProposal(proposalId);
        assertEq(uint256(initialProposal.state), uint256(IGovernance.ProposalState.Active), "Proposal should be active");
        assertEq(initialProposal.forVotes, 0, "Should start with zero for votes");
        assertEq(initialProposal.againstVotes, 0, "Should start with zero against votes");
        
        // First vote should succeed
        vm.prank(voter);
        governance.castVote(proposalId, initialSupport);
        
        // Verify successful vote
        IGovernance.Proposal memory proposalAfterVote = governance.getProposal(proposalId);
        uint256 voterPower = governance.votingPowerOf(voter);
        
        if (initialSupport) {
            assertEq(proposalAfterVote.forVotes, voterPower, "For votes should match voter power");
            assertEq(proposalAfterVote.againstVotes, 0, "Against votes should remain 0");
        } else {
            assertEq(proposalAfterVote.forVotes, 0, "For votes should remain 0");
            assertEq(proposalAfterVote.againstVotes, voterPower, "Against votes should match voter power");
        }
        
        // Attempt repeated votes - all should revert with AlreadyVoted
        for (uint256 i = 0; i < repeatAttempts; i++) {
            vm.prank(voter);
            vm.expectRevert(abi.encodeWithSelector(IGovernance.AlreadyVoted.selector, voter, proposalId));
            governance.castVote(proposalId, repeatSupport);
            
            // Verify vote state remains unchanged after failed attempt
            IGovernance.Proposal memory proposalAfterFail = governance.getProposal(proposalId);
            assertEq(proposalAfterFail.forVotes, proposalAfterVote.forVotes, "For votes should be unchanged after failed repeat");
            assertEq(proposalAfterFail.againstVotes, proposalAfterVote.againstVotes, "Against votes should be unchanged after failed repeat");
            assertEq(uint256(proposalAfterFail.state), uint256(IGovernance.ProposalState.Active), "Proposal should remain active");
            assertEq(proposalAfterFail.proposer, proposer, "Proposer should be unchanged");
            assertEq(proposalAfterFail.votingEnds, initialProposal.votingEnds, "Voting end time should be unchanged");
        }
    }
    
    /**
     * @notice **Property 18: Cross-contract non-repeatable operations integrity**
     * @dev Comprehensive test that exercises all four non-repeatable operations in sequence
     *      to verify they maintain independence and don't interfere with each other.
     */
    function testProperty18_CrossContractNonRepeatableIntegrity(
        uint8 userIndex,
        uint8 courseIndex,
        uint8 circleParams
    ) public {
        // Bound inputs
        userIndex = uint8(bound(userIndex, 0, testUsers.length - 1));
        courseIndex = uint8(bound(courseIndex, 0, testCourseIds.length - 1));
        uint8 maxMembers = uint8(bound(circleParams, 2, 10));
        uint8 threshold = uint8(bound(circleParams >> 4, 1, 100));
        
        address user = testUsers[userIndex];
        bytes32 courseId = testCourseIds[courseIndex];
        string memory metadataHash = testMetadataHashes[courseIndex];
        
        // 1. Test Registry registration non-repeatability
        assertFalse(registry.isRegistered(user), "User should not be initially registered");
        
        vm.prank(user);
        registry.register();
        assertTrue(registry.isRegistered(user), "User should be registered");
        
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(IRegistry.AlreadyRegistered.selector, user));
        registry.register();
        
        // 2. Test Certificate issuance non-repeatability
        // Give user some reputation first
        vm.prank(reputationManager);
        registry.increaseReputation(user, 50);
        
        assertFalse(education.hasCertificate(user, courseId), "User should not have certificate initially");
        
        vm.prank(issuer);
        education.issueCertificate(user, courseId, metadataHash);
        assertTrue(education.hasCertificate(user, courseId), "User should have certificate");
        
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(IEducation.CertificateAlreadyIssued.selector, user, courseId));
        education.issueCertificate(user, courseId, metadataHash);
        
        // 3. Test Circle joining non-repeatability
        vm.prank(user);
        uint256 poolId = treasury.createCircle(maxMembers, threshold);
        assertTrue(treasury.isMember(poolId, user), "Creator should be a member");
        
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ICommunityTreasury.AlreadyMember.selector, user, poolId));
        treasury.joinCircle(poolId);
        
        // 4. Test Governance voting non-repeatability
        bytes memory testAction = abi.encode("test_action", block.timestamp);
        
        vm.prank(user);
        uint256 proposalId = governance.propose(testAction, 7 days);
        
        vm.prank(user);
        governance.castVote(proposalId, true);
        
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(IGovernance.AlreadyVoted.selector, user, proposalId));
        governance.castVote(proposalId, false);
        
        // Verify all states remain intact after failed repeated operations
        assertTrue(registry.isRegistered(user), "User should remain registered");
        assertTrue(education.hasCertificate(user, courseId), "User should still have certificate");
        assertTrue(treasury.isMember(poolId, user), "User should remain circle member");
        
        // Final verification that the governance proposal has the user's vote
        IGovernance.Proposal memory finalProposal = governance.getProposal(proposalId);
        assertGt(finalProposal.forVotes, 0, "Proposal should have for votes from user");
    }
    
    /**
     * @notice Test edge case: operations with zero/invalid state
     */
    function testProperty18_EdgeCasesInvalidState() public {
        address unregisteredUser = makeAddr("unregistered");
        
        // Test certificate issuance for unregistered user should fail differently
        // (This tests that non-repeatability checks don't interfere with other validations)
        vm.prank(issuer);
        vm.expectRevert(); // Should fail due to user not being registered, not due to repetition
        education.issueCertificate(unregisteredUser, testCourseIds[0], testMetadataHashes[0]);
        
        // Test governance voting without voting power should fail differently
        vm.prank(unregisteredUser);
        registry.register(); // Register but give no reputation
        
        bytes memory testAction = abi.encode("test_action", block.timestamp);
        
        vm.prank(unregisteredUser);
        vm.expectRevert(abi.encodeWithSelector(IGovernance.NoVotingPower.selector, unregisteredUser));
        governance.propose(testAction, 7 days);
    }
}