// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {IEducation} from "./interfaces/IEducation.sol";
import {IRegistry} from "./interfaces/IRegistry.sol";
import {BFNRoles} from "./base/BFNRoles.sol";
import {BFNAccessUUPSUpgradeable} from "./base/BFNAccessUUPSUpgradeable.sol";

/// @title Education
/// @notice On-chain source of truth for BFN education credentials: course completion
///         certificates, badges, and achievements with reputation rewards (Req 8, 13.9, 14).
///         Deployed behind a UUPS proxy so the implementation can be upgraded by 
///         `UPGRADER_ROLE` while all education state is preserved (Req 9.8, 14.8).
/// @dev Certificate issuance requires `ISSUER_ROLE` and calls Registry.increaseReputation
///      via `REPUTATION_ROLE`. Every successful state change emits exactly one event (Req 13.9).
contract Education is Initializable, BFNAccessUUPSUpgradeable, IEducation {
    /// @dev Registry contract for reputation updates
    IRegistry private _registry;

    /// @dev Next certificate ID to issue
    uint256 private _nextCertificateId;

    /// @dev User certificates: user -> courseId -> Certificate
    mapping(address => mapping(bytes32 => Certificate)) private _certificates;
    
    /// @dev User badges: user -> badgeId -> isAwarded
    mapping(address => mapping(bytes32 => bool)) private _badges;
    
    /// @dev User achievements: user -> achievementId -> isRecorded  
    mapping(address => mapping(bytes32 => bool)) private _achievements;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the Education proxy, granting core roles to `admin` and setting
    ///         the Registry contract address (Req 14.5).
    /// @dev Replaces the constructor for upgradeable deployment; callable once.
    /// @param admin Address granted `DEFAULT_ADMIN_ROLE` and `UPGRADER_ROLE`; it may then
    ///        grant `ISSUER_ROLE` to the appropriate backend service.
    /// @param registry Address of the Registry contract for reputation updates.
    function initialize(address admin, address registry) external initializer {
        __BFNAccessUUPS_init(admin);
        _registry = IRegistry(registry);
        _nextCertificateId = 1; // Start certificate IDs from 1
    }

    /// @inheritdoc IEducation
    /// @dev Restricted to `ISSUER_ROLE`; unauthorized callers revert via AccessControl (Req 8.3).
    ///      Reverts {EmptyMetadataHash} when `ipfsMetadataHash` is empty (Req 8.9).
    ///      Reverts {CertificateAlreadyIssued} if user already has certificate for course (Req 8.10).
    ///      Issues certificate with unique ID, stores metadata hash, and emits {CertificateIssued} (Req 8.4, 13.9).
    function issueCertificate(address user, bytes32 courseId, string calldata ipfsMetadataHash)
        external
        onlyRole(BFNRoles.ISSUER_ROLE)
    {
        if (bytes(ipfsMetadataHash).length == 0) revert EmptyMetadataHash();
        
        Certificate storage certificate = _certificates[user][courseId];
        if (certificate.id != 0) revert CertificateAlreadyIssued(user, courseId);

        uint256 certificateId = _nextCertificateId++;
        certificate.id = certificateId;
        certificate.courseId = courseId;
        certificate.ipfsMetadataHash = ipfsMetadataHash;
        certificate.issuedAt = block.timestamp;

        emit CertificateIssued(user, certificateId, courseId);
    }

    /// @inheritdoc IEducation
    /// @dev Awards badge to user if not already awarded. Emits {BadgeAwarded} (Req 8.5).
    function awardBadge(address user, bytes32 badgeId) external onlyRole(BFNRoles.ISSUER_ROLE) {
        if (!_badges[user][badgeId]) {
            _badges[user][badgeId] = true;
            emit BadgeAwarded(user, badgeId);
        }
    }

    /// @inheritdoc IEducation
    /// @dev Records achievement and increases user reputation via Registry contract.
    ///      Calls Registry.increaseReputation which requires this contract to have REPUTATION_ROLE (Req 8.7).
    ///      Emits {AchievementRecorded} (Req 8.5).
    function recordAchievement(address user, bytes32 achievementId, uint256 reputationAmount)
        external 
        onlyRole(BFNRoles.ISSUER_ROLE)
    {
        if (!_achievements[user][achievementId]) {
            _achievements[user][achievementId] = true;
            
            // Increase reputation if amount > 0
            if (reputationAmount > 0) {
                _registry.increaseReputation(user, reputationAmount);
            }

            emit AchievementRecorded(user, achievementId, reputationAmount);
        }
    }

    /// @inheritdoc IEducation
    function hasCertificate(address user, bytes32 courseId) external view returns (bool) {
        return _certificates[user][courseId].id != 0;
    }

    /// @notice Returns the certificate details for a user and course.
    /// @param user The user address.
    /// @param courseId The course identifier.
    /// @return certificate The certificate struct if it exists, zero values otherwise.
    function getCertificate(address user, bytes32 courseId) external view returns (Certificate memory certificate) {
        return _certificates[user][courseId];
    }

    /// @notice Returns whether a user has been awarded a specific badge.
    /// @param user The user address.
    /// @param badgeId The badge identifier.
    /// @return awarded True if the badge has been awarded to the user.
    function hasBadge(address user, bytes32 badgeId) external view returns (bool awarded) {
        return _badges[user][badgeId];
    }

    /// @notice Returns whether a user has recorded a specific achievement.
    /// @param user The user address.
    /// @param achievementId The achievement identifier.
    /// @return recorded True if the achievement has been recorded for the user.
    function hasAchievement(address user, bytes32 achievementId) external view returns (bool recorded) {
        return _achievements[user][achievementId];
    }
}