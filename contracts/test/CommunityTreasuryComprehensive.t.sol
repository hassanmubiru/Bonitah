// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CommunityTreasury} from "../src/CommunityTreasury.sol";
import {ICommunityTreasury} from "../src/interfaces/ICommunityTreasury.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyAttacker} from "./mocks/ReentrancyAttacker.sol";

/**
 * Comprehensive unit, event, revert, and reentrancy tests for CommunityTreasury.
 * **Validates: Requirements 6.8, 13.6, 13.7, 13.8, 15.1, 15.2, 15.3**
 * 
 * This test suite covers:
 * 1. Event emission verification for all state changes (Req 13.6, 13.7, 13.8)
 * 2. Revert condition testing for each custom error (Req 15.2)
 * 3. Reentrancy attack protection (Req 6.8, 15.3)
 * 4. Edge cases and boundary conditions (Req 15.1)
 * 5. Access control and role management (Req 14.5, 14.8)
 */
contract CommunityTreasuryComprehensiveTest is Test {
    CommunityTreasury public treasury;
    MockERC20 public token;
    ReentrancyAttacker public attacker;
    
    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public recipient = makeAddr("recipient");
    address public unauthorized = makeAddr("unauthorized");
    
    uint256 public constant INITIAL_BALANCE = 10000e18;
    
    // Test events
    event PoolCreated(address indexed creator, uint256 indexed poolId, uint256 maxMembers, uint8 approvalThreshold);
    event MemberJoined(uint256 indexed poolId, address indexed member);
    event ContributionMade(address indexed contributor, uint256 indexed poolId, uint256 amount);
    event VoteCast(address indexed voter, uint256 indexed actionId);
    event ActionExecuted(uint256 indexed actionId, address indexed to, uint256 amount);
    
    function setUp() public {
        // Deploy mock ERC20 token
        token = new MockERC20("Test Token", "TEST", 18);
        
        // Deploy CommunityTreasury proxy
        CommunityTreasury implementation = new CommunityTreasury();
        bytes memory initData = abi.encodeCall(CommunityTreasury.initialize, (admin, IERC20(address(token))));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        treasury = CommunityTreasury(address(proxy));
        
        // Deploy reentrancy attacker
        attacker = new ReentrancyAttacker(treasury, token);
        
        // Setup test users with tokens and approvals
        address[4] memory users = [user1, user2, user3, address(attacker)];
        for (uint256 i = 0; i < users.length; i++) {
            token.mint(users[i], INITIAL_BALANCE);
            vm.prank(users[i]);
            token.approve(address(treasury), INITIAL_BALANCE);
        }
    }
    
    // ========== EVENT EMISSION TESTS (Req 13.6, 13.7, 13.8) ==========
    
    /**
     * Test PoolCreated event emission with correct parameters (Req 13.6)
     */
    function test_EventEmission_PoolCreated() public {
        uint256 maxMembers = 10;
        uint8 approvalThreshold = 51;
        
        vm.expectEmit(true, true, false, true);
        emit PoolCreated(user1, 1, maxMembers, approvalThreshold);
        
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(maxMembers, approvalThreshold);
        
        assertEq(poolId, 1, "Pool ID should be 1");
    }
    
    /**
     * Test MemberJoined event emission (Req 13.6)
     */
    function test_EventEmission_MemberJoined() public {
        vm.prank(user1);
        uint256 poolId = treasury.createCircle(10, 51);
        
        vm.expectEmit(true, true, false, false);
        emit MemberJoined(poolId, user2);
        
        vm.prank(user2);
        treasury.joinCircle(poolId);
    }