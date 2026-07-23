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
    function createGoal(uint256 /*targetAmount*/, uint256 /*targetDate*/) external pure {
        revert NotYetImplemented();
    }

    /// @inheritdoc ISavingsVault
    function contributeToGoal(uint256 /*goalId*/, uint256 /*amount*/) external pure {
        revert NotYetImplemented();
    }

    /// @inheritdoc ISavingsVault
    function lockFunds(uint256 /*amount*/, uint256 /*duration*/) external pure {
        revert NotYetImplemented();
    }

    /// @inheritdoc ISavingsVault
    function withdrawLocked(uint256 /*lockId*/) external pure {
        revert NotYetImplemented();
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
