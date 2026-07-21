// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {IRegistry} from "./interfaces/IRegistry.sol";
import {BFNRoles} from "./base/BFNRoles.sol";
import {BFNAccessUUPSUpgradeable} from "./base/BFNAccessUUPSUpgradeable.sol";

/// @title Registry
/// @notice On-chain source of truth for BFN user identity: registration, IPFS profile
///         hashes, verification status, and a monotonic non-negative reputation score
///         (Req 3, 13.1, 14). Deployed behind a UUPS proxy so the implementation can be
///         upgraded by `UPGRADER_ROLE` while all user state is preserved (Req 9.8, 14.8).
/// @dev Role-gated mutators follow least-privilege: verification requires `VERIFIER_ROLE`
///      and reputation increases require `REPUTATION_ROLE` (granted to the Education
///      contract). Every successful state change emits exactly one event (Req 13.1).
contract Registry is Initializable, BFNAccessUUPSUpgradeable, IRegistry {
    /// @dev User profiles keyed by wallet address. Private; exposed via view functions.
    mapping(address => UserProfile) private _profiles;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the Registry proxy, granting core roles to `admin` (Req 14.5).
    /// @dev Replaces the constructor for upgradeable deployment; callable once.
    /// @param admin Address granted `DEFAULT_ADMIN_ROLE` and `UPGRADER_ROLE`; it may then
    ///        grant `VERIFIER_ROLE` and `REPUTATION_ROLE` to the appropriate accounts.
    function initialize(address admin) external initializer {
        __BFNAccessUUPS_init(admin);
    }

    /// @inheritdoc IRegistry
    /// @dev Reverts {AlreadyRegistered} if the caller already registered (Req 3.2).
    ///      Initializes reputation to 0 and records the block timestamp, then emits
    ///      {UserRegistered} exactly once (Req 3.1, 13.1).
    function register() external {
        UserProfile storage profile = _profiles[msg.sender];
        if (profile.registered) revert AlreadyRegistered(msg.sender);

        profile.registered = true;
        profile.registeredAt = block.timestamp;
        // verified defaults to false; reputationScore defaults to 0; ipfsProfileHash empty.

        emit UserRegistered(msg.sender, block.timestamp);
    }

    /// @inheritdoc IRegistry
    /// @dev Reverts {NotRegistered} for unregistered callers (Req 3.4) and
    ///      {EmptyProfileHash} when `ipfsProfileHash` is empty (Req 3.3). Overwrites the
    ///      stored hash and emits {ProfileUpdated} (Req 3.3).
    function updateProfile(string calldata ipfsProfileHash) external {
        UserProfile storage profile = _profiles[msg.sender];
        if (!profile.registered) revert NotRegistered(msg.sender);
        if (bytes(ipfsProfileHash).length == 0) revert EmptyProfileHash();

        profile.ipfsProfileHash = ipfsProfileHash;

        emit ProfileUpdated(msg.sender, ipfsProfileHash);
    }

    /// @inheritdoc IRegistry
    /// @dev Restricted to `VERIFIER_ROLE`; unauthorized callers revert via AccessControl
    ///      (Req 3.10). Reverts {NotRegistered} if `user` never registered. Verifying an
    ///      already-verified user is idempotent and still emits {UserVerified} (Req 3.6).
    function verifyUser(address user) external onlyRole(BFNRoles.VERIFIER_ROLE) {
        UserProfile storage profile = _profiles[user];
        if (!profile.registered) revert NotRegistered(user);

        profile.verified = true;

        emit UserVerified(user, msg.sender);
    }

    /// @inheritdoc IRegistry
    /// @dev Restricted to `REPUTATION_ROLE` (Req 8.7). Reverts {NotRegistered} if `user`
    ///      never registered. Adds `amount` to the score, keeping it monotonically
    ///      non-decreasing and non-negative, then emits {ReputationIncreased}.
    function increaseReputation(address user, uint256 amount)
        external
        onlyRole(BFNRoles.REPUTATION_ROLE)
    {
        UserProfile storage profile = _profiles[user];
        if (!profile.registered) revert NotRegistered(user);

        uint256 newScore = profile.reputationScore + amount;
        profile.reputationScore = newScore;

        emit ReputationIncreased(user, amount, newScore);
    }

    /// @inheritdoc IRegistry
    function isRegistered(address user) external view returns (bool) {
        return _profiles[user].registered;
    }

    /// @inheritdoc IRegistry
    function getProfile(address user) external view returns (UserProfile memory) {
        return _profiles[user];
    }

    /// @inheritdoc IRegistry
    function reputationOf(address user) external view returns (uint256) {
        return _profiles[user].reputationScore;
    }
}
