// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ICommunityTreasury} from "./interfaces/ICommunityTreasury.sol";

/// @title CommunityTreasury
/// @notice Manages BFN community savings circles: creation, membership, contributions,
///         member voting on treasury actions, and threshold-based execution. Investment
///         pool behaviour (Req 7) shares the contribution/history data model defined here
///         and is implemented as a separate task; the pool entrypoints are reserved below.
/// @dev Deployed behind a UUPS proxy. Value-moving functions use `SafeERC20` and are
///      protected by `ReentrancyGuard`. Every state change emits exactly one event and no
///      event is emitted on revert (Req 13.6, 13.7, 13.8, 13.10). Access control follows
///      least privilege via OpenZeppelin `AccessControl` (Req 14).
contract CommunityTreasury is
    Initializable,
    ICommunityTreasury,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // --- Roles (Req 14.5) ---

    /// @notice Role permitted to pause/unpause value-moving operations.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    /// @notice Role permitted to authorize UUPS upgrades (Req 9.8, 14.8).
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // --- Circle parameter bounds (Req 6.1, 6.11) ---

    /// @notice Minimum allowed maximum-member count for a circle.
    uint256 public constant MIN_MEMBERS = 2;
    /// @notice Maximum allowed maximum-member count for a circle.
    uint256 public constant MAX_MEMBERS = 1000;
    /// @notice Minimum allowed approval threshold percentage.
    uint8 public constant MIN_THRESHOLD = 1;
    /// @notice Maximum allowed approval threshold percentage.
    uint8 public constant MAX_THRESHOLD = 100;

    // --- Additional errors (contract-scoped; interface holds the shared set) ---

    /// @notice Reverts when a proposed treasury action targets the zero address.
    error InvalidRecipient();
    /// @notice Reverts when a referenced treasury action does not exist.
    error UnknownAction(uint256 actionId);
    /// @notice Reverts when the pool feature has not yet been implemented (reserved for Req 7 task).
    error PoolNotImplemented();

    // --- Storage ---

    /// @notice ERC20 token used for all circle/pool value movements.
    IERC20 public token;

    /// @dev Monotonic identifier counter for circles/pools; ids start at 1.
    uint256 private _poolCount;
    /// @dev Monotonic identifier counter for treasury actions; ids start at 1.
    uint256 private _actionCount;

    /// @dev poolId => circle record.
    mapping(uint256 => Circle) private _circles;
    /// @dev poolId => member => membership flag.
    mapping(uint256 => mapping(address => bool)) private _members;
    /// @dev poolId => member => ordered contribution history (Req 6.6, shared with Req 7.3).
    mapping(uint256 => mapping(address => Contribution[])) private _history;

    /// @dev actionId => treasury action record.
    mapping(uint256 => TreasuryAction) private _actions;
    /// @dev actionId => voter => has-voted flag (Req 6.10).
    mapping(uint256 => mapping(address => bool)) private _voted;

    /// @dev Reserved storage slots for future upgrades (e.g. Req 7 pool state).
    uint256[45] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the treasury proxy.
    /// @param admin Address granted `DEFAULT_ADMIN_ROLE`, `PAUSER_ROLE` and `UPGRADER_ROLE`.
    /// @param token_ ERC20 token used for contributions and disbursements.
    function initialize(address admin, IERC20 token_) external initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        token = token_;
    }

    // --- Savings circles (Req 6) ---

    /// @inheritdoc ICommunityTreasury
    /// @dev Validates bounds (Req 6.11), records the creator as the first member (Req 6.1),
    ///      and emits `PoolCreated` (Req 13.6).
    function createCircle(uint256 maxMembers, uint8 approvalThreshold)
        external
        returns (uint256 poolId)
    {
        if (
            maxMembers < MIN_MEMBERS || maxMembers > MAX_MEMBERS || approvalThreshold < MIN_THRESHOLD
                || approvalThreshold > MAX_THRESHOLD
        ) {
            revert InvalidCircleParams();
        }

        poolId = ++_poolCount;
        Circle storage c = _circles[poolId];
        c.creator = msg.sender;
        c.maxMembers = maxMembers;
        c.approvalThreshold = approvalThreshold;
        c.memberCount = 1;
        c.open = true;

        _members[poolId][msg.sender] = true;

        emit PoolCreated(msg.sender, poolId, maxMembers, approvalThreshold);
    }

    /// @inheritdoc ICommunityTreasury
    /// @dev Enforces not-already-member, open, and not-full (Req 6.2, 6.9), then emits `MemberJoined`.
    function joinCircle(uint256 poolId) external {
        Circle storage c = _circles[poolId];
        if (_members[poolId][msg.sender]) revert AlreadyMember(msg.sender, poolId);
        if (!c.open || c.memberCount >= c.maxMembers) revert CircleClosedOrFull(poolId);

        _members[poolId][msg.sender] = true;
        c.memberCount += 1;

        emit MemberJoined(poolId, msg.sender);
    }

    /// @inheritdoc ICommunityTreasury
    /// @dev Members only, amount > 0 (Req 6.3, 6.5). Records per-member history (Req 6.6),
    ///      pulls tokens via `SafeERC20`, and emits `ContributionMade` (Req 13.7).
    ///      `nonReentrant` guards the value move (Req 6.8).
    function contribute(uint256 poolId, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (!_members[poolId][msg.sender]) revert NotMember(msg.sender, poolId);

        _circles[poolId].treasuryBalance += amount;
        _history[poolId][msg.sender].push(Contribution({amount: amount, timestamp: block.timestamp}));

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit ContributionMade(msg.sender, poolId, amount);
    }

    /// @inheritdoc ICommunityTreasury
    /// @dev Only a circle member may propose a disbursement. Amount must be > 0 and the
    ///      recipient must be non-zero. No event is defined for proposal creation; the action
    ///      becomes observable once votes are cast.
    function proposeAction(uint256 poolId, address to, uint256 amount)
        external
        returns (uint256 actionId)
    {
        if (!_members[poolId][msg.sender]) revert NotMember(msg.sender, poolId);
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert InvalidRecipient();

        actionId = ++_actionCount;
        TreasuryAction storage a = _actions[actionId];
        a.circleId = poolId;
        a.to = to;
        a.amount = amount;
    }

    /// @inheritdoc ICommunityTreasury
    /// @dev Members only (Req 6.5), one vote per action (Req 6.10). Emits `VoteCast` (Req 13.8)
    ///      and executes the action once weighted approvals reach the circle threshold
    ///      (Req 6.7). `nonReentrant` guards the possible disbursement (Req 6.8).
    function vote(uint256 actionId) external nonReentrant {
        TreasuryAction storage a = _actions[actionId];
        uint256 circleId = a.circleId;
        if (circleId == 0) revert UnknownAction(actionId);
        if (!_members[circleId][msg.sender]) revert NotMember(msg.sender, circleId);
        if (_voted[actionId][msg.sender]) revert AlreadyVoted(msg.sender, actionId);

        _voted[actionId][msg.sender] = true;
        a.approvals += 1;

        emit VoteCast(msg.sender, actionId);

        Circle storage c = _circles[circleId];
        if (!a.executed && a.approvals >= _requiredApprovals(c.memberCount, c.approvalThreshold)) {
            _execute(a, actionId);
        }
    }

    /// @dev Executes an approved treasury action: debits the circle balance, transfers tokens
    ///      via `SafeERC20`, and emits `ActionExecuted`. Called only from a `nonReentrant` path.
    function _execute(TreasuryAction storage a, uint256 actionId) private {
        a.executed = true;
        Circle storage c = _circles[a.circleId];
        // Reverts on insufficient treasury balance (checked arithmetic).
        c.treasuryBalance -= a.amount;

        token.safeTransfer(a.to, a.amount);

        emit ActionExecuted(actionId, a.to, a.amount);
    }

    /// @dev Weighted approvals required = ceil(memberCount * threshold / 100) (Req 6.7).
    function _requiredApprovals(uint256 memberCount, uint8 threshold)
        private
        pure
        returns (uint256)
    {
        return (memberCount * threshold + 99) / 100;
    }

    // --- Investment pools (Req 7) — reserved for a subsequent task ---

    /// @inheritdoc ICommunityTreasury
    /// @dev Reserved: investment-pool contributions are implemented in the Req 7 task and will
    ///      reuse the shared `Contribution`/history data model defined in this contract.
    function contributeToPool(uint256, uint256) external pure {
        revert PoolNotImplemented();
    }

    /// @inheritdoc ICommunityTreasury
    /// @dev Reserved: ownership-share computation is implemented in the Req 7 task.
    function ownershipShare(uint256, address) external pure returns (uint256) {
        revert PoolNotImplemented();
    }

    /// @inheritdoc ICommunityTreasury
    /// @dev Reserved: yield distribution is implemented in the Req 7 task.
    function yieldDistribution(uint256, address, uint256) external pure returns (uint256) {
        revert PoolNotImplemented();
    }

    // --- Views ---

    /// @inheritdoc ICommunityTreasury
    /// @dev Per-member contribution history, shared by circles (Req 6.6) and pools (Req 7.3).
    function contributionHistory(uint256 poolId, address member)
        external
        view
        returns (Contribution[] memory)
    {
        return _history[poolId][member];
    }

    /// @notice Returns the full circle record for `poolId`.
    function getCircle(uint256 poolId) external view returns (Circle memory) {
        return _circles[poolId];
    }

    /// @notice Returns the treasury action record for `actionId`.
    function getAction(uint256 actionId) external view returns (TreasuryAction memory) {
        return _actions[actionId];
    }

    /// @notice Returns true if `account` is a member of circle `poolId`.
    function isMember(uint256 poolId, address account) external view returns (bool) {
        return _members[poolId][account];
    }

    /// @notice Returns true if `voter` has already voted on `actionId`.
    function hasVoted(uint256 actionId, address voter) external view returns (bool) {
        return _voted[actionId][voter];
    }

    /// @notice Number of circles/pools created so far.
    function poolCount() external view returns (uint256) {
        return _poolCount;
    }

    /// @notice Number of treasury actions proposed so far.
    function actionCount() external view returns (uint256) {
        return _actionCount;
    }

    // --- Admin ---

    /// @notice Pause value-moving operations. Restricted to `PAUSER_ROLE`.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpause value-moving operations. Restricted to `PAUSER_ROLE`.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @dev UUPS upgrade authorization, restricted to `UPGRADER_ROLE` (Req 9.8, 14.8).
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}
}
