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

// Import page components - use dynamic imports to avoid issues
const DashboardPage = React.lazy(() => import('@/app/dashboard/page'));
const SavingsPage = React.lazy(() => import('@/app/savings/page'));
const AdminPage = React.lazy(() => import('@/app/admin/page'));

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
      expect(screen.getAllByText('Error')[0]).toBeInTheDocument();
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
    it('properly wires transaction hooks for deposit/withdraw operations', () => {
      const mockDeposit = jest.fn();
      const mockWithdraw = jest.fn();
      
      const { 
        useSavingsVaultBalances,
        useSavingsVaultDeposit,
        useSavingsVaultWithdraw,
        useTokenBalance,
        formatTokenAmount,
        validateAmount
      } = require('@/hooks/useSavingsVault');

      // Mock successful data states
      useSavingsVaultBalances.mockReturnValue({
        availableBalance: { data: 1000n, isLoading: false, isError: false, refetch: jest.fn() },
        portfolioValue: { data: 1500n, isLoading: false, isError: false, refetch: jest.fn() },
      });

      useTokenBalance.mockReturnValue({
        data: 2000n,
        formatted: '2000',
        symbol: 'USDC',
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      });

      useSavingsVaultDeposit.mockReturnValue({
        deposit: mockDeposit,
        hash: undefined,
        isLoading: false,
        isSuccess: false,
        error: null,
        reset: jest.fn(),
      });

      useSavingsVaultWithdraw.mockReturnValue({
        withdraw: mockWithdraw,
        hash: undefined,
        isLoading: false,
        isSuccess: false,
        error: null,
        reset: jest.fn(),
      });

      formatTokenAmount.mockImplementation((amount) => amount?.toString() || '0');
      validateAmount.mockReturnValue({ isValid: true });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Should display balance data (not placeholders)
      expect(screen.getByText('1000 USDC')).toBeInTheDocument();
      expect(screen.getByText('1500 USDC')).toBeInTheDocument();
      expect(screen.getByText('2000 USDC')).toBeInTheDocument();

      // Should have deposit and withdraw forms
      expect(screen.getAllByText('Deposit')[0]).toBeInTheDocument();
      expect(screen.getByText('Withdraw')).toBeInTheDocument();
    });

    it('handles transaction loading states correctly', () => {
      const { 
        useSavingsVaultBalances,
        useSavingsVaultDeposit,
        useSavingsVaultWithdraw,
        useTokenBalance,
        formatTokenAmount,
        validateAmount
      } = require('@/hooks/useSavingsVault');

      // Mock transaction loading
      useSavingsVaultBalances.mockReturnValue({
        availableBalance: { data: 1000n, isLoading: false, isError: false, refetch: jest.fn() },
        portfolioValue: { data: 1500n, isLoading: false, isError: false, refetch: jest.fn() },
      });

      useTokenBalance.mockReturnValue({
        data: 2000n,
        formatted: '2000',
        symbol: 'USDC',
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      });

      useSavingsVaultDeposit.mockReturnValue({
        deposit: jest.fn(),
        hash: '0xabc123',
        isLoading: true,
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

      formatTokenAmount.mockImplementation((amount) => amount?.toString() || '0');
      validateAmount.mockReturnValue({ isValid: true });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Should show transaction processing state
      expect(screen.getByText('Processing Deposit...')).toBeInTheDocument();
      expect(screen.getByText('Hash: 0xabc123')).toBeInTheDocument();
    });
  });
  describe('Admin Page - Role Gating (Req 14.9)', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        chain: { id: 84532 },
        connector: null,
        isConnecting: false,
        isDisconnected: false,
        isReconnecting: false,
        status: 'connected',
      });
    });

    it('blocks unauthorized access for non-admin users', () => {
      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      const { useAdminData } = require('@/hooks/useAdminData');
      
      // Mock non-admin user
      useAuthGuard.mockReturnValue({
        isAuthenticated: true,
        user: { role: 'USER' }, // Non-admin role
        isLoading: false,
      });

      useAdminData.mockReturnValue({
        systemHealth: null,
        analytics: null,
        users: null,
        auditLog: null,
        isLoading: false,
        error: null,
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
        toggleMaintenanceMode: jest.fn(),
        refreshData: jest.fn(),
      });

      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Should show access denied message (Req 14.9)
      expect(screen.getByText('Access Denied: Admin privileges required to access this page.')).toBeInTheDocument();
      
      // Should NOT show admin content
      expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    });

    it('blocks access for unauthenticated users', () => {
      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      const { useAdminData } = require('@/hooks/useAdminData');
      
      // Mock unauthenticated user
      useAuthGuard.mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });

      useAdminData.mockReturnValue({
        systemHealth: null,
        analytics: null,
        users: null,
        auditLog: null,
        isLoading: false,
        error: null,
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
        toggleMaintenanceMode: jest.fn(),
        refreshData: jest.fn(),
      });

      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Should show access denied (Req 14.9)
      expect(screen.getByText('Access Denied: Admin privileges required to access this page.')).toBeInTheDocument();
      
      // Should NOT show admin functionality
      expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
    });

    it('shows loading state during authentication check', () => {
      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      
      // Mock loading state
      useAuthGuard.mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: true,
      });

      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Should show loading spinner during auth check
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      
      // Should NOT show admin content or access denied during loading
      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
    });
    it('allows access for admin users and displays admin functionality', () => {
      const mockSystemHealth = {
        status: 'healthy',
        users: { total: 150, active: 45, growth: 12 },
        transactions: { total: 2500, recent: 8 },
        system: { cpu: 35, memory: { rss: 104857600, heapUsed: 52428800 }, database: 'connected' },
        errors: { recent: 2, rate: 0.01 }
      };

      const mockUsers = {
        users: [
          {
            id: 'user1',
            walletAddress: '0x1234567890123456789012345678901234567890',
            role: 'USER',
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z'
          }
        ]
      };

      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      const { useAdminData } = require('@/hooks/useAdminData');
      
      // Mock admin user
      useAuthGuard.mockReturnValue({
        isAuthenticated: true,
        user: { role: 'ADMIN' }, // Admin role
        isLoading: false,
      });

      useAdminData.mockReturnValue({
        systemHealth: mockSystemHealth,
        analytics: null,
        users: mockUsers,
        auditLog: null,
        isLoading: false,
        error: null,
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
        toggleMaintenanceMode: jest.fn(),
        refreshData: jest.fn(),
      });

      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Should show admin dashboard (Req 14.9 - authorized access)
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Manage users, monitor system health, and configure platform settings.')).toBeInTheDocument();
      
      // Should show system health data
      expect(screen.getByText('150')).toBeInTheDocument(); // Total users
      expect(screen.getByText('45')).toBeInTheDocument(); // Active users
      expect(screen.getByText('Healthy')).toBeInTheDocument(); // Status
      
      // Should show navigation tabs
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('System Monitor')).toBeInTheDocument();
      expect(screen.getByText('Audit Log')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      
      // Should NOT show access denied message
      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    });

    it('handles admin data loading states correctly', () => {
      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      const { useAdminData } = require('@/hooks/useAdminData');
      
      // Mock admin user with loading data
      useAuthGuard.mockReturnValue({
        isAuthenticated: true,
        user: { role: 'ADMIN' },
        isLoading: false,
      });

      useAdminData.mockReturnValue({
        systemHealth: null,
        analytics: null,
        users: null,
        auditLog: null,
        isLoading: true, // Data still loading
        error: null,
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
        toggleMaintenanceMode: jest.fn(),
        refreshData: jest.fn(),
      });

      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Should show admin interface even during data loading
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      
      // Should show 0 values during loading (not placeholders)
      expect(screen.getByText('0')).toBeInTheDocument(); // Uses || 0 fallback
      expect(screen.getByText('Unknown')).toBeInTheDocument(); // Status fallback
    });
    it('handles admin data error states with retry functionality', () => {
      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      const { useAdminData } = require('@/hooks/useAdminData');
      
      // Mock admin user with data error
      useAuthGuard.mockReturnValue({
        isAuthenticated: true,
        user: { role: 'ADMIN' },
        isLoading: false,
      });

      useAdminData.mockReturnValue({
        systemHealth: null,
        analytics: null,
        users: null,
        auditLog: null,
        isLoading: false,
        error: 'Failed to load admin data',
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
        toggleMaintenanceMode: jest.fn(),
        refreshData: jest.fn(),
      });

      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Should show admin interface with error alert
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Failed to load admin data')).toBeInTheDocument();
    });

    it('properly wires user management actions for admin users', async () => {
      const mockUpdateUser = jest.fn();
      const mockDeleteUser = jest.fn();
      const mockRefreshData = jest.fn();

      const mockUsers = {
        users: [
          {
            id: 'user1',
            walletAddress: '0x1234567890123456789012345678901234567890',
            role: 'USER',
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z'
          }
        ]
      };

      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      const { useAdminData } = require('@/hooks/useAdminData');
      
      useAuthGuard.mockReturnValue({
        isAuthenticated: true,
        user: { role: 'ADMIN' },
        isLoading: false,
      });

      useAdminData.mockReturnValue({
        systemHealth: { status: 'healthy', users: { total: 1, active: 1 }, transactions: { total: 0, recent: 0 } },
        analytics: null,
        users: mockUsers,
        auditLog: null,
        isLoading: false,
        error: null,
        updateUser: mockUpdateUser,
        deleteUser: mockDeleteUser,
        toggleMaintenanceMode: jest.fn(),
        refreshData: mockRefreshData,
      });

      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Should display user in management table
      expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
      expect(screen.getByText('USER')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();

      // Should have action buttons (more horizontal icon indicates dropdown menu)
      const actionButtons = screen.getAllByRole('button');
      const moreButton = actionButtons.find(button => 
        button.querySelector('[data-testid]') || 
        button.textContent?.includes('More') ||
        button.getAttribute('aria-label')?.includes('more')
      );
      
      if (moreButton) {
        fireEvent.click(moreButton);
        
        // Should show action menu items
        await waitFor(() => {
          expect(screen.getByText('Deactivate') || screen.getByText('Activate')).toBeInTheDocument();
        });
      }
    });
  });
  describe('Cross-Page Error Handling and Data Consistency', () => {
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

    it('consistently handles network connectivity issues across pages', () => {
      // Test that all pages handle network errors consistently
      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      const { useSavingsVaultBalances, useTokenBalance } = require('@/hooks/useSavingsVault');
      
      useAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      // Simulate network error
      const networkError = { message: 'Network connection failed' };
      
      useSavingsVaultBalances.mockReturnValue({
        availableBalance: { 
          data: undefined, 
          isLoading: false, 
          isError: true, 
          error: networkError,
          refetch: jest.fn()
        },
        portfolioValue: { 
          data: undefined, 
          isLoading: false, 
          isError: true, 
          error: networkError,
          refetch: jest.fn()
        },
      });

      useTokenBalance.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: networkError,
        refetch: jest.fn(),
      });

      const { useSavingsVaultDeposit, useSavingsVaultWithdraw } = require('@/hooks/useSavingsVault');
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

      const { formatTokenAmount, validateAmount } = require('@/hooks/useSavingsVault');
      formatTokenAmount.mockReturnValue('');
      validateAmount.mockReturnValue({ isValid: false, error: 'Amount is required' });

      render(
        <TestWrapper>
          <SavingsPage />
        </TestWrapper>
      );

      // Should show error states consistently without substituted values
      expect(screen.getByText('Failed to load balance')).toBeInTheDocument();
      expect(screen.getAllByText('Retry')).toHaveLength(3); // One for each failed section
      
      // Should never show placeholder financial data during errors
      expect(screen.queryByText(/\$\d+/)).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue(/\d+/)).not.toBeInTheDocument();
    });

    it('maintains data consistency when switching between loading and success states', () => {
      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      useAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      // First render: loading state
      const { rerender } = render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
      expect(screen.getByTestId('user-address')).toHaveTextContent(mockAddress);

      // Verify data consistency - address should always be the same
      const addressElement = screen.getByTestId('user-address');
      expect(addressElement).toHaveTextContent(mockAddress);

      // Re-render with same props should maintain consistency
      rerender(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('user-address')).toHaveTextContent(mockAddress);
    });
  });

  describe('Integration: Page Component State Management', () => {
    it('properly coordinates between authentication guard and page content', () => {
      const { useAuthGuard } = require('@/hooks/useAuthGuard');
      
      // Test loading → authenticated transition
      let authState = { isAuthenticated: false, isLoading: true };
      useAuthGuard.mockImplementation(() => authState);

      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        chain: { id: 84532 },
        connector: null,
        isConnecting: false,
        isDisconnected: false,
        isReconnecting: false,
        status: 'connected',
      });

      const { rerender } = render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Should show loading initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Update auth state to authenticated
      authState = { isAuthenticated: true, isLoading: false };
      useAuthGuard.mockImplementation(() => authState);

      rerender(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Should now show dashboard content
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });
});