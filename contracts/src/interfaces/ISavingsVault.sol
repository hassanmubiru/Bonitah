// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISavingsVault
/// @notice Interface for the BFN SavingsVault contract managing per-user deposits,
///         withdrawals, goals, and locked savings (Req 4, 5, 13.2-13.5, 14).
interface ISavingsVault {
    /// @notice A user savings goal.
    struct Goal {
        uint256 id;
        uint256 targetAmount;
        uint256 targetDate;
        uint256 savedAmount;
        bool completed;
    }

    /// @notice A time-locked savings position.
    struct Lock {
        uint256 amount;
        uint256 expiry;
        bool released;
    }

    /// @notice Emitted on a successful deposit (Req 4.2, 13.2).
    event DepositMade(address indexed user, uint256 amount);
    /// @notice Emitted on a successful withdrawal (Req 4.3, 13.3).
    event WithdrawalMade(address indexed user, uint256 amount);
    /// @notice Emitted when a goal is created (Req 5.1, 13.4).
    event GoalCreated(address indexed user, uint256 indexed goalId, uint256 targetAmount, uint256 targetDate);
    /// @notice Emitted when a goal reaches its target (Req 5.2, 13.5).
    event GoalCompleted(address indexed user, uint256 indexed goalId);
    /// @notice Emitted when funds are locked (Req 5.3).
    event FundsLocked(address indexed user, uint256 indexed lockId, uint256 amount, uint256 expiry);
    /// @notice Emitted when a lock is released (Req 5.5).
    event LockReleased(address indexed user, uint256 indexed lockId, uint256 amount);

    /// @notice Reverts when an unregistered wallet operates on the vault (Req 4.8).
    error NotRegisteredUser(address user);
    /// @notice Reverts when an amount of zero is supplied (Req 4.9).
    error ZeroAmount();
    /// @notice Reverts when a withdrawal exceeds available balance (Req 4.4).
    error InsufficientAvailableBalance(uint256 requested, uint256 available);
    /// @notice Reverts when the vault is paused (Req 4.7).
    error VaultPaused();
    /// @notice Reverts on invalid goal parameters (Req 5.7).
    error InvalidGoalParams();
    /// @notice Reverts when a lock duration is out of range (Req 5.8).
    error InvalidLockDuration(uint256 duration);
    /// @notice Reverts when a locked withdrawal is attempted before expiry (Req 5.4).
    error LockNotExpired(uint256 nowTs, uint256 expiry);

    /// @notice Deposit tokens into the caller's vault (Req 4.2).
    function deposit(uint256 amount) external;

    /// @notice Withdraw available (unlocked) tokens from the caller's vault (Req 4.3, 4.4).
    function withdraw(uint256 amount) external;

    /// @notice Create a savings goal (Req 5.1, 5.7).
    function createGoal(uint256 targetAmount, uint256 targetDate) external;

    /// @notice Contribute toward an existing goal (Req 5.2).
    function contributeToGoal(uint256 goalId, uint256 amount) external;

    /// @notice Lock funds for a fixed duration (Req 5.3, 5.8).
    function lockFunds(uint256 amount, uint256 duration) external;

    /// @notice Withdraw a matured lock back to available balance (Req 5.4, 5.5).
    function withdrawLocked(uint256 lockId) external;

    /// @notice Available balance = deposited balance minus locked total.
    function availableBalance(address user) external view returns (uint256);

    /// @notice Total portfolio value derived from deposited, goal, and locked balances (Req 5.6).
    function portfolioValue(address user) external view returns (uint256);
}
