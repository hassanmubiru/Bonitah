// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ISavingsVault} from "./interfaces/ISavingsVault.sol";
import {IRegistry} from "./interfaces/IRegistry.sol";

/// @title SavingsVault
/// @notice Personal, per-user savings vault for the Bonitah Financial Network.
///         Registered users deposit and withdraw a configurable ERC20 stablecoin;
///         all financial state is held on-chain and every state change emits an event.
/// @dev Deployed behind a UUPS proxy (Req 9.8). Cross-cutting controls per Req 14:
///      `AccessControlUpgradeable` for roles, `ReentrancyGuardUpgradeable` on value
///      transfers (Req 4.6), `PausableUpgradeable` gating deposits/withdrawals (Req 4.7),
///      and `SafeERC20` for all token movement (Req 4.5).
///
///      This file currently implements the deposit/withdraw core (task 4.1). Savings
///      goals and time-locked savings (`createGoal`, `contributeToGoal`, `lockFunds`,
///      `withdrawLocked`, `portfolioValue`) are completed in task 4.4; their storage
///      hook `lockedTotal` is defined here so `availableBalance` is correct throughout.
contract SavingsVault is
    ISavingsVault,
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    /// @notice Role permitted to pause and unpause the vault (Req 14.5).
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    /// @notice Role permitted to authorize UUPS implementation upgrades (Req 9.8, 14.5).
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @notice The ERC20 stablecoin managed by this vault, fixed at initialization (Req 4.5).
    IERC20 public token;
    /// @notice The BFN Registry used to gate operations to registered users (Req 4.8).
    IRegistry public registry;

    /// @notice Total tokens a user has deposited into their vault (Req 4.1, 4.2).
    mapping(address => uint256) public depositedBalance;
    /// @notice Portion of a user's deposited balance held in time-locks.
    /// @dev Available balance is deposited balance minus this value (Req 4.3).
    mapping(address => uint256) public lockedTotal;

    /// @notice Lock duration constants: minimum 1 day, maximum 5 years (Req 5.3, 5.8).
    uint256 public constant MIN_LOCK = 1 days;
    uint256 public constant MAX_LOCK = 5 * 365 days;

    /// @notice Counter for generating unique goal IDs per user.
    mapping(address => uint256) public nextGoalId;
    /// @notice Counter for generating unique lock IDs per user.
    mapping(address => uint256) public nextLockId;

    /// @notice User's savings goals by goal ID.
    mapping(address => mapping(uint256 => Goal)) public goals;
    /// @notice User's locked savings by lock ID.
    mapping(address => mapping(uint256 => Lock)) public locks;

    /// @dev Storage gap for future upgrades (reduced from 45 to accommodate new state).
    uint256[38] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the vault proxy.
    /// @param token_ The ERC20 stablecoin the vault holds (Req 4.5).
    /// @param registry_ The Registry used for registration checks (Req 4.8).
    /// @param admin The address granted admin, pauser, and upgrader roles (Req 14.5).
    function initialize(address token_, address registry_, address admin) external initializer {
        if (token_ == address(0) || registry_ == address(0) || admin == address(0)) {
            revert ZeroAmount();
        }
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        token = IERC20(token_);
        registry = IRegistry(registry_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    /// @inheritdoc ISavingsVault
    /// @dev Reverts `VaultPaused` while paused (Req 4.7), `NotRegisteredUser` for
    ///      unregistered callers (Req 4.8), and `ZeroAmount` for zero deposits (Req 4.9).
    ///      Follows checks-effects-interactions and is `nonReentrant` (Req 4.6); token is
    ///      pulled via `SafeERC20.safeTransferFrom` (Req 4.5). Emits `DepositMade` (Req 4.2, 13.2).
    function deposit(uint256 amount) external nonReentrant {
        if (paused()) revert VaultPaused();
        if (!registry.isRegistered(msg.sender)) revert NotRegisteredUser(msg.sender);
        if (amount == 0) revert ZeroAmount();

        depositedBalance[msg.sender] += amount;

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit DepositMade(msg.sender, amount);
    }

    /// @inheritdoc ISavingsVault
    /// @dev Reverts `VaultPaused` while paused (Req 4.7), `NotRegisteredUser` for
    ///      unregistered callers (Req 4.8), `ZeroAmount` for zero withdrawals (Req 4.9),
    ///      and `InsufficientAvailableBalance` when `amount` exceeds the unlocked balance,
    ///      leaving state unchanged (Req 4.4). Reduces balance before transfer (CEI) and is
    ///      `nonReentrant` (Req 4.6); token is sent via `SafeERC20.safeTransfer` (Req 4.5).
    ///      Emits `WithdrawalMade` (Req 4.3, 13.3).
    function withdraw(uint256 amount) external nonReentrant {
        if (paused()) revert VaultPaused();
        if (!registry.isRegistered(msg.sender)) revert NotRegisteredUser(msg.sender);
        if (amount == 0) revert ZeroAmount();

        uint256 available = availableBalance(msg.sender);
        if (amount > available) revert InsufficientAvailableBalance(amount, available);

        depositedBalance[msg.sender] -= amount;

        token.safeTransfer(msg.sender, amount);

        emit WithdrawalMade(msg.sender, amount);
    }

    /// @inheritdoc ISavingsVault
    /// @dev Available balance is the deposited balance minus any locked total (Req 4.3).
    ///      `lockedTotal` is zero until task 4.4 wires locking, so this equals the deposited
    ///      balance in the deposit/withdraw-only build.
    function availableBalance(address user) public view returns (uint256) {
        return depositedBalance[user] - lockedTotal[user];
    }

    /// @notice Pause deposits and withdrawals; restricted to `PAUSER_ROLE` (Req 4.7, 14.5).
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resume deposits and withdrawals; restricted to `PAUSER_ROLE` (Req 14.5).
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Savings goals & time-locked savings — implemented in task 4.4 (Req 5).
    // Declared here to satisfy ISavingsVault; they revert until task 4.4.
    // ---------------------------------------------------------------------

    /// @inheritdoc ISavingsVault
    /// @dev Creates a savings goal with auto-incremented ID. Reverts `VaultPaused` while 
    ///      paused, `NotRegisteredUser` for unregistered callers, and `InvalidGoalParams` 
    ///      for zero target amount or past/current target date (Req 5.1, 5.7). Emits 
    ///      `GoalCreated` (Req 13.4).
    function createGoal(uint256 targetAmount, uint256 targetDate) external whenNotPaused {
        if (!registry.isRegistered(msg.sender)) revert NotRegisteredUser(msg.sender);
        if (targetAmount == 0 || targetDate <= block.timestamp) revert InvalidGoalParams();

        uint256 goalId = nextGoalId[msg.sender]++;
        
        goals[msg.sender][goalId] = Goal({
            id: goalId,
            targetAmount: targetAmount,
            targetDate: targetDate,
            savedAmount: 0,
            completed: false
        });

        emit GoalCreated(msg.sender, goalId, targetAmount, targetDate);
    }

    /// @inheritdoc ISavingsVault
    /// @dev Moves funds from available balance to goal savings. Reverts `VaultPaused` while 
    ///      paused, `NotRegisteredUser` for unregistered callers, `ZeroAmount` for zero 
    ///      contribution, and `InsufficientAvailableBalance` when amount exceeds available 
    ///      balance. When goal reaches target, marks as completed and emits `GoalCompleted` 
    ///      (Req 5.2, 13.5). Uses `nonReentrant` for safety.
    function contributeToGoal(uint256 goalId, uint256 amount) external nonReentrant whenNotPaused {
        if (!registry.isRegistered(msg.sender)) revert NotRegisteredUser(msg.sender);
        if (amount == 0) revert ZeroAmount();

        uint256 available = availableBalance(msg.sender);
        if (amount > available) revert InsufficientAvailableBalance(amount, available);

        Goal storage goal = goals[msg.sender][goalId];
        if (goal.targetAmount == 0) revert InvalidGoalParams(); // Goal doesn't exist

        // Move funds from available balance to goal
        depositedBalance[msg.sender] -= amount;
        goal.savedAmount += amount;

        // Check if goal is completed
        if (!goal.completed && goal.savedAmount >= goal.targetAmount) {
            goal.completed = true;
            emit GoalCompleted(msg.sender, goalId);
        }
    }

    /// @inheritdoc ISavingsVault
    /// @dev Locks funds for a duration between MIN_LOCK and MAX_LOCK. Reverts `VaultPaused` 
    ///      while paused, `NotRegisteredUser` for unregistered callers, `ZeroAmount` for zero 
    ///      amount, `InvalidLockDuration` for out-of-range duration, and 
    ///      `InsufficientAvailableBalance` when amount exceeds available balance (Req 5.3, 5.8). 
    ///      Emits `FundsLocked`. Uses `nonReentrant` for safety.
    function lockFunds(uint256 amount, uint256 duration) external nonReentrant whenNotPaused {
        if (!registry.isRegistered(msg.sender)) revert NotRegisteredUser(msg.sender);
        if (amount == 0) revert ZeroAmount();
        if (duration < MIN_LOCK || duration > MAX_LOCK) revert InvalidLockDuration(duration);

        uint256 available = availableBalance(msg.sender);
        if (amount > available) revert InsufficientAvailableBalance(amount, available);

        uint256 lockId = nextLockId[msg.sender]++;
        uint256 expiry = block.timestamp + duration;

        locks[msg.sender][lockId] = Lock({
            amount: amount,
            expiry: expiry,
            released: false
        });

        lockedTotal[msg.sender] += amount;

        emit FundsLocked(msg.sender, lockId, amount, expiry);
    }

    /// @inheritdoc ISavingsVault
    /// @dev Releases a matured lock back to available balance. Reverts `VaultPaused` while 
    ///      paused, `NotRegisteredUser` for unregistered callers, and `LockNotExpired` when 
    ///      attempted before expiry timestamp (Req 5.4, 5.5). Emits `LockReleased`. Uses 
    ///      `nonReentrant` for safety.
    function withdrawLocked(uint256 lockId) external nonReentrant whenNotPaused {
        if (!registry.isRegistered(msg.sender)) revert NotRegisteredUser(msg.sender);

        Lock storage lock = locks[msg.sender][lockId];
        if (lock.amount == 0) revert ZeroAmount(); // Lock doesn't exist
        if (lock.released) revert ZeroAmount(); // Already released
        if (block.timestamp < lock.expiry) revert LockNotExpired(block.timestamp, lock.expiry);

        uint256 amount = lock.amount;
        lock.released = true;
        lockedTotal[msg.sender] -= amount;

        emit LockReleased(msg.sender, lockId, amount);
    }

    /// @inheritdoc ISavingsVault
    function portfolioValue(address user) external view returns (uint256) {
        // Interim value: deposited balance (includes any locked funds). Task 4.4 extends
        // this to include goal savings per Req 5.6.
        return depositedBalance[user];
    }

    /// @dev Restricts UUPS upgrades to `UPGRADER_ROLE` (Req 9.8, 14.5).
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
