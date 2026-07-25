/**
 * Component Test for ProfileView
 * Tests the main profile display functionality
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProfileView } from '../ProfileView';

// Mock the hooks
jest.mock('@/hooks/useProfileData', () => ({
  useProfileData: jest.fn(() => ({
    profileData: {
      isRegistered: true,
      isVerified: false,
      profileHash: undefined,
    },
    reputation: {
      score: BigInt(250),
      level: 'Member',
      nextLevelThreshold: BigInt(500),
      achievements: [],
    },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

// Mock sub-components
jest.mock('../ProfileInfo', () => ({
  ProfileInfo: ({ profileData }: any) => (
    <div data-testid="profile-info">
      Profile Info - Registered: {profileData?.isRegistered.toString()}
    </div>
  ),
}));

jest.mock('../ReputationDisplay', () => ({
  ReputationDisplay: ({ reputation }: any) => (
    <div data-testid="reputation-display">
      Reputation: {reputation?.score.toString()} - Level: {reputation?.level}
    </div>
  ),
}));

jest.mock('../ProfileDocuments', () => ({
  ProfileDocuments: () => <div data-testid="profile-documents">Profile Documents</div>,
}));

jest.mock('../VerificationStatus', () => ({
  VerificationStatus: ({ isVerified }: any) => (
    <div data-testid="verification-status">
      Verification: {isVerified ? 'Verified' : 'Unverified'}
    </div>
  ),
}));

jest.mock('../ProfileEditor', () => ({
  ProfileEditor: () => <div data-testid="profile-editor">Profile Editor</div>,
}));

describe('ProfileView', () => {
  const testAddress = '0x1234567890123456789012345678901234567890';

  it('renders profile sections when data is loaded', () => {
    render(<ProfileView userAddress={testAddress as any} />);

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Manage your profile, verification status, and reputation')).toBeInTheDocument();
    expect(screen.getByTestId('profile-info')).toBeInTheDocument();
    expect(screen.getByTestId('reputation-display')).toBeInTheDocument();
    expect(screen.getByTestId('profile-documents')).toBeInTheDocument();
    expect(screen.getByTestId('verification-status')).toBeInTheDocument();
  });

  it('displays wallet information', () => {
    render(<ProfileView userAddress={testAddress as any} />);

    expect(screen.getByText('Wallet Information')).toBeInTheDocument();
    expect(screen.getByText(testAddress)).toBeInTheDocument();
    expect(screen.getByText('Base Sepolia')).toBeInTheDocument();
    expect(screen.getByText('Registered')).toBeInTheDocument();
  });

  it('shows edit profile button', () => {
    render(<ProfileView userAddress={testAddress as any} />);

    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
  });
});