// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IEducation
/// @notice Interface for the BFN Education contract recording on-chain proofs of
///         certificates, badges, and achievements (Req 8, 13.9, 14).
interface IEducation {
    /// @notice An issued course completion certificate.
    struct Certificate {
        uint256 id;
        bytes32 courseId;
        string ipfsMetadataHash;
        uint256 issuedAt;
    }

    /// @notice Emitted when a certificate is issued (Req 8.3, 13.9).
    event CertificateIssued(address indexed user, uint256 indexed certificateId, bytes32 indexed courseId);
    /// @notice Emitted when a badge is awarded (Req 8.5).
    event BadgeAwarded(address indexed user, bytes32 indexed badgeId);
    /// @notice Emitted when an achievement is recorded (Req 8.5, 8.7).
    event AchievementRecorded(address indexed user, bytes32 indexed achievementId, uint256 reputationAwarded);

    /// @notice Reverts when a certificate already exists for the user/course (Req 8.10).
    error CertificateAlreadyIssued(address user, bytes32 courseId);
    /// @notice Reverts when the metadata hash is empty (Req 8.9).
    error EmptyMetadataHash();
    /// @notice Reverts when a caller without ISSUER_ROLE issues a certificate (Req 8.3).
    error UnauthorizedIssuer(address caller);

    /// @notice Issue a course completion certificate; restricted to ISSUER_ROLE (Req 8.3, 8.4, 8.9, 8.10).
    function issueCertificate(address user, bytes32 courseId, string calldata ipfsMetadataHash) external;

    /// @notice Award a badge to a user (Req 8.5).
    function awardBadge(address user, bytes32 badgeId) external;

    /// @notice Record an achievement and increase reputation (Req 8.5, 8.7).
    function recordAchievement(address user, bytes32 achievementId, uint256 reputationAmount) external;

    /// @notice Returns true if the user already holds a certificate for the course.
    function hasCertificate(address user, bytes32 courseId) external view returns (bool);
}
