/**
 * Tests for Savings page loading/error/retry states
 * Task 21.3: Component tests for Savings page
 * 
 * Validates Requirements:
 * - 11.4: Display loading state without placeholder values
 * - 11.5: Transition from loading to error state if fetch fails 
 * - 11.6: Display error state with retry action when fetch fails
 * - 4.2, 4.3: Transaction form validation and error handling
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SavingsPage from '../page';

// Mock the custom hooks
jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: jest.fn(),
}));

jest.mock('@/hooks/useSavingsVault', () => ({
  useSavingsVaultBalances: jest.fn(),
  useSavingsVaultDeposit: jest.fn(),
  useSavingsVaultWithdraw: jest.fn(),
  useTokenBalance: jest.fn(),
  formatTokenAmount: jest.fn((amount: bigint | undefined) => amount ? (Number(amount) / 1e18).toString() : '0'),
  validateAmount: jest.fn(),
}));

// Mock Lucide React icons to avoid import issues
jest.mock('lucide-react', () => ({
  Loader2: ({ className, ...props }: any) => <div data-testid="loader" className={className} {...props} />,
  TrendingUp: ({ className, ...props }: any) => <div data-testid="trending-up" className={className} {...props} />,
  TrendingDown: ({ className, ...props }: any) => <div data-testid="trending-down" className={className} {...props} />,
  RefreshCw: ({ className, ...props }: any) => <div data-testid="refresh" className={className} {...props} />,
}));

const mockUseAuthGuard = require('@/hooks/useAuthGuard').useAuthGuard;
const mockHooks = require('@/hooks/useSavingsVault');

// Test setup
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('Savings Page Loading/Error/Retry States', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default auth state - authenticated
    mockUseAuthGuard.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });

    // Default mock implementations
    mockHooks.validateAmount.mockReturnValue({ isValid: true });
    mockHooks.useSavingsVaultDeposit.mockReturnValue({
      deposit: jest.fn(),
      isLoading: false,
      isSuccess: false,
      error: null,
      hash: null,
      reset: jest.fn(),
    });
    mockHooks.useSavingsVaultWithdraw.mockReturnValue({
      withdraw: jest.fn(),
      isLoading: false,
      isSuccess: false,
      error: null,
      hash: null,
      reset: jest.fn(),
    });
  });

  /**
   * Test Requirement 11.4: Display loading state without placeholder values
   */
  describe('Loading States (Req 11.4)', () => {
    it('displays balance loading state without placeholder financial values', () => {
      mockHooks.useSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: true,
          isError: false,
          error: null,
          refetch: jest.fn(),
        },
        portfolioValue: {
          data: undefined,
          isLoading: true,
          isError: false,
          error: null,
          refetch: jest.fn(),
        },
      });

      mockHooks.useTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        symbol: 'ETH',
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Should show loading indicators - Req 11.4
      expect(screen.getAllByText(/Loading/)).toHaveLength(3); // Available balance, portfolio, wallet balance

      // Should NOT show any placeholder financial values - Req 11.4
      expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument(); // No dollar amounts
      expect(screen.queryByText(/\d+\.\d+/)).not.toBeInTheDocument(); // No decimal numbers
      expect(screen.queryByText(/0\.00/)).not.toBeInTheDocument(); // No zero placeholders
      expect(screen.queryByText(/N\/A/)).not.toBeInTheDocument(); // No N/A placeholders
      expect(screen.queryByText(/--/)).not.toBeInTheDocument(); // No dash placeholders
    });

    it('shows loading for individual balance sections independently', () => {
      mockHooks.useSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: true,
          isError: false,
          error: null,
          refetch: jest.fn(),
        },
        portfolioValue: {
          data: 5000000000000000000n, // 5 ETH loaded
          isLoading: false,
          isError: false,
          error: null,
          refetch: jest.fn(),
        },
      });

      mockHooks.useTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        symbol: 'ETH',
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Available balance should show loading - Req 11.4
      const availableBalanceCard = screen.getByText('Available Balance').closest('.rounded-xl');
      expect(availableBalanceCard).toHaveTextContent('Loading...');

      // Portfolio should show data
      const portfolioCard = screen.getByText('Total Portfolio').closest('.rounded-xl');
      expect(portfolioCard).toHaveTextContent('5'); // 5 ETH

      // Wallet balance should show loading - Req 11.4
      const walletCard = screen.getByText('Wallet Balance').closest('.rounded-xl');
      expect(walletCard).toHaveTextContent('Loading wallet balance...');
    });

    it('never shows placeholder values during transaction loading', () => {
      mockHooks.useSavingsVaultBalances.mockReturnValue({
        availableBalance: { data: 1000000000000000000n, isLoading: false, isError: false, error: null, refetch: jest.fn() },
        portfolioValue: { data: 2000000000000000000n, isLoading: false, isError: false, error: null, refetch: jest.fn() },
      });

      mockHooks.useTokenBalance.mockReturnValue({
        data: 3000000000000000000n,
        formatted: '3.0',
        symbol: 'ETH',
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      });

      // Mock deposit in loading state
      mockHooks.useSavingsVaultDeposit.mockReturnValue({
        deposit: jest.fn(),
        isLoading: true,
        isSuccess: false,
        error: null,
        hash: null,
        reset: jest.fn(),
      });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Balances should show real data
      expect(screen.getByText('1 ETH')).toBeInTheDocument(); // Available balance
      expect(screen.getByText('2 ETH')).toBeInTheDocument(); // Portfolio
      expect(screen.getByText('3.0 ETH')).toBeInTheDocument(); // Wallet balance

      // Deposit button should show loading without placeholders - Req 11.4
      expect(screen.getByText('Processing Deposit...')).toBeInTheDocument();
      expect(screen.queryByText(/0\.00/)).not.toBeInTheDocument(); // No placeholder amounts
    });
  });

  /**
   * Test Requirement 11.5: Error state transitions
   */
  describe('Error State Transitions (Req 11.5)', () => {
    it('displays error state when balance fetch fails', () => {
      mockHooks.useSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: { message: 'Contract read timeout' },
          refetch: jest.fn(),
        },
        portfolioValue: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: { message: 'Network connection failed' },
          refetch: jest.fn(),
        },
      });

      mockHooks.useTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { message: 'RPC timeout' },
        symbol: 'ETH',
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Should show error states - Req 11.5
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to load balance')).toBeInTheDocument();
      expect(screen.getByText('Failed to load portfolio value')).toBeInTheDocument();
      expect(screen.getByText('Failed to load wallet balance')).toBeInTheDocument();

      // Should show retry buttons - will be tested in next section
      expect(screen.getAllByText('Retry')).toHaveLength(3);
    });

    it('transitions from loading to error state correctly', () => {
      const mockRefetch = jest.fn();

      // Start in loading state
      mockHooks.useSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: true,
          isError: false,
          error: null,
          refetch: mockRefetch,
        },
        portfolioValue: {
          data: undefined,
          isLoading: true,
          isError: false,
          error: null,
          refetch: mockRefetch,
        },
      });

      mockHooks.useTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        symbol: 'ETH',
        refetch: mockRefetch,
      });

      const { rerender } = render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Should show loading states
      expect(screen.getAllByText(/Loading/)).toHaveLength(3);

      // Transition to error state - Req 11.5
      mockHooks.useSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: { message: 'Request timeout after 30 seconds' },
          refetch: mockRefetch,
        },
        portfolioValue: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: { message: 'Request timeout after 30 seconds' },
          refetch: mockRefetch,
        },
      });

      mockHooks.useTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { message: 'Request timeout after 30 seconds' },
        symbol: 'ETH',
        refetch: mockRefetch,
      });

      rerender(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Should now show error states - Req 11.5
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      expect(screen.getAllByText('Error')).toHaveLength(2); // Available balance and portfolio
      expect(screen.getByText('Failed to load balance')).toBeInTheDocument();
    });

    it('handles partial error states correctly', () => {
      mockHooks.useSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: 1000000000000000000n, // 1 ETH - success
          isLoading: false,
          isError: false,
          error: null,
          refetch: jest.fn(),
        },
        portfolioValue: {
          data: undefined, // Error
          isLoading: false,
          isError: true,
          error: { message: 'Portfolio read failed' },
          refetch: jest.fn(),
        },
      });

      mockHooks.useTokenBalance.mockReturnValue({
        data: 5000000000000000000n, // 5 ETH - success
        formatted: '5.0',
        symbol: 'ETH',
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Available balance should show success
      expect(screen.getByText('1 ETH')).toBeInTheDocument();

      // Portfolio should show error - Req 11.5
      expect(screen.getByText('Failed to load portfolio value')).toBeInTheDocument();

      // Wallet balance should show success
      expect(screen.getByText('5.0 ETH')).toBeInTheDocument();
    });
  });

  /**
   * Test Requirement 11.6: Error state with retry action
   */
  describe('Error State with Retry Action (Req 11.6)', () => {
    it('displays error state with working retry button', () => {
      const mockRefetch = jest.fn();

      mockHooks.useSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: { message: 'Network connection failed' },
          refetch: mockRefetch,
        },
        portfolioValue: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: { message: 'Contract call reverted' },
          refetch: mockRefetch,
        },
      });

      mockHooks.useTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { message: 'RPC node unavailable' },
        symbol: 'ETH',
        refetch: mockRefetch,
      });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Should show error messages - Req 11.6
      expect(screen.getByText('Failed to load balance')).toBeInTheDocument();
      expect(screen.getByText('Failed to load portfolio value')).toBeInTheDocument();
      expect(screen.getByText('Failed to load wallet balance')).toBeInTheDocument();

      // Should have retry buttons - Req 11.6
      const retryButtons = screen.getAllByText('Retry');
      expect(retryButtons).toHaveLength(3);

      // Should NOT show any substituted values - Req 11.6
      expect(screen.queryByText(/\d+ ETH/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+\.\d+/)).not.toBeInTheDocument();
      expect(screen.queryByText(/0/)).not.toBeInTheDocument();

      // Retry buttons should call refetch
      fireEvent.click(retryButtons[0]); // Available balance retry
      fireEvent.click(retryButtons[1]); // Portfolio retry
      fireEvent.click(retryButtons[2]); // Wallet balance retry

      expect(mockRefetch).toHaveBeenCalledTimes(3);
    });

    it('retry button re-initiates fetch correctly', async () => {
      const mockRefetch = jest.fn();

      mockHooks.useSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: { message: 'Initial failure' },
          refetch: mockRefetch,
        },
        portfolioValue: {
          data: undefined,
          isLoading: false,
          isError: false,
          error: null,
          refetch: jest.fn(),
        },
      });

      mockHooks.useTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        symbol: 'ETH',
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Click retry button - Req 11.6
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      // Should call refetch function
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('never shows substituted values in error states', () => {
      mockHooks.useSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: { message: 'Contract unreachable' },
          refetch: jest.fn(),
        },
        portfolioValue: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: { message: 'Network timeout' },
          refetch: jest.fn(),
        },
      });

      mockHooks.useTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { message: 'RPC error' },
        symbol: 'ETH',
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Should NOT show any financial values - Req 11.6
      expect(screen.queryByText(/\d+/)).not.toBeInTheDocument(); // No numbers
      expect(screen.queryByText(/ETH/)).not.toBeInTheDocument(); // No token symbols in data
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument(); // No dollar signs
      expect(screen.queryByText(/Available for withdrawal/)).not.toBeInTheDocument(); // No balance descriptions
      
      // Should only show error messages and retry buttons
      expect(screen.getAllByText('Error')).toHaveLength(2); // Both balance cards show error
      expect(screen.getByText('Failed to load balance')).toBeInTheDocument();
      expect(screen.getByText('Failed to load portfolio value')).toBeInTheDocument();
      expect(screen.getByText('Failed to load wallet balance')).toBeInTheDocument();
      expect(screen.getAllByText('Retry')).toHaveLength(3);
    });

    it('retry works after successful recovery', async () => {
      const mockRefetch = jest.fn();

      // Mock that shows error initially
      mockHooks.useSavingsVaultBalances.mockReturnValue({
        availableBalance: {
          data: undefined,
          isLoading: false,
          isError: true,
          error: { message: 'Initial error' },
          refetch: mockRefetch,
        },
        portfolioValue: {
          data: undefined,
          isLoading: false,
          isError: false,
          error: null,
          refetch: jest.fn(),
        },
      });

      mockHooks.useTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        symbol: 'ETH',
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Initially in error state
      expect(screen.getByText('Failed to load balance')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();

      // Click retry
      fireEvent.click(screen.getByText('Retry'));
      
      // Should call refetch
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Test transaction form validation and error handling
   */
  describe('Transaction Form Error Handling', () => {
    it('displays transaction error with proper error message', () => {
      mockHooks.useSavingsVaultBalances.mockReturnValue({
        availableBalance: { data: 1000000000000000000n, isLoading: false, isError: false, error: null, refetch: jest.fn() },
        portfolioValue: { data: 2000000000000000000n, isLoading: false, isError: false, error: null, refetch: jest.fn() },
      });

      mockHooks.useTokenBalance.mockReturnValue({
        data: 5000000000000000000n,
        formatted: '5.0',
        symbol: 'ETH',
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      });

      // Mock deposit transaction error
      mockHooks.useSavingsVaultDeposit.mockReturnValue({
        deposit: jest.fn(),
        isLoading: false,
        isSuccess: false,
        error: { message: 'Transaction failed: insufficient gas' },
        hash: null,
        reset: jest.fn(),
      });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Should show transaction error
      expect(screen.getByText('Deposit Failed')).toBeInTheDocument();
      expect(screen.getByText('Transaction failed: insufficient gas')).toBeInTheDocument();

      // Should not show any substitute success states
      expect(screen.queryByText('Deposit Successful!')).not.toBeInTheDocument();
    });

    it('shows validation errors without allowing invalid transactions', () => {
      mockHooks.useSavingsVaultBalances.mockReturnValue({
        availableBalance: { data: 1000000000000000000n, isLoading: false, isError: false, error: null, refetch: jest.fn() },
        portfolioValue: { data: 2000000000000000000n, isLoading: false, isError: false, error: null, refetch: jest.fn() },
      });

      mockHooks.useTokenBalance.mockReturnValue({
        data: 100000000000000000n, // 0.1 ETH
        formatted: '0.1',
        symbol: 'ETH',
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      });

      // Mock validation error
      mockHooks.validateAmount.mockReturnValue({
        isValid: false,
        error: 'Insufficient balance',
      });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Enter invalid amount
      const depositInput = screen.getByLabelText('Amount to Deposit');
      fireEvent.change(depositInput, { target: { value: '10' } }); // More than balance

      // Should show validation error
      expect(screen.getByText('Insufficient balance')).toBeInTheDocument();

      // Deposit button should be disabled (the submit button, not the tab button)
      const depositButton = screen.getByRole('button', { name: 'Deposit' });
      expect(depositButton).toBeDisabled();
    });
  });
});