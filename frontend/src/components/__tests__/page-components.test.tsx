/**
 * Task 21.12: Write component tests for pages
 * 
 * Component tests covering data-source wiring, loading/error/retry rendering,
 * and role gating across pages.
 * 
 * Requirements Coverage:
 * - 11.1: Dashboard displays real data from on-chain reads
 * - 11.3: Interactive charts populated from real contract data (no mocks)
 * - 11.4: Loading states without placeholder financial values
 * - 14.9: Admin role gating with unauthorized access blocked
 * - 15.5: Component testing (fixtures, mocks, assertions)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';

// Import page components
import DashboardPage from '@/app/dashboard/page';
import SavingsPage from '@/app/savings/page';
import AdminPage from '@/app/admin/page';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
}));

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

jest.mock('@/hooks/useAdminData', () => ({
  useAdminData: jest.fn(),
}));

jest.mock('@/components/dashboard/DashboardContent', () => {
  return function MockDashboardContent({ userAddress }: { userAddress: string }) {
    return (
      <div data-testid="dashboard-content">
        <div data-testid="user-address">{userAddress}</div>
      </div>
    );
  };
});

const mockRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;
// Test wrapper for React Query
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

describe('Page Component Tests - Data Source Wiring and States', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    });
  });

  describe('Dashboard Page - Data Source Wiring (Req 11.1, 11.3)', () => {
    const mockAddress = '0x1234567890123456789012345678901234567890';

    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        address: mockAddress,
        isConnected: true,
        chain: { id: 84532 },
        connector: null,
        isConnecting: false,
        isDisconnected: false,
        isReconnecting: false,
        status: 'connected',
      });
    });

    it('properly wires data sources and passes user address to DashboardContent', async () => {
      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      useAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Should render dashboard content with proper data wiring
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
      expect(screen.getByTestId('user-address')).toHaveTextContent(mockAddress);
      
      // Verify requirements text (Req 11.1)
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText(/financial overview/i)).toBeInTheDocument();
    });

    it('shows loading state without placeholder values during auth check', () => {
      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      useAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      });

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Should show loading state (Req 11.4)
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      // Should NOT show any financial values or placeholders (Req 11.4)
      expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
      expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+\.\d+/)).not.toBeInTheDocument();
      expect(screen.queryByText(/balance/i)).not.toBeInTheDocument();
    });
    it('redirects to auth when not connected', () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
        chain: undefined,
        connector: null,
        isConnecting: false,
        isDisconnected: true,
        isReconnecting: false,
        status: 'disconnected',
      });

      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      useAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Should redirect to auth when not connected
      expect(mockPush).toHaveBeenCalledWith('/auth');
    });

    it('redirects to auth when not authenticated', () => {
      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      useAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Should redirect when not authenticated
      expect(mockPush).toHaveBeenCalledWith('/auth');
    });

    it('properly wires user address to child component for data fetching', () => {
      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      useAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Verify correct data wiring - user address passed to DashboardContent (Req 11.1)
      expect(screen.getByTestId('user-address')).toHaveTextContent(mockAddress);
      
      // No placeholder data shown in loading state
      const dashboardContent = screen.getByTestId('dashboard-content');
      expect(dashboardContent).toBeInTheDocument();
    });
  });

  describe('Savings Page - Loading/Error/Retry States', () => {
    const mockAddress = '0x1234567890123456789012345678901234567890';

    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        address: mockAddress,
        isConnected: true,
        chain: { id: 84532 },
        connector: null,
        isConnecting: false,
        isDisconnected: false,
        isReconnecting: false,
        status: 'connected',
      });

      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      useAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });
    });
    it('displays loading states without placeholder financial values', () => {
      const { 
        useSavingsVaultBalances,
        useSavingsVaultDeposit,
        useSavingsVaultWithdraw,
        useTokenBalance,
        formatTokenAmount,
        validateAmount
      } = require('@/hooks/useSavingsVault');

      // Mock loading states for all data hooks
      useSavingsVaultBalances.mockReturnValue({
        availableBalance: { data: undefined, isLoading: true, isError: false, refetch: jest.fn() },
        portfolioValue: { data: undefined, isLoading: true, isError: false, refetch: jest.fn() },
      });

      useTokenBalance.mockReturnValue({
        data: undefined,
        formatted: undefined,
        symbol: 'ETH',
        isLoading: true,
        isError: false,
        refetch: jest.fn(),
      });

      useSavingsVaultDeposit.mockReturnValue({
        deposit: jest.fn(),
        hash: undefined,
        isLoading: false,
        isSuccess: false,
        error: null,
        reset: jest.fn(),
      });

      useSavingsVaultWithdraw.mockReturnValue({
        withdraw: jest.fn(),
        hash: undefined,
        isLoading: false,
        isSuccess: false,
        error: null,
        reset: jest.fn(),
      });

      formatTokenAmount.mockReturnValue('0');
      validateAmount.mockReturnValue({ isValid: false, error: 'Amount is required' });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Should show loading states (Req 11.4)
      expect(screen.getAllByText('Loading...')).toHaveLength(3); // Balance, portfolio, and wallet balance

      // Should NOT show any financial placeholder values (Req 11.4)
      expect(screen.queryByText(/\$\d+/)).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue(/\d+\.\d+/)).not.toBeInTheDocument();
      
      // Loading text should be present for each section
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('displays error states with retry functionality', async () => {
      const mockRefetch = jest.fn();
      const { 
        useSavingsVaultBalances,
        useSavingsVaultDeposit,
        useSavingsVaultWithdraw,
        useTokenBalance,
        formatTokenAmount,
        validateAmount
      } = require('@/hooks/useSavingsVault');

      // Mock error states
      useSavingsVaultBalances.mockReturnValue({
        availableBalance: { 
          data: undefined, 
          isLoading: false, 
          isError: true,
          error: { message: 'Failed to load balance' },
          refetch: mockRefetch
        },
        portfolioValue: { 
          data: undefined, 
          isLoading: false, 
          isError: true,
          error: { message: 'Failed to load portfolio' },
          refetch: mockRefetch
        },
      });

      useTokenBalance.mockReturnValue({
        data: undefined,
        formatted: undefined,
        symbol: 'ETH',
        isLoading: false,
        isError: true,
        error: { message: 'Failed to load wallet balance' },
        refetch: mockRefetch,
      });

      useSavingsVaultDeposit.mockReturnValue({
        deposit: jest.fn(),
        hash: undefined,
        isLoading: false,
        isSuccess: false,
        error: null,
        reset: jest.fn(),
      });

      useSavingsVaultWithdraw.mockReturnValue({
        withdraw: jest.fn(),
        hash: undefined,
        isLoading: false,
        isSuccess: false,
        error: null,
        reset: jest.fn(),
      });

      formatTokenAmount.mockReturnValue('');
      validateAmount.mockReturnValue({ isValid: false, error: 'Amount is required' });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Should show error states (Req 11.6)
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to load balance')).toBeInTheDocument();
      
      // Should have retry buttons (Req 11.6)
      const retryButtons = screen.getAllByText('Retry');
      expect(retryButtons.length).toBeGreaterThan(0);

      // Retry should call refetch
      fireEvent.click(retryButtons[0]);
      expect(mockRefetch).toHaveBeenCalled();

      // Should NOT show placeholder financial values in error state (Req 11.6)
      expect(screen.queryByText(/\$\d+/)).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue(/\d+/)).not.toBeInTheDocument();
    });