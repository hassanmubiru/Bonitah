/**
 * Task 21.12: Loading, Error, and Retry behavior tests for pages
 * 
 * Tests comprehensive loading/error/retry rendering across all pages
 * Requirements: 11.4, 11.5, 11.6 - No placeholder financial values, proper error handling, retry mechanisms
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';

// Test different error scenarios and loading states
import DashboardPage from '../dashboard/page';
import SavingsPage from '../savings/page';
import ProfilePage from '../profile/page';
import { NotFoundPage } from '../not-found';

// Mock all wagmi and Next.js dependencies
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useBalance: jest.fn(),
  useReadContract: jest.fn(),
  useWriteContract: jest.fn(),
  useWaitForTransactionReceipt: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock all custom hooks with controllable return values
jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: jest.fn(),
}));

jest.mock('@/hooks/useSavingsVault', () => ({
  useSavingsVaultBalances: jest.fn(),
  useSavingsVaultDeposit: jest.fn(),
  useSavingsVaultWithdraw: jest.fn(),
  useTokenBalance: jest.fn(),
  formatTokenAmount: jest.fn(),
  validateAmount: jest.fn(),
}));

jest.mock('@/hooks/useContractRead', () => ({
  useContractRead: jest.fn(),
  usePortfolioValue: jest.fn(),
  useContractBalance: jest.fn(),
}));

// Mock components that handle their own data fetching
jest.mock('@/components/dashboard/DashboardContent', () => ({
  DashboardContent: ({ userAddress }: { userAddress: string }) => (
    <div data-testid="dashboard-content">
      <div data-testid="portfolio-loading">Loading portfolio...</div>
      <div data-testid="transactions-error">Failed to load transactions</div>
      <button data-testid="retry-portfolio">Retry Portfolio</button>
    </div>
  ),
}));

jest.mock('@/components/profile/ProfileSection', () => ({
  ProfileSection: () => (
    <div data-testid="profile-section">
      <div data-testid="profile-loading">Loading profile...</div>
      <div data-testid="profile-error">Profile load failed</div>
      <button data-testid="retry-profile">Retry Profile</button>
    </div>
  ),
}));

// Import mocked types
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useSavingsVaultBalances, useTokenBalance } from '@/hooks/useSavingsVault';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';

const mockUseAuthGuard = useAuthGuard as jest.MockedFunction<typeof useAuthGuard>;
const mockUseSavingsVaultBalances = useSavingsVaultBalances as jest.MockedFunction<typeof useSavingsVaultBalances>;
const mockUseTokenBalance = useTokenBalance as jest.MockedFunction<typeof useTokenBalance>;
const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('Pages Loading, Error, and Retry Tests (Task 21.12)', () => {
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
  });

  describe('Loading States (Req 11.4)', () => {
    it('shows loading state without any placeholder financial values', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        isOnCorrectNetwork: true,
      });

      render(<DashboardPage />);

      // Should show loading indicator
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Should NOT show any financial placeholders during loading
      const loadingContainer = screen.getByText('Loading...').closest('div');
      expect(loadingContainer).not.toHaveTextContent('$');
      expect(loadingContainer).not.toHaveTextContent('ETH');
      expect(loadingContainer).not.toHaveTextContent('0.00');
      expect(loadingContainer).not.toHaveTextContent('--');
      expect(loadingContainer).not.toHaveTextContent('N/A');
      expect(loadingContainer).not.toHaveTextContent('TBD');
    });

    it('maintains loading state consistency across different pages', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        isOnCorrectNetwork: true,
      });

      // Test Dashboard loading
      const { unmount: unmountDashboard } = render(<DashboardPage />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      unmountDashboard();

      // Test Profile loading
      const { unmount: unmountProfile } = render(<ProfilePage />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      unmountProfile();

      // Both should use identical loading patterns
    });

    it('shows component-specific loading states for data sections', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: true,
          isError: false,
          refetch: jest.fn(),
        },
        portfolioValue: {
          data: undefined,
          isLoading: true,
          isError: false,
          refetch: jest.fn(),
        },
      });

      mockUseTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        formatted: '',
        symbol: '',
        refetch: jest.fn(),
      });

      render(<SavingsPage />);

      // Should show loading for specific sections
      const loadingElements = screen.getAllByText(/Loading/);
      expect(loadingElements.length).toBeGreaterThan(0);

      // Still no placeholder values anywhere
      expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
      expect(screen.queryByText(/0\sETH/)).not.toBeInTheDocument();
    });
  });

  describe('Error States (Req 11.5)', () => {
    it('shows error state for failed data fetches with no placeholder values', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      const mockRefetch = jest.fn();
      mockUseSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error('Contract read failed'),
          refetch: mockRefetch,
        },
        portfolioValue: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error('Network error'),
          refetch: jest.fn(),
        },
      });

      mockUseTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Balance fetch failed'),
        formatted: '',
        symbol: '',
        refetch: jest.fn(),
      });

      render(<SavingsPage />);

      // Should show error indicators
      const errorElements = screen.getAllByText(/Error|Failed/);
      expect(errorElements.length).toBeGreaterThan(0);

      // Error state should not display placeholder financial values
      expect(screen.queryByText('$0')).not.toBeInTheDocument();
      expect(screen.queryByText('0 ETH')).not.toBeInTheDocument();
      expect(screen.queryByText('Balance: --')).not.toBeInTheDocument();
    });

    it('displays specific error messages for different failure types', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error('RPC timeout'),
          refetch: jest.fn(),
        },
        portfolioValue: {
          data: undefined,
          isLoading: false,
          isError: false,
          refetch: jest.fn(),
        },
      });

      mockUseTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Contract not found'),
        formatted: '',
        symbol: '',
        refetch: jest.fn(),
      });

      render(<SavingsPage />);

      // Should show appropriate error text
      expect(screen.getByText(/Failed to load balance/)).toBeInTheDocument();
      expect(screen.getByText(/Failed to load wallet balance/)).toBeInTheDocument();
    });

    it('handles multiple simultaneous errors gracefully', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      // All data sources fail simultaneously
      mockUseSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error('Available balance error'),
          refetch: jest.fn(),
        },
        portfolioValue: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error('Portfolio error'),
          refetch: jest.fn(),
        },
      });

      mockUseTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Token balance error'),
        formatted: '',
        symbol: '',
        refetch: jest.fn(),
      });

      render(<SavingsPage />);

      // Should handle multiple errors without crashing
      expect(screen.getAllByText(/Error|Failed/).length).toBeGreaterThan(1);
      
      // Page should still be functional (render deposit/withdraw forms)
      expect(screen.getByText('Deposit')).toBeInTheDocument();
      expect(screen.getByText('Withdraw')).toBeInTheDocument();
    });
  });

  describe('Retry Functionality (Req 11.6)', () => {
    it('provides working retry buttons for failed data fetches', async () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      const mockRefetchAvailable = jest.fn();
      const mockRefetchPortfolio = jest.fn();
      const mockRefetchToken = jest.fn();

      mockUseSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: false,
          isError: true,
          refetch: mockRefetchAvailable,
        },
        portfolioValue: {
          data: undefined,
          isLoading: false,
          isError: true,
          refetch: mockRefetchPortfolio,
        },
      });

      mockUseTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        formatted: '',
        symbol: '',
        refetch: mockRefetchToken,
      });

      render(<SavingsPage />);

      // Find and click retry buttons
      const retryButtons = screen.getAllByText(/Retry/);
      expect(retryButtons.length).toBeGreaterThan(0);

      // Click first retry button
      fireEvent.click(retryButtons[0]);
      expect(mockRefetchAvailable).toHaveBeenCalledTimes(1);

      // Test that retry functions are called properly
      await waitFor(() => {
        expect(mockRefetchAvailable).toHaveBeenCalled();
      });
    });

    it('provides manual refresh buttons for successful data loads', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      const mockRefresh = jest.fn();
      mockUseSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: BigInt('1000000000000000000'),
          isLoading: false,
          isError: false,
          refetch: mockRefresh,
        },
        portfolioValue: {
          data: BigInt('1000000000000000000'),
          isLoading: false,
          isError: false,
          refetch: jest.fn(),
        },
      });

      mockUseTokenBalance.mockReturnValue({
        data: BigInt('5000000000000000000'),
        isLoading: false,
        isError: false,
        formatted: '5.0',
        symbol: 'ETH',
        refetch: jest.fn(),
      });

      render(<SavingsPage />);

      // Should provide refresh functionality even when data loads successfully
      const refreshButtons = screen.getAllByLabelText(/refresh/i);
      expect(refreshButtons.length).toBeGreaterThan(0);

      fireEvent.click(refreshButtons[0]);
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('handles retry button interactions during loading states', async () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      let isLoading = false;
      const mockRefetch = jest.fn().mockImplementation(() => {
        isLoading = true;
        return Promise.resolve();
      });

      // Start with error state
      mockUseSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: false,
          isError: true,
          refetch: mockRefetch,
        },
        portfolioValue: {
          data: undefined,
          isLoading: false,
          isError: false,
          refetch: jest.fn(),
        },
      });

      mockUseTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        formatted: '',
        symbol: '',
        refetch: jest.fn(),
      });

      render(<SavingsPage />);

      const retryButton = screen.getAllByText('Retry')[0];
      
      // Retry button should be clickable initially
      expect(retryButton).not.toBeDisabled();
      
      fireEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('retries work across dashboard component sections', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      render(<DashboardPage />);

      // Dashboard should have retry functionality in its components
      const retryPortfolio = screen.getByTestId('retry-portfolio');
      expect(retryPortfolio).toBeInTheDocument();

      fireEvent.click(retryPortfolio);
      // Component should handle its own retry logic
    });
  });

  describe('State Transitions (Loading → Success/Error)', () => {
    it('transitions cleanly from loading to success state', async () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      // Start with loading state
      let isLoading = true;
      const mockData = {
        get data() { return isLoading ? undefined : BigInt('1000000000000000000'); },
        get isLoading() { return isLoading; },
        get isError() { return false; },
        refetch: jest.fn(),
      };

      mockUseSavingsVaultBalances.mockReturnValue({
        availableBalance: mockData,
        portfolioValue: mockData,
      });

      mockUseTokenBalance.mockReturnValue({
        get data() { return isLoading ? undefined : BigInt('5000000000000000000'); },
        get isLoading() { return isLoading; },
        get isError() { return false; },
        formatted: isLoading ? '' : '5.0',
        symbol: 'ETH',
        refetch: jest.fn(),
      });

      const { rerender } = render(<SavingsPage />);

      // Initially should show loading
      expect(screen.getAllByText(/Loading/).length).toBeGreaterThan(0);

      // Simulate data loaded
      act(() => {
        isLoading = false;
      });

      rerender(<SavingsPage />);

      // Should no longer show loading states
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });

    it('transitions from loading to error state correctly', async () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      // Start with loading, then error
      let isLoading = true;
      let isError = false;

      const mockData = {
        get data() { return undefined; },
        get isLoading() { return isLoading; },
        get isError() { return isError; },
        get error() { return isError ? new Error('Load failed') : null; },
        refetch: jest.fn(),
      };

      mockUseSavingsVaultBalances.mockReturnValue({
        availableBalance: mockData,
        portfolioValue: mockData,
      });

      mockUseTokenBalance.mockReturnValue({
        get data() { return undefined; },
        get isLoading() { return isLoading; },
        get isError() { return isError; },
        formatted: '',
        symbol: 'ETH',
        refetch: jest.fn(),
      });

      const { rerender } = render(<SavingsPage />);

      // Initially loading
      expect(screen.getAllByText(/Loading/).length).toBeGreaterThan(0);

      // Transition to error
      act(() => {
        isLoading = false;
        isError = true;
      });

      rerender(<SavingsPage />);

      // Should show error states
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      expect(screen.getAllByText(/Error|Failed/).length).toBeGreaterThan(0);
    });
  });

  describe('No Financial Placeholder Requirements', () => {
    const financialPlaceholders = [
      '$0', '$0.00', '0.00', '0 ETH', '0 USDC', 'N/A', '--', 'TBD',
      'Loading balance...', 'Default: $100', '1,000 tokens', 'Sample: $50'
    ];

    financialPlaceholders.forEach(placeholder => {
      it(`never shows "${placeholder}" during any loading state`, () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: false,
          isLoading: true,
          isOnCorrectNetwork: true,
        });

        render(<DashboardPage />);
        expect(screen.queryByText(placeholder)).not.toBeInTheDocument();

        render(<SavingsPage />);
        expect(screen.queryByText(placeholder)).not.toBeInTheDocument();
      });

      it(`never shows "${placeholder}" during any error state`, () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: true,
          isLoading: false,
          isOnCorrectNetwork: true,
        });

        mockUseSavingsVaultBalances.mockReturnValue({
          availableBalance: {
            data: undefined,
            isLoading: false,
            isError: true,
            refetch: jest.fn(),
          },
          portfolioValue: {
            data: undefined,
            isLoading: false,
            isError: true,
            refetch: jest.fn(),
          },
        });

        render(<SavingsPage />);
        expect(screen.queryByText(placeholder)).not.toBeInTheDocument();
      });
    });
  });
});