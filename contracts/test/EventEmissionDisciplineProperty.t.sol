// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Vm} from "forge-std/Vm.sol";

// Contract imports
import {Registry} from "../src/Registry.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {Education} from "../src/Education.sol";
import {Governance} from "../src/Governance.sol";

// Interface imports
import {IRegistry} from "../src/interfaces/IRegistry.sol";
import {ISavingsVault} from "../src/interfaces/ISavingsVault.sol";
import {ICommunityTreasury} from "../src/interfaces/ICommunityTreasury.sol";
import {IEducation} from "../src/interfaces/IEducation.sol";
import {IGovernance} from "../src/interfaces/IGovernance.sol";

// Mock imports
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";

/// @title EventEmissionDisciplinePropertyTest
/// @notice Property-based tests for event emission discipline across all BFN contracts.
/// @dev **Property 33: Exactly one event per successful state change; none on revert**
///      **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10**
///
///      This comprehensive test validates event emission discipline across all contracts:
///      - Registry: UserRegistered, ProfileUpdated, UserVerified, ReputationIncreased
///      - SavingsVault: DepositMade, WithdrawalMade, GoalCreated, GoalCompleted, FundsLocked, LockReleased
///      - CommunityTreasury: PoolCreated, MemberJoined, ContributionMade, VoteCast, ActionExecuted
///      - Education: CertificateIssued, BadgeAwarded, AchievementRecorded
///      - Governance: ProposalCreated, VoteCast, ProposalFinalized
///
///      The test ensures:
///      1. Successful operations emit exactly one event of the correct type
///      2. Failed/reverted operations emit no events
///      3. Event arguments match the operation parameters exactly
///      4. No duplicate events are emitted for single operations
contract EventEmissionDisciplinePropertyTest is Test {
    // All contract instances
    Registry public registry;
    SavingsVault public vault;
    CommunityTreasury public treasury;
    Education public education;
    Governance public governance;
    MockERC20 public token;
    
    // Test addresses
    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public verifier = makeAddr("verifier");
    address public issuer = makeAddr("issuer");
    address public pauser = makeAddr("pauser");
    
    // Constants
    uint256 public constant INITIAL_TOKEN_BALANCE = 1_000_000e18;
    uint256 public constant MIN_AMOUNT = 1e18;
    uint256 public constant MAX_AMOUNT = 10_000e18;
    function setUp() public {
        // Deploy mock ERC20 token
        token = new MockERC20("Test Token", "TEST", 18);
        
        // Deploy Registry proxy
        Registry registryImpl = new Registry();
        bytes memory registryData = abi.encodeCall(Registry.initialize, admin);
        ERC1967Proxy registryProxy = new ERC1967Proxy(address(registryImpl), registryData);
        registry = Registry(address(registryProxy));
        
        // Deploy SavingsVault proxy
        SavingsVault vaultImpl = new SavingsVault();
        bytes memory vaultData = abi.encodeCall(
            SavingsVault.initialize,
            (address(token), address(registry), admin)
        );
        ERC1967Proxy vaultProxy = new ERC1967Proxy(address(vaultImpl), vaultData);
        vault = SavingsVault(address(vaultProxy));
        
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
        
        // Grant necessary roles
        vm.startPrank(admin);
        registry.grantRole(BFNRoles.VERIFIER_ROLE, verifier);
        registry.grantRole(BFNRoles.REPUTATION_ROLE, address(education));
        education.grantRole(BFNRoles.ISSUER_ROLE, issuer);
        vault.grantRole(BFNRoles.PAUSER_ROLE, pauser);
        treasury.grantRole(BFNRoles.PAUSER_ROLE, pauser);
        governance.grantRole(BFNRoles.TREASURY_ROLE, address(treasury));
        vm.stopPrank();
        
        // Register users and give them some reputation for governance
        vm.prank(user1);
        registry.register();
        vm.prank(user2);
        registry.register();
        
        // Grant some reputation to users for governance operations
        vm.prank(address(education));
        registry.increaseReputation(user1, 100);
        vm.prank(address(education));
        registry.increaseReputation(user2, 100);
        
        // Mint tokens to users
        token.mint(user1, INITIAL_TOKEN_BALANCE);
        token.mint(user2, INITIAL_TOKEN_BALANCE);
        
        // Approve contracts to spend tokens
        vm.prank(user1);
        token.approve(address(vault), type(uint256).max);
        vm.prank(user1);
        token.approve(address(treasury), type(uint256).max);
        vm.prank(user2);
        token.approve(address(vault), type(uint256).max);
        vm.prank(user2);
        token.approve(address(treasury), type(uint256).max);
    }
    
    /// @notice **Property 33: Exactly one event per successful state change; none on revert**
    /// **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10**
    ///
    /// This property comprehensively tests event emission discipline across all contracts.
    /// It verifies that successful operations emit exactly one event with correct arguments,
    /// while failed operations emit no events at all.
    function testProperty33_EventEmissionDiscipline(
        uint256 _operation,
        uint256 _amount,
        uint8 _threshold,
        uint8 _maxMembers,
        bytes32 _courseId,
        bytes32 _badgeId
    ) public {
        // Bound inputs to valid ranges
        uint256 operation = bound(_operation, 0, 21); // 22 different operations to test
        uint256 amount = bound(_amount, MIN_AMOUNT, MAX_AMOUNT);
        uint8 threshold = uint8(bound(_threshold, 1, 100));
        uint8 maxMembers = uint8(bound(_maxMembers, 2, 20)); // Reasonable test range
        
        // Use distinct course and badge IDs to avoid conflicts
        bytes32 courseId = keccak256(abi.encodePacked("course", _courseId));
        bytes32 badgeId = keccak256(abi.encodePacked("badge", _badgeId));
        
        if (operation == 0) {
            _testRegistryUserRegistration();
        } else if (operation == 1) {
            _testRegistryProfileUpdate();
        } else if (operation == 2) {
            _testRegistryUserVerification();
        } else if (operation == 3) {
            _testRegistryReputationIncrease(amount);
        } else if (operation == 4) {
            _testSavingsVaultDeposit(amount);
        } else if (operation == 5) {
            _testSavingsVaultWithdrawal(amount);
        } else if (operation == 6) {
            _testSavingsVaultGoalCreation(amount);
        } else if (operation == 7) {
            _testSavingsVaultFundsLocking(amount);
        } else if (operation == 8) {
            _testSavingsVaultGoalCompletion(amount);
        } else if (operation == 9) {
            _testSavingsVaultLockRelease(amount);
        } else if (operation == 10) {
            _testCommunityTreasuryCircleCreation(maxMembers, threshold);
        } else if (operation == 11) {
            _testCommunityTreasuryMemberJoining();
        } else if (operation == 12) {
            _testCommunityTreasuryContribution(amount);
        } else if (operation == 13) {
            _testCommunityTreasuryVoting();
        } else if (operation == 14) {
            _testEducationCertificateIssuance(courseId);
        } else if (operation == 15) {
            _testEducationBadgeAwarding(badgeId);
        } else if (operation == 16) {
            _testEducationAchievementRecording(badgeId, amount);
        } else if (operation == 17) {
            _testGovernanceProposalCreation();
        } else if (operation == 18) {
            _testGovernanceVoteCasting();
        } else if (operation == 19) {
            _testGovernanceProposalFinalization();
        } else if (operation == 20) {
            _testFailedOperationsEmitNoEvents(amount);
        } else if (operation == 21) {
            _testRevertingOperationsEmitNoEvents();
        }
    }
    
    // Registry Event Tests
    function _testRegistryUserRegistration() internal {
        address newUser = makeAddr("newUser");
        
        // Record logs before the operation
        vm.recordLogs();
        
        // Perform registration
        vm.prank(newUser);
        registry.register();
        
        // Check exactly one event was emitted
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1, "Exactly one event should be emitted for user registration");
        
        // Verify event is UserRegistered with correct parameters
        assertEq(logs[0].topics[0], keccak256("UserRegistered(address,uint256)"), "Event should be UserRegistered");
        assertEq(address(uint160(uint256(logs[0].topics[1]))), newUser, "Event should contain correct user address");
        uint256 timestamp = abi.decode(logs[0].data, (uint256));
        assertEq(timestamp, block.timestamp, "Event should contain correct timestamp");
    }
    
    function _testRegistryProfileUpdate() internal {
        string memory profileHash = "QmTestProfileHash";
        
        vm.recordLogs();
        
        vm.prank(user1);
        registry.updateProfile(profileHash);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1, "Exactly one event should be emitted for profile update");
        assertEq(logs[0].topics[0], keccak256("ProfileUpdated(address,string)"), "Event should be ProfileUpdated");
        assertEq(address(uint160(uint256(logs[0].topics[1]))), user1, "Event should contain correct user address");
        string memory eventProfileHash = abi.decode(logs[0].data, (string));
        assertEq(eventProfileHash, profileHash, "Event should contain correct profile hash");
    }
    
    function _testRegistryUserVerification() internal {
        vm.recordLogs();
        
        vm.prank(verifier);
        registry.verifyUser(user1);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1, "Exactly one event should be emitted for user verification");
        assertEq(logs[0].topics[0], keccak256("UserVerified(address,address)"), "Event should be UserVerified");
        assertEq(address(uint160(uint256(logs[0].topics[1]))), user1, "Event should contain correct user address");
        assertEq(address(uint160(uint256(logs[0].topics[2]))), verifier, "Event should contain correct verifier address");
    }
    
    function _testRegistryReputationIncrease(uint256 amount) internal {
        // Get current reputation to calculate expected new score
        uint256 currentReputation = registry.reputationOf(user1);
        
        vm.recordLogs();
        
        vm.prank(address(education));
        registry.increaseReputation(user1, amount);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1, "Exactly one event should be emitted for reputation increase");
        assertEq(logs[0].topics[0], keccak256("ReputationIncreased(address,uint256,uint256)"), "Event should be ReputationIncreased");
        assertEq(address(uint160(uint256(logs[0].topics[1]))), user1, "Event should contain correct user address");
        (uint256 eventAmount, uint256 newScore) = abi.decode(logs[0].data, (uint256, uint256));
        assertEq(eventAmount, amount, "Event should contain correct amount");
        assertEq(newScore, currentReputation + amount, "Event should contain correct new score");
    }
    
    // SavingsVault Event Tests
    function _testSavingsVaultDeposit(uint256 amount) internal {
        vm.recordLogs();
        
        vm.prank(user1);
        vault.deposit(amount);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        // Filter out ERC20 Transfer events, focus on vault events
        uint256 vaultEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(vault)) {
                vaultEventCount++;
                assertEq(logs[i].topics[0], keccak256("DepositMade(address,uint256)"), "Event should be DepositMade");
                assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct user address");
                uint256 eventAmount = abi.decode(logs[i].data, (uint256));
                assertEq(eventAmount, amount, "Event should contain correct amount");
            }
        }
        assertEq(vaultEventCount, 1, "Exactly one vault event should be emitted for deposit");
    }
    
    function _testSavingsVaultWithdrawal(uint256 amount) internal {
        // First deposit to have something to withdraw
        vm.prank(user1);
        vault.deposit(amount * 2);
        
        vm.recordLogs();
        
        vm.prank(user1);
        vault.withdraw(amount);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 vaultEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(vault)) {
                vaultEventCount++;
                assertEq(logs[i].topics[0], keccak256("WithdrawalMade(address,uint256)"), "Event should be WithdrawalMade");
                assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct user address");
                uint256 eventAmount = abi.decode(logs[i].data, (uint256));
                assertEq(eventAmount, amount, "Event should contain correct amount");
            }
        }
        assertEq(vaultEventCount, 1, "Exactly one vault event should be emitted for withdrawal");
    }
    
    function _testSavingsVaultGoalCreation(uint256 targetAmount) internal {
        uint256 targetDate = block.timestamp + 30 days;
        
        vm.recordLogs();
        
        vm.prank(user1);
        vault.createGoal(targetAmount, targetDate);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 vaultEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(vault)) {
                vaultEventCount++;
                assertEq(logs[i].topics[0], keccak256("GoalCreated(address,uint256,uint256,uint256)"), "Event should be GoalCreated");
                assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct user address");
                uint256 goalId = uint256(logs[i].topics[2]);
                (uint256 eventTargetAmount, uint256 eventTargetDate) = abi.decode(logs[i].data, (uint256, uint256));
                assertEq(eventTargetAmount, targetAmount, "Event should contain correct target amount");
                assertEq(eventTargetDate, targetDate, "Event should contain correct target date");
                assertGe(goalId, 0, "Goal ID should be non-negative");
            }
        }
        assertEq(vaultEventCount, 1, "Exactly one vault event should be emitted for goal creation");
    }
    
    function _testSavingsVaultFundsLocking(uint256 amount) internal {
        // First deposit to have funds to lock
        vm.prank(user1);
        vault.deposit(amount * 2);
        
        uint256 duration = 30 days;
        
        vm.recordLogs();
        
        vm.prank(user1);
        vault.lockFunds(amount, duration);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 vaultEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(vault)) {
                vaultEventCount++;
                assertEq(logs[i].topics[0], keccak256("FundsLocked(address,uint256,uint256,uint256)"), "Event should be FundsLocked");
                assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct user address");
                uint256 lockId = uint256(logs[i].topics[2]);
                (uint256 eventAmount, uint256 expiry) = abi.decode(logs[i].data, (uint256, uint256));
                assertEq(eventAmount, amount, "Event should contain correct amount");
                assertEq(expiry, block.timestamp + duration, "Event should contain correct expiry");
                assertGe(lockId, 0, "Lock ID should be non-negative");
            }
        }
        assertEq(vaultEventCount, 1, "Exactly one vault event should be emitted for funds locking");
    }
    
    function _testSavingsVaultGoalCompletion(uint256 amount) internal {
        // Create goal and contribute to complete it
        uint256 targetDate = block.timestamp + 30 days;
        vm.prank(user1);
        vault.createGoal(amount, targetDate);
        
        // Deposit the required amount
        vm.prank(user1);
        vault.deposit(amount * 2);
        
        vm.recordLogs();
        
        vm.prank(user1);
        vault.contributeToGoal(0, amount);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 vaultEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(vault)) {
                vaultEventCount++;
                // Could be GoalCompleted event if the contribution completed the goal
                if (logs[i].topics[0] == keccak256("GoalCompleted(address,uint256)")) {
                    assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct user address");
                    assertEq(uint256(logs[i].topics[2]), 0, "Event should contain correct goal ID");
                }
            }
        }
        assertGe(vaultEventCount, 1, "At least one vault event should be emitted for goal contribution");
    }
    
    function _testSavingsVaultLockRelease(uint256 amount) internal {
        // First deposit and lock funds
        vm.prank(user1);
        vault.deposit(amount * 2);
        
        uint256 duration = 1 days;
        vm.prank(user1);
        vault.lockFunds(amount, duration);
        
        // Move past lock expiry
        vm.warp(block.timestamp + duration + 1);
        
        vm.recordLogs();
        
        vm.prank(user1);
        vault.withdrawLocked(0);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 vaultEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(vault)) {
                vaultEventCount++;
                assertEq(logs[i].topics[0], keccak256("LockReleased(address,uint256,uint256)"), "Event should be LockReleased");
                assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct user address");
                assertEq(uint256(logs[i].topics[2]), 0, "Event should contain correct lock ID");
                uint256 eventAmount = abi.decode(logs[i].data, (uint256));
                assertEq(eventAmount, amount, "Event should contain correct amount");
            }
        }
        assertEq(vaultEventCount, 1, "Exactly one vault event should be emitted for lock release");
    }
    
    // CommunityTreasury Event Tests
    function _testCommunityTreasuryCircleCreation(uint256 maxMembers, uint256 threshold) internal {
        vm.recordLogs();
        
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(maxMembers, uint8(threshold));
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 treasuryEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(treasury)) {
                treasuryEventCount++;
                assertEq(logs[i].topics[0], keccak256("PoolCreated(address,uint256,uint256,uint8)"), "Event should be PoolCreated");
                assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct creator address");
                assertEq(uint256(logs[i].topics[2]), poolId, "Event should contain correct pool ID");
                (uint256 eventMaxMembers, uint8 eventThreshold) = abi.decode(logs[i].data, (uint256, uint8));
                assertEq(eventMaxMembers, maxMembers, "Event should contain correct max members");
                assertEq(eventThreshold, uint8(threshold), "Event should contain correct threshold");
            }
        }
        assertEq(treasuryEventCount, 1, "Exactly one treasury event should be emitted for circle creation");
    }
    
    function _testCommunityTreasuryMemberJoining() internal {
        // Create a circle first
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 50);
        
        vm.recordLogs();
        
        vm.prank(user2);
        treasury.joinCircle(poolId);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 treasuryEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(treasury)) {
                treasuryEventCount++;
                assertEq(logs[i].topics[0], keccak256("MemberJoined(uint256,address)"), "Event should be MemberJoined");
                assertEq(uint256(logs[i].topics[1]), poolId, "Event should contain correct pool ID");
                assertEq(address(uint160(uint256(logs[i].topics[2]))), user2, "Event should contain correct member address");
            }
        }
        assertEq(treasuryEventCount, 1, "Exactly one treasury event should be emitted for member joining");
    }
    
    function _testCommunityTreasuryContribution(uint256 amount) internal {
        // Create a circle first
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 50);
        
        vm.recordLogs();
        
        vm.prank(user1);
        treasury.contribute(poolId, amount);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 treasuryEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(treasury)) {
                treasuryEventCount++;
                assertEq(logs[i].topics[0], keccak256("ContributionMade(address,uint256,uint256)"), "Event should be ContributionMade");
                assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct contributor address");
                assertEq(uint256(logs[i].topics[2]), poolId, "Event should contain correct pool ID");
                uint256 eventAmount = abi.decode(logs[i].data, (uint256));
                assertEq(eventAmount, amount, "Event should contain correct amount");
            }
        }
        assertEq(treasuryEventCount, 1, "Exactly one treasury event should be emitted for contribution");
    }
    
    function _testCommunityTreasuryVoting() internal {
        // Create circle, join as second member, contribute, and propose action
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 50);
        vm.prank(user2);
        treasury.joinCircle(poolId);
        vm.prank(user1);
        treasury.contribute(poolId, MIN_AMOUNT * 10);
        vm.prank(user1);
        uint256 actionId = treasury.proposeAction(poolId, user2, MIN_AMOUNT);
        
        vm.recordLogs();
        
        vm.prank(user1);
        treasury.vote(actionId);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 treasuryEventCount = 0;
        bool foundVoteCast = false;
        
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(treasury)) {
                treasuryEventCount++;
                if (logs[i].topics[0] == keccak256("VoteCast(address,uint256)")) {
                    foundVoteCast = true;
                    assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct voter address");
                    assertEq(uint256(logs[i].topics[2]), actionId, "Event should contain correct action ID");
                } else if (logs[i].topics[0] == keccak256("ActionExecuted(uint256,address,uint256)")) {
                    // This can happen if the vote meets threshold and auto-executes
                    assertEq(uint256(logs[i].topics[1]), actionId, "Event should contain correct action ID");
                    assertEq(address(uint160(uint256(logs[i].topics[2]))), user2, "Event should contain correct recipient address");
                }
            }
        }
        
        assertTrue(foundVoteCast, "VoteCast event should be emitted");
        assertGe(treasuryEventCount, 1, "At least one treasury event should be emitted for voting");
        assertLe(treasuryEventCount, 2, "At most two treasury events should be emitted (VoteCast + optional ActionExecuted)");
    }
    
    // Education Event Tests
    function _testEducationCertificateIssuance(bytes32 courseId) internal {
        string memory metadataHash = "QmTestCertificateMetadata";
        
        vm.recordLogs();
        
        vm.prank(issuer);
        education.issueCertificate(user1, courseId, metadataHash);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 educationEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(education)) {
                educationEventCount++;
                assertEq(logs[i].topics[0], keccak256("CertificateIssued(address,uint256,bytes32)"), "Event should be CertificateIssued");
                assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct user address");
                uint256 certificateId = uint256(logs[i].topics[2]);
                bytes32 eventCourseId = bytes32(logs[i].topics[3]);
                assertEq(eventCourseId, courseId, "Event should contain correct course ID");
                assertGe(certificateId, 0, "Certificate ID should be non-negative");
            }
        }
        assertEq(educationEventCount, 1, "Exactly one education event should be emitted for certificate issuance");
    }
    
    function _testEducationBadgeAwarding(bytes32 badgeId) internal {
        vm.recordLogs();
        
        vm.prank(issuer);
        education.awardBadge(user1, badgeId);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 educationEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(education)) {
                educationEventCount++;
                assertEq(logs[i].topics[0], keccak256("BadgeAwarded(address,bytes32)"), "Event should be BadgeAwarded");
                assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct user address");
                assertEq(bytes32(logs[i].topics[2]), badgeId, "Event should contain correct badge ID");
            }
        }
        assertEq(educationEventCount, 1, "Exactly one education event should be emitted for badge awarding");
    }
    
    function _testEducationAchievementRecording(bytes32 achievementId, uint256 reputationAmount) internal {
        vm.recordLogs();
        
        vm.prank(issuer);
        education.recordAchievement(user1, achievementId, reputationAmount);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 educationEventCount = 0;
        uint256 registryEventCount = 0;
        
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(education)) {
                educationEventCount++;
                assertEq(logs[i].topics[0], keccak256("AchievementRecorded(address,bytes32,uint256)"), "Event should be AchievementRecorded");
                assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct user address");
                assertEq(bytes32(logs[i].topics[2]), achievementId, "Event should contain correct achievement ID");
                uint256 eventReputationAmount = abi.decode(logs[i].data, (uint256));
                assertEq(eventReputationAmount, reputationAmount, "Event should contain correct reputation amount");
            } else if (logs[i].emitter == address(registry)) {
                registryEventCount++;
                // This should be ReputationIncreased event from the cross-contract call
                assertEq(logs[i].topics[0], keccak256("ReputationIncreased(address,uint256,uint256)"), "Registry event should be ReputationIncreased");
            }
        }
        
        assertEq(educationEventCount, 1, "Exactly one education event should be emitted for achievement recording");
        assertEq(registryEventCount, 1, "Exactly one registry event should be emitted for reputation increase");
    }
    
    // Governance Event Tests
    function _testGovernanceProposalCreation() internal {
        bytes memory action = abi.encodeCall(governance.executeTreasury, ("test"));
        uint256 votingPeriod = 7 days;
        
        vm.recordLogs();
        
        vm.prank(user1);
        uint256 proposalId = governance.propose(action, votingPeriod);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 governanceEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(governance)) {
                governanceEventCount++;
                assertEq(logs[i].topics[0], keccak256("ProposalCreated(address,uint256,uint256)"), "Event should be ProposalCreated");
                assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct proposer address");
                assertEq(uint256(logs[i].topics[2]), proposalId, "Event should contain correct proposal ID");
                uint256 votingEnds = abi.decode(logs[i].data, (uint256));
                assertEq(votingEnds, block.timestamp + votingPeriod, "Event should contain correct voting end time");
            }
        }
        assertEq(governanceEventCount, 1, "Exactly one governance event should be emitted for proposal creation");
    }
    
    function _testGovernanceVoteCasting() internal {
        // Create proposal first
        bytes memory action = abi.encodeCall(governance.executeTreasury, ("test"));
        vm.prank(user1);
        uint256 proposalId = governance.propose(action, 7 days);
        
        vm.recordLogs();
        
        vm.prank(user1);
        governance.castVote(proposalId, true);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 governanceEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(governance)) {
                governanceEventCount++;
                assertEq(logs[i].topics[0], keccak256("VoteCast(address,uint256,uint256,bool)"), "Event should be VoteCast");
                assertEq(address(uint160(uint256(logs[i].topics[1]))), user1, "Event should contain correct voter address");
                assertEq(uint256(logs[i].topics[2]), proposalId, "Event should contain correct proposal ID");
                (uint256 weight, bool support) = abi.decode(logs[i].data, (uint256, bool));
                assertGt(weight, 0, "Vote weight should be positive");
                assertTrue(support, "Vote support should be true");
            }
        }
        assertEq(governanceEventCount, 1, "Exactly one governance event should be emitted for vote casting");
    }
    
    function _testGovernanceProposalFinalization() internal {
        // Create proposal and let time pass
        bytes memory action = abi.encodeCall(governance.executeTreasury, ("test"));
        vm.prank(user1);
        uint256 proposalId = governance.propose(action, 1 seconds); // Short voting period
        
        vm.warp(block.timestamp + 2 seconds); // Move past voting period
        
        vm.recordLogs();
        
        vm.prank(user1);
        governance.finalize(proposalId);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 governanceEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(governance)) {
                governanceEventCount++;
                assertEq(logs[i].topics[0], keccak256("ProposalFinalized(uint256,uint8)"), "Event should be ProposalFinalized");
                assertEq(uint256(logs[i].topics[1]), proposalId, "Event should contain correct proposal ID");
                uint8 result = abi.decode(logs[i].data, (uint8));
                // Result should be valid ProposalState enum value
                assertTrue(result <= 3, "Proposal result should be valid enum value");
            }
        }
        assertEq(governanceEventCount, 1, "Exactly one governance event should be emitted for proposal finalization");
    }
    
    // Test Failed Operations Emit No Events
    function _testFailedOperationsEmitNoEvents(uint256 amount) internal {
        // Test 1: Registry - Double registration should emit no events
        address newUser = makeAddr("testUser");
        vm.prank(newUser);
        registry.register();
        
        vm.recordLogs();
        vm.prank(newUser);
        vm.expectRevert(abi.encodeWithSelector(IRegistry.AlreadyRegistered.selector, newUser));
        registry.register();
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 0, "No events should be emitted on failed registry operation");
        
        // Test 2: SavingsVault - Withdrawal exceeding balance should emit no events
        vm.recordLogs();
        vm.prank(user1);
        vm.expectRevert();
        vault.withdraw(amount * 1000); // Excessive amount
        
        logs = vm.getRecordedLogs();
        uint256 vaultEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(vault)) {
                vaultEventCount++;
            }
        }
        assertEq(vaultEventCount, 0, "No vault events should be emitted on failed withdrawal");
        
        // Test 3: CommunityTreasury - Invalid circle parameters should emit no events
        vm.recordLogs();
        vm.prank(user1);
        vm.expectRevert(ICommunityTreasury.InvalidCircleParams.selector);
        treasury.createCircle(1, 50); // Invalid maxMembers < 2
        
        logs = vm.getRecordedLogs();
        uint256 treasuryEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(treasury)) {
                treasuryEventCount++;
            }
        }
        assertEq(treasuryEventCount, 0, "No treasury events should be emitted on failed circle creation");
    }
    
    function _testRevertingOperationsEmitNoEvents() internal {
        // Test 4: Education - Empty metadata hash should emit no events
        vm.recordLogs();
        vm.prank(issuer);
        vm.expectRevert(IEducation.EmptyMetadataHash.selector);
        education.issueCertificate(user1, bytes32("course1"), "");
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 educationEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(education)) {
                educationEventCount++;
            }
        }
        assertEq(educationEventCount, 0, "No education events should be emitted on failed certificate issuance");
        
        // Test 5: Governance - No voting power should emit no events
        address noReputationUser = makeAddr("noReputationUser");
        vm.prank(noReputationUser);
        registry.register();
        
        bytes memory action = abi.encodeCall(governance.executeTreasury, ("test"));
        
        vm.recordLogs();
        vm.prank(noReputationUser);
        vm.expectRevert(abi.encodeWithSelector(IGovernance.NoVotingPower.selector, noReputationUser));
        governance.propose(action, 7 days);
        
        logs = vm.getRecordedLogs();
        uint256 governanceEventCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(governance)) {
                governanceEventCount++;
            }
        }
        assertEq(governanceEventCount, 0, "No governance events should be emitted on failed proposal creation");
    }
}