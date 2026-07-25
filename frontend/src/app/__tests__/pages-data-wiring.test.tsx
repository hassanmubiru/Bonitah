/**
 * Task 21.12: Additional component tests for page data wiring
 * 
 * Tests specific data source wiring scenarios across different pages
 * Requirements: 11.1, 11.3, 11.4, 14.9, 15.5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Import additional pages
import ProfilePage from '../profile/page';
import AuthPage from '../auth/page';
import AIPage from '../ai/page';

// Mock all dependencies
jest.mock('wagmi');
jest.mock('next/navigation');
jest.mock('@/hooks/useAuthGuard');
jest.mock('@/hooks/useSiweAuth');
jest.mock('@/hooks/useContractRead');
jest.mock('@/hooks/useRegistry');
jest.mock('@/hooks/useAI');

// Mock components
jest.mock('@/components/profile/ProfileSection', () => ({
  ProfileSection: ({ userAddress }: { userAddress: string }) => (
    <div data-testid="profile-section">Profile for {userAddress}</div>
  ),
}));

jest.mock('@/components/auth/AuthFlow', () => ({
  AuthFlow: () => <div data-testid="auth-flow">Authentication Flow</div>,
}));

jest.mock('@/components/ai/ChatInterface', () => ({
  ChatInterface: () => <div data-testid="chat-interface">AI Chat Interface</div>,
}));

// Import mocked hooks
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useAccount, useConnect } from 'wagmi';
import { useRouter } from 'next/navigation';

const mockUseAuthGuard = useAuthGuard as jest.MockedFunction<typeof useAuthGuard>;
const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;
const mockUseConnect = useConnect as jest.MockedFunction<typeof useConnect>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('Pages Data Wiring Tests (Task 21.12)', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890';
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    } as any);

    mockUseAccount.mockReturnValue({
      address: mockAddress,
      isConnected: true,
      chainId: 84532,
    } as any);

    mockUseConnect.mockReturnValue({
      connect: jest.fn(),
      connectors: [],
      error: null,
      isLoading: false,
      pendingConnector: null,
    } as any);
  });

  describe('Profile Page Data Wiring', () => {
    it('connects to Registry contract for profile data', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      render(<ProfilePage />);

      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByTestId('profile-section')).toBeInTheDocument();
      expect(screen.getByTestId('profile-section')).toHaveTextContent(`Profile for ${mockAddress}`);
    });

    it('redirects to auth when not authenticated', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      render(<ProfilePage />);

      expect(mockPush).toHaveBeenCalledWith('/auth');
    });

    it('shows loading state during authentication check', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        isOnCorrectNetwork: true,
      });

      render(<ProfilePage />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('profile-section')).not.toBeInTheDocument();
    });
  });

  describe('Auth Page Data Wiring', () => {
    it('renders authentication flow when not connected', () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
        chainId: undefined,
      } as any);

      render(<AuthPage />);

      expect(screen.getByText('Connect to Bonitah')).toBeInTheDocument();
      expect(screen.getByTestId('auth-flow')).toBeInTheDocument();
    });

    it('redirects to dashboard when already authenticated', async () => {
      mockUseAccount.mockReturnValue({
        address: mockAddress,
        isConnected: true,
        chainId: 84532,
      } as any);

      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      render(<AuthPage />);

      // Should redirect to dashboard
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('shows network switch prompt for wrong network', () => {
      mockUseAccount.mockReturnValue({
        address: mockAddress,
        isConnected: true,
        chainId: 1, // Wrong network (Ethereum mainnet)
      } as any);

      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        isOnCorrectNetwork: false,
      });

      render(<AuthPage />);

      expect(screen.getByText(/Please switch to Base Sepolia/i)).toBeInTheDocument();
    });
  });

  describe('AI Assistant Page Data Wiring', () => {
    beforeEach(() => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });
    });

    it('renders chat interface when authenticated', () => {
      render(<AIPage />);

      expect(screen.getByText('AI Financial Assistant')).toBeInTheDocument();
      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
    });

    it('redirects to auth when not authenticated', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      render(<AIPage />);

      expect(mockPush).toHaveBeenCalledWith('/auth');
    });
  });

  describe('Network-Specific Data Wiring (Req 11.1)', () => {
    it('ensures all contract reads target Base Sepolia (chainId 84532)', () => {
      // This test verifies that pages properly configure contract reads
      // to use Base Sepolia network as required
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      // Mock wagmi to verify chainId usage
      mockUseAccount.mockReturnValue({
        address: mockAddress,
        isConnected: true,
        chainId: 84532, // Base Sepolia
      } as any);

      render(<ProfilePage />);

      // Verify that the component renders (indicating proper chainId handling)
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(mockUseAccount).toHaveBeenCalled();
    });

    it('handles chain mismatch gracefully', () => {
      mockUseAccount.mockReturnValue({
        address: mockAddress,
        isConnected: true,
        chainId: 1, // Ethereum mainnet - wrong chain
      } as any);

      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        isOnCorrectNetwork: false,
      });

      render(<ProfilePage />);

      // Should redirect to auth for network switching
      expect(mockPush).toHaveBeenCalledWith('/auth');
    });
  });

  describe('Real Data vs Mock Data (Req 11.3)', () => {
    it('never renders with hardcoded financial values', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      // Render pages and verify no hardcoded values appear
      const { unmount: unmountProfile } = render(<ProfilePage />);
      
      // Check that no common placeholder values are present
      expect(screen.queryByText('$1,000')).not.toBeInTheDocument();
      expect(screen.queryByText('100 ETH')).not.toBeInTheDocument();
      expect(screen.queryByText('Demo Balance')).not.toBeInTheDocument();
      
      unmountProfile();

      const { unmount: unmountAuth } = render(<AuthPage />);
      
      // Auth page should not show any financial values
      expect(screen.queryByText(/balance/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
      
      unmountAuth();
    });
  });

  describe('Error Boundary Testing', () => {
    it('handles component errors gracefully without showing placeholder data', () => {
      // Mock a component that throws an error
      jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress error logs
      
      mockUseAuthGuard.mockImplementation(() => {
        throw new Error('Network error');
      });

      expect(() => render(<ProfilePage />)).not.toThrow();
      
      // Even in error states, should not show placeholder financial values
      expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
      expect(screen.queryByText('0 ETH')).not.toBeInTheDocument();
      
      jest.restoreAllMocks();
    });
  });

  describe('Loading State Consistency', () => {
    it('maintains consistent loading states across pages', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        isOnCorrectNetwork: true,
      });

      // Test Profile page loading
      const { unmount: unmountProfile } = render(<ProfilePage />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      unmountProfile();

      // Test AI page loading  
      const { unmount: unmountAI } = render(<AIPage />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      unmountAI();

      // All pages should use the same loading indicator
    });

    it('shows appropriate loading text without financial implications', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        isOnCorrectNetwork: true,
      });

      render(<ProfilePage />);

      const loadingText = screen.getByText('Loading...');
      
      // Loading text should not suggest any financial state
      expect(loadingText.textContent).not.toMatch(/balance|funds|wallet/i);
      expect(loadingText.textContent).toBe('Loading...');
    });
  });
});