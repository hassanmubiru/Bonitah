// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControlUpgradeable} from
    "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {BFNRoles} from "./BFNRoles.sol";

/// @title BFNAccessUUPSUpgradeable
/// @notice Cross-cutting base for every BFN contract: OpenZeppelin role-based access
///         control combined with UUPS upgradeability (Req 14.5, 14.8, 9.8). Upgrades are
///         gated behind `UPGRADER_ROLE` so implementation swaps require an authorized
///         caller while proxy storage (and thus state) is preserved.
/// @dev Concrete contracts inherit this base and call `__BFNAccessUUPS_init` from their
///      own `initializer`. A private storage gap reserves slots for future upgrades.
abstract contract BFNAccessUUPSUpgradeable is AccessControlUpgradeable, UUPSUpgradeable {
    /// @notice Reverts when the zero address is supplied as the initial admin.
    error ZeroAdmin();

    /// @notice Initializes access control and UUPS wiring, granting the core roles to
    ///         `admin` (Req 14.5, 14.8).
    /// @param admin Address granted `DEFAULT_ADMIN_ROLE` and `UPGRADER_ROLE`.
    function __BFNAccessUUPS_init(address admin) internal onlyInitializing {
        __AccessControl_init();
        __BFNAccessUUPS_init_unchained(admin);
    }

    function __BFNAccessUUPS_init_unchained(address admin) internal onlyInitializing {
        if (admin == address(0)) revert ZeroAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BFNRoles.UPGRADER_ROLE, admin);
    }

    /// @inheritdoc UUPSUpgradeable
    /// @dev Restricts UUPS upgrades to holders of `UPGRADER_ROLE` (Req 14.8, 9.8).
    function _authorizeUpgrade(address newImplementation)
        internal
        virtual
        override
        onlyRole(BFNRoles.UPGRADER_ROLE)
    {}

    /// @dev Reserved storage to allow layout-safe additions in future upgrades.
    uint256[50] private __gap;
}
