/**
 * Task 21.12: Comprehensive component tests for pages
 * 
 * Covers data-source wiring, loading/error/retry rendering, and role gating across pages
 * Requirements: 11.1, 11.3, 11.4, 14.9, 15.5
 * 
 * Tests verify pages:
 * 1. Correctly connect to and display data from on-chain sources and backend APIs
 * 2. Handle loading states, error states, and retry functionality properly
 * 3. Never show placeholder financial values during loading/error states
 * 4. Properly restrict access based on user roles (admin-only functionality)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';

// Import pages to test
import DashboardPage from '../dashboard/page';
import SavingsPage from '../savings/page';
import AdminPage from '../admin/page';

// Mock dependencies
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useBalance: jest.fn(),
  useWriteContract: jest.fn(),
  useWaitForTransactionReceipt: jest.fn(),
  useEstimateGas: jest.fn(),
  useGasPrice: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: jest.fn(),
}));

jest.mock('@/hooks/useSiweAuth', () => ({
  useSiweAuth: jest.fn(),
}));

jest.mock('@/hooks/useContractRead', () => ({
  useContractRead: jest.fn(),
  usePortfolioValue: jest.fn(),
  useContractBalance: jest.fn(),
}));

jest.mock('@/hooks/useSavingsVault', () => ({
  useSavingsVaultBalances: jest.fn(),
  useSavingsVaultDeposit: jest.fn(),
  useSavingsVaultWithdraw: jest.fn(),
  useTokenBalance: jest.fn(),
  formatTokenAmount: jest.fn((val) => val?.toString() || '0'),
  validateAmount: jest.fn(),
}));

jest.mock('@/hooks/useAdminData', () => ({
  useAdminData: jest.fn(),
}));

jest.mock('@/components/dashboard/DashboardContent', () => ({
  DashboardContent: jest.fn(({ userAddress }) => (
    <div data-testid="dashboard-content">
      Dashboard for {userAddress}
    </div>
  )),
}));

// Type imports for mocks
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useSavingsVaultBalances, useSavingsVaultDeposit, useSavingsVaultWithdraw, useTokenBalance, validateAmount } from '@/hooks/useSavingsVault';
import { useAdminData } from '@/hooks/useAdminData';

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuthGuard = useAuthGuard as jest.MockedFunction<typeof useAuthGuard>;
const mockUseSavingsVaultBalances = useSavingsVaultBalances as jest.MockedFunction<typeof useSavingsVaultBalances>;
const mockUseSavingsVaultDeposit = useSavingsVaultDeposit as jest.MockedFunction<typeof useSavingsVaultDeposit>;
const mockUseSavingsVaultWithdraw = useSavingsVaultWithdraw as jest.MockedFunction<typeof useSavingsVaultWithdraw>;
const mockUseTokenBalance = useTokenBalance as jest.MockedFunction<typeof useTokenBalance>;
const mockValidateAmount = validateAmount as jest.MockedFunction<typeof validateAmount>;
const mockUseAdminData = useAdminData as jest.MockedFunction<typeof useAdminData>;

describe('Pages Component Tests (Task 21.12)', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890';
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default router mock
    mockUseRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    } as any);

    // Default account mock
    mockUseAccount.mockReturnValue({
      address: mockAddress,
      isConnected: true,
      chainId: 84532,
    } as any);
  });

  describe('Dashboard Page', () => {
    describe('Data Source Wiring (Req 11.1, 11.3)', () => {
      it('displays dashboard when properly authenticated', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: true,
          isLoading: false,
          isOnCorrectNetwork: true,
        });

        render(<DashboardPage />);

        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Your financial overview and recent activity on Bonitah Financial Network')).toBeInTheDocument();
        expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
        expect(screen.getByTestId('dashboard-content')).toHaveTextContent(`Dashboard for ${mockAddress}`);
      });

      it('redirects to auth when wallet not connected', () => {
        mockUseAccount.mockReturnValue({
          address: undefined,
          isConnected: false,
          chainId: undefined,
        } as any);

        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: false,
          isLoading: false,
          isOnCorrectNetwork: false,
        });

        render(<DashboardPage />);

        expect(mockPush).toHaveBeenCalledWith('/auth');
      });
    });

    describe('Loading States (Req 11.4)', () => {
      it('shows loading state during authentication check', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: false,
          isLoading: true,
          isOnCorrectNetwork: true,
        });

        render(<DashboardPage />);

        expect(screen.getByText('Loading...')).toBeInTheDocument();
        expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
      });

      it('does not show placeholder financial values during loading', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: false,
          isLoading: true,
          isOnCorrectNetwork: true,
        });

        render(<DashboardPage />);

        // Should not show any financial amounts or currency symbols during loading
        expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
        expect(screen.queryByText(/ETH/)).not.toBeInTheDocument();
        expect(screen.queryByText(/USDC/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Savings Page', () => {
    beforeEach(() => {
      // Default auth state
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });
    });

    describe('Data Source Wiring (Req 11.1, 11.3)', () => {
      it('wires to SavingsVault contract for balance data', () => {
        const mockBalanceData = {
          data: BigInt('1000000000000000000'), // 1 ETH
          isLoading: false,
          isError: false,
          refetch: jest.fn(),
        };

        mockUseSavingsVaultBalances.mockReturnValue({
          availableBalance: mockBalanceData,
          portfolioValue: mockBalanceData,
        });

        mockUseTokenBalance.mockReturnValue({
          data: BigInt('5000000000000000000'), // 5 ETH
          isLoading: false,
          isError: false,
          formatted: '5.0',
          symbol: 'ETH',
          refetch: jest.fn(),
        });

        mockValidateAmount.mockReturnValue({ isValid: true, error: null });

        render(<SavingsPage />);

        expect(screen.getByText('Available Balance')).toBeInTheDocument();
        expect(screen.getByText('Total Portfolio')).toBeInTheDocument();
        expect(screen.getByText('Wallet Balance')).toBeInTheDocument();
      });

      it('displays real balance data when loaded successfully', () => {
        const mockBalanceData = {
          data: BigInt('2500000000000000000'), // 2.5 ETH
          isLoading: false,
          isError: false,
          refetch: jest.fn(),
        };

        mockUseSavingsVaultBalances.mockReturnValue({
          availableBalance: mockBalanceData,
          portfolioValue: mockBalanceData,
        });

        mockUseTokenBalance.mockReturnValue({
          data: BigInt('5000000000000000000'), // 5 ETH
          isLoading: false,
          isError: false,
          formatted: '5.0 ETH',
          symbol: 'ETH',
          refetch: jest.fn(),
        });

        render(<SavingsPage />);

        expect(screen.getByText('5.0 ETH')).toBeInTheDocument();
      });
    });

    describe('Loading/Error/Retry States (Req 11.4, 11.5, 11.6)', () => {
      it('shows loading states for balance data', () => {
        const mockLoadingData = {
          data: undefined,
          isLoading: true,
          isError: false,
          refetch: jest.fn(),
        };

        mockUseSavingsVaultBalances.mockReturnValue({
          availableBalance: mockLoadingData,
          portfolioValue: mockLoadingData,
        });

        mockUseTokenBalance.mockReturnValue({
          data: undefined,
          isLoading: true,
          isError: false,
          formatted: '',
          symbol: 'ETH',
          refetch: jest.fn(),
        });

        render(<SavingsPage />);

        const loadingElements = screen.getAllByText('Loading...');
        expect(loadingElements.length).toBeGreaterThan(0);
      });

      it('shows error states with retry buttons when balance fetch fails', () => {
        const mockRefetch = jest.fn();
        const mockErrorData = {
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error('Network error'),
          refetch: mockRefetch,
        };

        mockUseSavingsVaultBalances.mockReturnValue({
          availableBalance: mockErrorData,
          portfolioValue: mockErrorData,
        });

        mockUseTokenBalance.mockReturnValue({
          data: undefined,
          isLoading: false,
          isError: true,
          formatted: '',
          symbol: 'ETH',
          refetch: jest.fn(),
        });

        render(<SavingsPage />);

        const errorElements = screen.getAllByText('Error');
        expect(errorElements.length).toBeGreaterThan(0);
        
        const retryButtons = screen.getAllByText('Retry');
        expect(retryButtons.length).toBeGreaterThan(0);

        // Test retry functionality
        fireEvent.click(retryButtons[0]);
        expect(mockRefetch).toHaveBeenCalled();
      });

      it('never shows placeholder financial values during loading or error', () => {
        const mockLoadingData = {
          data: undefined,
          isLoading: true,
          isError: false,
          refetch: jest.fn(),
        };

        mockUseSavingsVaultBalances.mockReturnValue({
          availableBalance: mockLoadingData,
          portfolioValue: mockLoadingData,
        });

        mockUseTokenBalance.mockReturnValue({
          data: undefined,
          isLoading: true,
          isError: false,
          formatted: '',
          symbol: 'ETH',
          refetch: jest.fn(),
        });

        render(<SavingsPage />);

        // Should not show any financial placeholders like $0.00, 0 ETH, etc.
        expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
        expect(screen.queryByText('0 ETH')).not.toBeInTheDocument();
        expect(screen.queryByText('0.00')).not.toBeInTheDocument();
      });

      it('provides refresh buttons for manual data refresh', () => {
        const mockRefetch = jest.fn();
        const mockBalanceData = {
          data: BigInt('1000000000000000000'),
          isLoading: false,
          isError: false,
          refetch: mockRefetch,
        };

        mockUseSavingsVaultBalances.mockReturnValue({
          availableBalance: mockBalanceData,
          portfolioValue: mockBalanceData,
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

        const refreshButtons = screen.getAllByLabelText(/refresh/i);
        expect(refreshButtons.length).toBeGreaterThan(0);

        fireEvent.click(refreshButtons[0]);
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    describe('Transaction Flow Integration', () => {
      it('wires deposit and withdraw transactions to SavingsVault contract', () => {
        const mockDeposit = jest.fn();
        const mockWithdraw = jest.fn();

        mockUseSavingsVaultDeposit.mockReturnValue({
          deposit: mockDeposit,
          isLoading: false,
          isSuccess: false,
          error: null,
          hash: null,
        });

        mockUseSavingsVaultWithdraw.mockReturnValue({
          withdraw: mockWithdraw,
          isLoading: false,
          isSuccess: false,
          error: null,
          hash: null,
        });

        mockUseSavingsVaultBalances.mockReturnValue({
          availableBalance: {
            data: BigInt('1000000000000000000'),
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
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

        mockValidateAmount.mockReturnValue({ isValid: true, error: null });

        render(<SavingsPage />);

        // Test deposit form
        const depositInput = screen.getByLabelText('Amount to Deposit');
        fireEvent.change(depositInput, { target: { value: '1.0' } });

        const depositButton = screen.getByRole('button', { name: 'Deposit' });
        fireEvent.click(depositButton);

        expect(mockDeposit).toHaveBeenCalledWith('1.0');
      });
    });
  });

  describe('Admin Page', () => {
    describe('Role Gating (Req 14.9)', () => {
      it('blocks unauthorized access and shows access denied message', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: true,
          isLoading: false,
          user: { role: 'USER' }, // Non-admin role
        });

        render(<AdminPage />);

        expect(screen.getByText('Access Denied: Admin privileges required to access this page.')).toBeInTheDocument();
        expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
      });

      it('allows access for admin users', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: true,
          isLoading: false,
          user: { role: 'ADMIN' },
        });

        mockUseAdminData.mockReturnValue({
          systemHealth: {
            users: { total: 100, active: 50, growth: 10 },
            transactions: { total: 1000, recent: 5 },
            status: 'healthy',
            system: { cpu: 45, database: 'connected' },
          },
          analytics: {
            userGrowth: [{ count: 10 }],
            transactionVolume: [{ volume: 100 }],
            revenue: [{ amount: 1000 }],
          },
          users: {
            users: [
              {
                id: '1',
                walletAddress: '0x1234567890123456789012345678901234567890',
                role: 'USER',
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            ],
          },
          auditLog: {
            entries: [
              {
                id: '1',
                timestamp: new Date().toISOString(),
                action: 'USER_CREATED',
                userId: '1',
                adminId: 'admin1',
                details: 'User account created',
              }
            ],
          },
          isLoading: false,
          error: null,
          updateUser: jest.fn(),
          deleteUser: jest.fn(),
          toggleMaintenanceMode: jest.fn(),
          refreshData: jest.fn(),
        });

        render(<AdminPage />);

        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Manage users, monitor system health, and configure platform settings.')).toBeInTheDocument();
      });

      it('shows loading state during authentication check', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: false,
          isLoading: true,
          user: null,
        });

        render(<AdminPage />);

        expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument(); // Loading spinner
        expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      });
    });

    describe('Admin Data Display', () => {
      beforeEach(() => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: true,
          isLoading: false,
          user: { role: 'ADMIN' },
        });
      });

      it('displays system health metrics from backend API', () => {
        mockUseAdminData.mockReturnValue({
          systemHealth: {
            users: { total: 150, active: 75, growth: 15 },
            transactions: { total: 2500, recent: 12 },
            status: 'healthy',
            system: { cpu: 35, database: 'connected', memory: { rss: 1024000, heapUsed: 512000 } },
            errors: { recent: 0, rate: 0.001 },
          },
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

        render(<AdminPage />);

        expect(screen.getByText('150')).toBeInTheDocument(); // Total users
        expect(screen.getByText('75')).toBeInTheDocument(); // Active users
        expect(screen.getByText('2500')).toBeInTheDocument(); // Total transactions
        expect(screen.getByText('Healthy')).toBeInTheDocument(); // System status
      });

      it('shows error state when admin data fetch fails', () => {
        mockUseAdminData.mockReturnValue({
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

        render(<AdminPage />);

        expect(screen.getByText('Failed to load admin data')).toBeInTheDocument();
      });
    });

    describe('User Management Interface', () => {
      beforeEach(() => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: true,
          isLoading: false,
          user: { role: 'ADMIN' },
        });
      });

      it('displays user list with management actions', () => {
        const mockUpdateUser = jest.fn();
        const mockDeleteUser = jest.fn();

        mockUseAdminData.mockReturnValue({
          systemHealth: null,
          analytics: null,
          users: {
            users: [
              {
                id: 'user1',
                walletAddress: '0x1111111111111111111111111111111111111111',
                role: 'USER',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
              },
              {
                id: 'user2',
                walletAddress: '0x2222222222222222222222222222222222222222',
                role: 'ADMIN',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
              }
            ],
          },
          auditLog: null,
          isLoading: false,
          error: null,
          updateUser: mockUpdateUser,
          deleteUser: mockDeleteUser,
          toggleMaintenanceMode: jest.fn(),
          refreshData: jest.fn(),
        });

        render(<AdminPage />);

        // Click on User Management tab
        fireEvent.click(screen.getByText('User Management'));

        expect(screen.getByText('0x1111...1111')).toBeInTheDocument();
        expect(screen.getByText('0x2222...2222')).toBeInTheDocument();
        expect(screen.getAllByText('Active')).toHaveLength(2);
      });
    });
  });

  describe('Cross-Page Requirements', () => {
    describe('No Placeholder Financial Values (Req 11.4)', () => {
      it('dashboard never shows placeholder financial values during loading', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: false,
          isLoading: true,
          isOnCorrectNetwork: true,
        });

        render(<DashboardPage />);

        // Should not contain any common financial placeholders
        const content = screen.getByText('Loading...').closest('div');
        expect(content).not.toHaveTextContent('$0');
        expect(content).not.toHaveTextContent('0.00');
        expect(content).not.toHaveTextContent('N/A');
        expect(content).not.toHaveTextContent('--');
      });
    });

    describe('Retry Functionality (Req 11.6)', () => {
      it('provides working retry mechanisms across pages', async () => {
        const mockRefetch = jest.fn().mockResolvedValue({});
        
        // Test retry on Savings page
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
            refetch: mockRefetch,
          },
          portfolioValue: {
            data: undefined,
            isLoading: false,
            isError: true,
            refetch: jest.fn(),
          },
        });

        mockUseTokenBalance.mockReturnValue({
          data: undefined,
          isLoading: false,
          isError: false,
          formatted: '',
          symbol: 'ETH',
          refetch: jest.fn(),
        });

        render(<SavingsPage />);

        const retryButton = screen.getAllByText('Retry')[0];
        fireEvent.click(retryButton);

        await waitFor(() => {
          expect(mockRefetch).toHaveBeenCalled();
        });
      });
    });
  });
});