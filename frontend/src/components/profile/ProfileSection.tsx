/**
 * Profile Section Component
 *
 * Main profile display component that handles loading, error, and success states
 * Requirement: Component tests for data source wiring and loading/error/retry rendering
 */

import React from 'react';
import { ProfileInfo } from './ProfileInfo';
import { ProfileEditor } from './ProfileEditor';
import { VerificationStatus } from './VerificationStatus';
import { ReputationDisplay } from './ReputationDisplay';

interface ProfileSectionProps {
  /** User's Ethereum address */
  userAddress?: string;
  /** Whether to show edit mode */
  isEditing?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: Error | null;
  /** Retry function */
  onRetry?: () => void;
  /** Edit toggle function */
  onToggleEdit?: () => void;
}

export function ProfileSection({
  userAddress,
  isEditing = false,
  isLoading = false,
  error = null,
  onRetry,
  onToggleEdit,
}: ProfileSectionProps) {
  if (isLoading) {
    return (
      <div data-testid="profile-section" className="profile-loading">
        <div data-testid="profile-loading">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="profile-section" className="profile-error">
        <div data-testid="profile-error">Error loading profile: {error.message}</div>
        {onRetry && (
          <button data-testid="profile-retry" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!userAddress) {
    return (
      <div data-testid="profile-section" className="profile-empty">
        <div>Connect your wallet to view profile</div>
      </div>
    );
  }

  return (
    <div data-testid="profile-section" className="profile-content">
      <div data-testid="profile-address">Profile for {userAddress}</div>

      {isEditing ? (
        <ProfileEditor
          userAddress={userAddress as `0x${string}`}
          profileData={null}
          onSave={() => {}}
          onCancel={() => {}}
        />
      ) : (
        <ProfileInfo userAddress={userAddress as `0x${string}`} profileData={null} />
      )}

      <VerificationStatus 
        userAddress={userAddress as `0x${string}`}
        isVerified={false}
      />
      <ReputationDisplay userAddress={userAddress as `0x${string}`} />

      {onToggleEdit && (
        <button data-testid="profile-edit-toggle" onClick={onToggleEdit}>
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      )}
    </div>
  );
}
