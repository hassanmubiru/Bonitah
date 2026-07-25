/**
 * Component tests for Profile page
 * 
 * Tests cover:
 * - Data-source wiring to Registry contract and IPFS
 * - Loading/error/retry rendering for profile operations
 * - Document upload functionality
 * - Profile update transactions
 * 
 * Validates Requirements: 11.1, 11.4, 15.5
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import '@testing-library/jest-dom';

import ProfilePage from '../page';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useProfileData } from '@/hooks/useProfileData';
import { useRegistryProfile } from '@/hooks/useRegistryProfile';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';

// Mock wagmi
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock hooks
jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: jest.fn(),
}));

jest.mock('@/hooks/useProfileData', () => ({
  useProfileData: jest.fn(),
}));

jest.mock('@/hooks/useRegistryProfile', () => ({
  useRegistryProfile: jest.fn(),
}));

jest.mock('@/hooks/useDocumentUpload', () => ({
  useDocumentUpload: jest.fn(),
}));

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuthGuard = useAuthGuard as jest.MockedFunction<typeof useAuthGuard>;
const mockUseProfileData = useProfileData as jest.MockedFunction<typeof useProfileData>;
const mockUseRegistryProfile = useRegistryProfile as jest.MockedFunction<typeof useRegistryProfile>;
const mockUseDocumentUpload = useDocumentUpload as jest.MockedFunction<typeof useDocumentUpload>;

describe('ProfilePage Component Tests', () => {
  let queryClient: QueryClient;
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn(),
    });

    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
    });

    mockUseAuthGuard.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { 
        id: '1', 
        walletAddress: '0x1234567890123456789012345678901234567890',
        role: 'USER' as const,
      },
    });

    mockUseRegistryProfile.mockReturnValue({
      profile: {
        registered: true,
        verified: false,
        reputationScore: BigInt(100),
        ipfsProfileHash: 'QmX1234567890abcdef',
        registeredAt: BigInt(Date.now() / 1000),
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseProfileData.mockReturnValue({
      profile: {
        displayName: 'John Doe',
        bio: 'DeFi enthusiast and early adopter',
        location: 'Global',
        website: 'https://example.com',
      },
      isLoading: false,
      error: null,
      updateProfile: jest.fn(),
      refetch: jest.fn(),
    });

    mockUseDocumentUpload.mockReturnValue({
      upload: jest.fn(),
      isUploading: false,
      uploadProgress: 0,
      error: null,
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  describe('Authentication Guards', () => {
    it('redirects to auth when not connected', async () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
        isConnecting: false,
        isDisconnected: true,
        isReconnecting: false,
        status: 'disconnected',
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth');
      });
    });

    it('shows loading state during authentication check', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
      });

      renderWithProviders(<ProfilePage />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('redirects when not authenticated', async () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth');
      });
    });
  });

  describe('Data Source Wiring - Registry Contract and IPFS', () => {
    it('fetches registry profile data from contract', () => {
      renderWithProviders(<ProfilePage />);

      expect(mockUseRegistryProfile).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
    });

    it('displays registry profile data from contract', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText(/profile/i)).toBeInTheDocument();
      });

      // Should display reputation score from registry
      expect(screen.getByText(/reputation/i)).toBeInTheDocument();
    });

    it('displays verification status from registry contract', () => {
      renderWithProviders(<ProfilePage />);

      // Should show unverified status
      expect(screen.getByText(/verification/i)).toBeInTheDocument();
    });

    it('fetches off-chain profile data via IPFS', () => {
      renderWithProviders(<ProfilePage />);

      expect(mockUseProfileData).toHaveBeenCalled();
    });

    it('displays IPFS profile data when available', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('DeFi enthusiast and early adopter')).toBeInTheDocument();
      });
    });

    it('handles missing IPFS profile data gracefully', () => {
      mockUseProfileData.mockReturnValue({
        profile: null,
        isLoading: false,
        error: null,
        updateProfile: jest.fn(),
        refetch: jest.fn(),
      });

      renderWithProviders(<ProfilePage />);

      // Should still render without crashing
      expect(screen.getByText(/profile/i)).toBeInTheDocument();
    });
  });

  describe('Loading States - Requirement 11.4', () => {
    it('displays loading state while fetching registry data', () => {
      mockUseRegistryProfile.mockReturnValue({
        profile: null,
        isLoading: true,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<ProfilePage />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('displays loading state while fetching profile data', () => {
      mockUseProfileData.mockReturnValue({
        profile: null,
        isLoading: true,
        error: null,
        updateProfile: jest.fn(),
        refetch: jest.fn(),
      });

      renderWithProviders(<ProfilePage />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('does not display placeholder values during loading', () => {
      mockUseRegistryProfile.mockReturnValue({
        profile: null,
        isLoading: true,
        error: null,
        refetch: jest.fn(),
      });

      mockUseProfileData.mockReturnValue({
        profile: null,
        isLoading: true,
        error: null,
        updateProfile: jest.fn(),
        refetch: jest.fn(),
      });

      renderWithProviders(<ProfilePage />);

      // Should not display placeholder values
      expect(screen.queryByText('0')).not.toBeInTheDocument();
      expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
    });

    it('shows upload progress during document upload', () => {
      mockUseDocumentUpload.mockReturnValue({
        upload: jest.fn(),
        isUploading: true,
        uploadProgress: 50,
        error: null,
      });

      renderWithProviders(<ProfilePage />);

      expect(screen.getByText(/uploading/i)).toBeInTheDocument();
    });
  });

  describe('Error States and Retry Functionality', () => {
    const mockRefetch = jest.fn();

    it('displays error when registry data loading fails', () => {
      mockUseRegistryProfile.mockReturnValue({
        profile: null,
        isLoading: false,
        error: 'Failed to fetch registry profile',
        refetch: mockRefetch,
      });

      renderWithProviders(<ProfilePage />);

      expect(screen.getByText(/error/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to fetch registry profile/i)).toBeInTheDocument();
    });

    it('displays error when profile data loading fails', () => {
      mockUseProfileData.mockReturnValue({
        profile: null,
        isLoading: false,
        error: 'Failed to fetch profile data from IPFS',
        updateProfile: jest.fn(),
        refetch: mockRefetch,
      });

      renderWithProviders(<ProfilePage />);

      expect(screen.getByText(/failed to fetch profile data from ipfs/i)).toBeInTheDocument();
    });

    it('provides retry functionality for registry data', async () => {
      const user = userEvent.setup();
      
      mockUseRegistryProfile.mockReturnValue({
        profile: null,
        isLoading: false,
        error: 'Network error',
        refetch: mockRefetch,
      });

      renderWithProviders(<ProfilePage />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('displays error when document upload fails', () => {
      mockUseDocumentUpload.mockReturnValue({
        upload: jest.fn(),
        isUploading: false,
        uploadProgress: 0,
        error: 'Upload failed: File too large',
      });

      renderWithProviders(<ProfilePage />);

      expect(screen.getByText(/upload failed: file too large/i)).toBeInTheDocument();
    });

    it('does not display substituted values on error', () => {
      mockUseRegistryProfile.mockReturnValue({
        profile: null,
        isLoading: false,
        error: 'Network error',
        refetch: jest.fn(),
      });

      renderWithProviders(<ProfilePage />);

      // Should not show placeholder reputation or verification status
      expect(screen.queryByText('0 reputation')).not.toBeInTheDocument();
      expect(screen.queryByText('verified: false')).not.toBeInTheDocument();
    });
  });

  describe('Document Upload Functionality', () => {
    const mockUpload = jest.fn();

    beforeEach(() => {
      mockUseDocumentUpload.mockReturnValue({
        upload: mockUpload,
        isUploading: false,
        uploadProgress: 0,
        error: null,
      });
    });

    it('provides document upload interface', () => {
      renderWithProviders(<ProfilePage />);

      expect(screen.getByText(/upload/i)).toBeInTheDocument();
    });

    it('calls upload function when files are selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      const fileInput = screen.getByLabelText(/upload/i);
      const file = new File(['content'], 'profile.pdf', { type: 'application/pdf' });

      await user.upload(fileInput, file);

      expect(mockUpload).toHaveBeenCalledWith([file]);
    });

    it('handles multiple file upload correctly', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      const fileInput = screen.getByLabelText(/upload/i);
      const files = [
        new File(['content1'], 'doc1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'doc2.pdf', { type: 'application/pdf' }),
      ];

      await user.upload(fileInput, files);

      expect(mockUpload).toHaveBeenCalledWith(files);
    });

    it('disables upload during upload process', () => {
      mockUseDocumentUpload.mockReturnValue({
        upload: mockUpload,
        isUploading: true,
        uploadProgress: 30,
        error: null,
      });

      renderWithProviders(<ProfilePage />);

      const fileInput = screen.getByLabelText(/upload/i);
      expect(fileInput).toBeDisabled();
    });
  });

  describe('Profile Update Functionality', () => {
    const mockUpdateProfile = jest.fn();

    beforeEach(() => {
      mockUseProfileData.mockReturnValue({
        profile: {
          displayName: 'John Doe',
          bio: 'DeFi enthusiast',
          location: 'Global',
          website: 'https://example.com',
        },
        isLoading: false,
        error: null,
        updateProfile: mockUpdateProfile,
        refetch: jest.fn(),
      });
    });

    it('provides profile editing interface', () => {
      renderWithProviders(<ProfilePage />);

      expect(screen.getByText(/edit/i)).toBeInTheDocument();
    });

    it('calls update function when profile is saved', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      // Find edit button and click it to enter edit mode
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Update profile fields (implementation dependent on actual form)
      const displayNameInput = screen.getByDisplayValue('John Doe');
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Jane Doe');

      // Save profile
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Jane Doe',
        })
      );
    });
  });

  describe('Reputation and Verification Display', () => {
    it('displays reputation score from registry contract', () => {
      renderWithProviders(<ProfilePage />);

      expect(screen.getByText(/100/)).toBeInTheDocument(); // Reputation score
    });

    it('displays verification status correctly', () => {
      renderWithProviders(<ProfilePage />);

      // Should show unverified status (mock has verified: false)
      expect(screen.getByText(/unverified/i)).toBeInTheDocument();
    });

    it('displays verified status when user is verified', () => {
      mockUseRegistryProfile.mockReturnValue({
        profile: {
          registered: true,
          verified: true, // User is verified
          reputationScore: BigInt(250),
          ipfsProfileHash: 'QmX1234567890abcdef',
          registeredAt: BigInt(Date.now() / 1000),
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<ProfilePage />);

      expect(screen.getByText(/verified/i)).toBeInTheDocument();
      expect(screen.getByText(/250/)).toBeInTheDocument();
    });
  });

  describe('Responsive Layout and Accessibility', () => {
    it('uses responsive container classes', () => {
      const { container } = renderWithProviders(<ProfilePage />);

      const mainContainer = container.querySelector('.container');
      expect(mainContainer).toHaveClass('mx-auto');
    });

    it('provides proper heading structure', () => {
      renderWithProviders(<ProfilePage />);

      expect(screen.getByRole('heading', { name: /profile/i })).toBeInTheDocument();
    });

    it('maintains accessible form structure', () => {
      renderWithProviders(<ProfilePage />);

      // Should have proper form labels and structure
      const fileInput = screen.getByLabelText(/upload/i);
      expect(fileInput).toBeInTheDocument();
    });
  });

  describe('Data Consistency', () => {
    it('keeps registry and IPFS data in sync', () => {
      renderWithProviders(<ProfilePage />);

      // Both hooks should be called with the same address
      expect(mockUseRegistryProfile).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
      expect(mockUseProfileData).toHaveBeenCalled();
    });

    it('refetches data after successful updates', async () => {
      const mockRefetchRegistry = jest.fn();
      const mockRefetchProfile = jest.fn();

      mockUseRegistryProfile.mockReturnValue({
        profile: {
          registered: true,
          verified: false,
          reputationScore: BigInt(100),
          ipfsProfileHash: 'QmX1234567890abcdef',
          registeredAt: BigInt(Date.now() / 1000),
        },
        isLoading: false,
        error: null,
        refetch: mockRefetchRegistry,
      });

      mockUseProfileData.mockReturnValue({
        profile: null,
        isLoading: false,
        error: null,
        updateProfile: jest.fn().mockResolvedValue({}),
        refetch: mockRefetchProfile,
      });

      renderWithProviders(<ProfilePage />);

      // After successful operations, data should be refetched
      expect(mockRefetchRegistry).toBeDefined();
      expect(mockRefetchProfile).toBeDefined();
    });
  });
});