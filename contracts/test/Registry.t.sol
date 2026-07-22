// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Registry} from "../src/Registry.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";

/// @title RegistryTest
/// @notice Comprehensive tests for the Registry contract implementation (Task 3.1).
/// @dev Verifies Requirements 3.1-3.7, 3.10, 8.7, 13.1, 14.5, 14.8 implementation.
contract RegistryTest is Test {
    Registry public registry;
    
    address public admin = address(0x1);
    address public verifier = address(0x2);
    address public reputationManager = address(0x3);
    address public user1 = address(0x4);
    address public user2 = address(0x5);
    address public unregistered = address(0x6);
    
    string public constant IPFS_HASH = "QmTestHash123";
    string public constant EMPTY_HASH = "";
    
    event UserRegistered(address indexed user, uint256 timestamp);
    event ProfileUpdated(address indexed user, string ipfsProfileHash);
    event UserVerified(address indexed user, address indexed verifier);
    event ReputationIncreased(address indexed user, uint256 amount, uint256 newScore);
    
    function setUp() public {
        // Deploy Registry proxy
        Registry registryImpl = new Registry();
        bytes memory registryData = abi.encodeWithSelector(Registry.initialize.selector, admin);
        ERC1967Proxy registryProxy = new ERC1967Proxy(address(registryImpl), registryData);
        registry = Registry(address(registryProxy));
        
        // Grant roles
        vm.startPrank(admin);
        registry.grantRole(BFNRoles.VERIFIER_ROLE, verifier);
        registry.grantRole(BFNRoles.REPUTATION_ROLE, reputationManager);
        vm.stopPrank();
    }
    
    /// @notice Test successful registration (Req 3.1, 13.1)
    function testRegister() public {
        assertFalse(registry.isRegistered(user1));
        
        vm.expectEmit(true, false, false, true);
        emit UserRegistered(user1, block.timestamp);
        
        vm.prank(user1);
        registry.register();
        
        assertTrue(registry.isRegistered(user1));
        
        IRegistry.UserProfile memory profile = registry.getProfile(user1);
        assertTrue(profile.registered);
        assertFalse(profile.verified);
        assertEq(profile.reputationScore, 0);
        assertEq(profile.ipfsProfileHash, "");
        assertEq(profile.registeredAt, block.timestamp);
    }
    
    /// @notice Test registration reverts if already registered (Req 3.2)
    function testRegisterRevertsIfAlreadyRegistered() public {
        vm.prank(user1);
        registry.register();
        
        vm.expectRevert(abi.encodeWithSelector(IRegistry.AlreadyRegistered.selector, user1));
        vm.prank(user1);
        registry.register();
    }
    
    /// @notice Test successful profile update (Req 3.3)
    function testUpdateProfile() public {
        // Register first
        vm.prank(user1);
        registry.register();
        
        vm.expectEmit(true, false, false, true);
        emit ProfileUpdated(user1, IPFS_HASH);
        
        vm.prank(user1);
        registry.updateProfile(IPFS_HASH);
        
        IRegistry.UserProfile memory profile = registry.getProfile(user1);
        assertEq(profile.ipfsProfileHash, IPFS_HASH);
    }
    
    /// @notice Test profile update reverts for unregistered user (Req 3.4)
    function testUpdateProfileRevertsForUnregisteredUser() public {
        vm.expectRevert(abi.encodeWithSelector(IRegistry.NotRegistered.selector, unregistered));
        vm.prank(unregistered);
        registry.updateProfile(IPFS_HASH);
    }
    
    /// @notice Test profile update reverts for empty hash (Req 3.3)
    function testUpdateProfileRevertsForEmptyHash() public {
        vm.prank(user1);
        registry.register();
        
        vm.expectRevert(abi.encodeWithSelector(IRegistry.EmptyProfileHash.selector));
        vm.prank(user1);
        registry.updateProfile(EMPTY_HASH);
    }
    
    /// @notice Test successful user verification (Req 3.6)
    function testVerifyUser() public {
        vm.prank(user1);
        registry.register();
        
        assertFalse(registry.getProfile(user1).verified);
        
        vm.expectEmit(true, true, false, true);
        emit UserVerified(user1, verifier);
        
        vm.prank(verifier);
        registry.verifyUser(user1);
        
        assertTrue(registry.getProfile(user1).verified);
    }
    
    /// @notice Test verification reverts for unregistered user
    function testVerifyUserRevertsForUnregisteredUser() public {
        vm.expectRevert(abi.encodeWithSelector(IRegistry.NotRegistered.selector, unregistered));
        vm.prank(verifier);
        registry.verifyUser(unregistered);
    }
    
    /// @notice Test verification reverts for unauthorized caller (Req 3.10)
    function testVerifyUserRevertsForUnauthorizedCaller() public {
        vm.prank(user1);
        registry.register();
        
        vm.expectRevert();
        vm.prank(user2);
        registry.verifyUser(user1);
    }
    
    /// @notice Test idempotent verification (multiple verifications allowed)
    function testVerifyUserIsIdempotent() public {
        vm.prank(user1);
        registry.register();
        
        vm.prank(verifier);
        registry.verifyUser(user1);
        
        assertTrue(registry.getProfile(user1).verified);
        
        // Second verification should still emit event
        vm.expectEmit(true, true, false, true);
        emit UserVerified(user1, verifier);
        
        vm.prank(verifier);
        registry.verifyUser(user1);
        
        assertTrue(registry.getProfile(user1).verified);
    }
    
    /// @notice Test successful reputation increase (Req 8.7)
    function testIncreaseReputation() public {
        vm.prank(user1);
        registry.register();
        
        uint256 amount = 100;
        assertEq(registry.reputationOf(user1), 0);
        
        vm.expectEmit(true, false, false, true);
        emit ReputationIncreased(user1, amount, amount);
        
        vm.prank(reputationManager);
        registry.increaseReputation(user1, amount);
        
        assertEq(registry.reputationOf(user1), amount);
        assertEq(registry.getProfile(user1).reputationScore, amount);
    }
    
    /// @notice Test reputation increase reverts for unregistered user
    function testIncreaseReputationRevertsForUnregisteredUser() public {
        vm.expectRevert(abi.encodeWithSelector(IRegistry.NotRegistered.selector, unregistered));
        vm.prank(reputationManager);
        registry.increaseReputation(unregistered, 100);
    }
    
    /// @notice Test reputation increase reverts for unauthorized caller
    function testIncreaseReputationRevertsForUnauthorizedCaller() public {
        vm.prank(user1);
        registry.register();
        
        vm.expectRevert();
        vm.prank(user2);
        registry.increaseReputation(user1, 100);
    }
    
    /// @notice Test multiple reputation increases are cumulative (Req 3.7)
    function testMultipleReputationIncreases() public {
        vm.prank(user1);
        registry.register();
        
        vm.prank(reputationManager);
        registry.increaseReputation(user1, 50);
        assertEq(registry.reputationOf(user1), 50);
        
        vm.prank(reputationManager);
        registry.increaseReputation(user1, 75);
        assertEq(registry.reputationOf(user1), 125);
    }
    
    /// @notice Test view functions for unregistered user
    function testViewFunctionsForUnregisteredUser() public {
        assertFalse(registry.isRegistered(unregistered));
        assertEq(registry.reputationOf(unregistered), 0);
        
        IRegistry.UserProfile memory profile = registry.getProfile(unregistered);
        assertFalse(profile.registered);
        assertFalse(profile.verified);
        assertEq(profile.reputationScore, 0);
        assertEq(profile.ipfsProfileHash, "");
        assertEq(profile.registeredAt, 0);
    }
    
    /// @notice Test role-based access control (Req 14.5)
    function testRoleBasedAccess() public {
        // Admin has DEFAULT_ADMIN_ROLE and UPGRADER_ROLE
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(registry.hasRole(BFNRoles.UPGRADER_ROLE, admin));
        
        // Verifier has VERIFIER_ROLE
        assertTrue(registry.hasRole(BFNRoles.VERIFIER_ROLE, verifier));
        assertFalse(registry.hasRole(BFNRoles.VERIFIER_ROLE, user1));
        
        // ReputationManager has REPUTATION_ROLE
        assertTrue(registry.hasRole(BFNRoles.REPUTATION_ROLE, reputationManager));
        assertFalse(registry.hasRole(BFNRoles.REPUTATION_ROLE, user1));
    }
    
    /// @notice Test UUPS upgrade authorization (Req 14.8)
    function testUpgradeAuthorization() public {
        Registry newImpl = new Registry();
        
        // Admin (with UPGRADER_ROLE) can upgrade
        vm.prank(admin);
        registry.upgradeToAndCall(address(newImpl), "");
        
        // Non-admin cannot upgrade
        Registry anotherImpl = new Registry();
        vm.expectRevert();
        vm.prank(user1);
        registry.upgradeToAndCall(address(anotherImpl), "");
    }
    
    /// @notice Test zero admin reverts in initialization
    function testZeroAdminReverts() public {
        Registry registryImpl = new Registry();
        bytes memory registryData = abi.encodeWithSelector(Registry.initialize.selector, address(0));
        
        vm.expectRevert();
        new ERC1967Proxy(address(registryImpl), registryData);
    }
    
    /// @notice Test complete user lifecycle
    function testCompleteUserLifecycle() public {
        // 1. Register
        vm.prank(user1);
        registry.register();
        assertTrue(registry.isRegistered(user1));
        
        // 2. Update profile
        vm.prank(user1);
        registry.updateProfile(IPFS_HASH);
        assertEq(registry.getProfile(user1).ipfsProfileHash, IPFS_HASH);
        
        // 3. Get verified
        vm.prank(verifier);
        registry.verifyUser(user1);
        assertTrue(registry.getProfile(user1).verified);
        
        // 4. Gain reputation
        vm.prank(reputationManager);
        registry.increaseReputation(user1, 200);
        assertEq(registry.reputationOf(user1), 200);
        
        // Verify final state
        IRegistry.UserProfile memory profile = registry.getProfile(user1);
        assertTrue(profile.registered);
        assertTrue(profile.verified);
        assertEq(profile.reputationScore, 200);
        assertEq(profile.ipfsProfileHash, IPFS_HASH);
        assertGt(profile.registeredAt, 0);
    }
}