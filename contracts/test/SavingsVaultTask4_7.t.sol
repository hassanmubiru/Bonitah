// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {Registry} from "../src/Registry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {SavingsVaultReentrancyAttacker} from "./mocks/SavingsVaultReentrancyAttacker.sol";
import {ISavingsVault} from "../src/interfaces/ISavingsVault.sol";
import {IRegistry} from "../src/interfaces/IRegistry.sol";

/// @title SavingsVaultTask4_7Test
/// @notice Unit, event, revert, and reentrancy tests for SavingsVault per Task 4.7
/// @dev Validates Requirements 4.6, 13.2, 13.3, 13.4, 13.5, 15.1, 15.2, 15.3
contract SavingsVaultTask4_7Test is Test {
    SavingsVault public vault;
    Registry public registry;
    MockERC20 public token;
    SavingsVaultReentrancyAttacker public attacker;
    
    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public unregistered = makeAddr("unregistered");
    
    uint256 public constant INITIAL_BALANCE = 100_000e18;
    uint256 public constant DEPOSIT_AMOUNT = 1_000e18;
    uint256 public constant WITHDRAW_AMOUNT = 500e18;
    uint256 public constant GOAL_TARGET = 2_000e18;
    uint256 public constant LOCK_AMOUNT = 300e18;
    uint256 public constant LOCK_DURATION = 7 days;
    
    // All events from ISavingsVault interface
    event DepositMade(address indexed user, uint256 amount);
    event WithdrawalMade(address indexed user, uint256 amount);
    event GoalCreated(address indexed user, uint256 indexed goalId, uint256 targetAmount, uint256 targetDate);
    event GoalCompleted(address indexed user, uint256 indexed goalId);
    event FundsLocked(address indexed user, uint256 indexed lockId, uint256 amount, uint256 expiry);
    event LockReleased(address indexed user, uint256 indexed lockId, uint256 amount);

    function setUp() public {
        // Deploy mock token
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