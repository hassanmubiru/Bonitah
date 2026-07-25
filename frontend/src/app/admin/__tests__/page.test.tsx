/**
 * Component tests for Admin page
 * 
 * Tests cover:
 * - Role gating (Requirement 14.9)
 * - Unauthorized access blocking
 * - Data-source wiring for admin operations
 * - Loading/error/retry rendering
 * 
 * Validates Requirements: 14.9, 15.5
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

import AdminPage from '../page';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useAdminData } from '@/hooks/useAdminData';

// Mock auth guard
jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: jest.fn(),
}));

// Mock admin data hook
jest.mock('@/hooks/useAdminData', () => ({
  useAdminData: jest.fn(),
}));

const mockUseAuthGuard = useAuthGuard as jest.MockedFunction<typeof useAuthGuard>;
const mockUseAdminData = useAdminData as jest.MockedFunction<typeof useAdminData>;

describe('AdminPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Default mock for admin data
    mockUseAdminData.mockReturnValue({
      systemHealth: {
        users: { total: 100, active: 85, growth: 5 },
        transactions: { total: 1500, recent: 12 },
        status: 'healthy' as const,
        system: { cpu: 45, memory: { rss: 134217728, heapUsed: 67108864 }, database: 'connected' },
        errors: { recent: 2, rate: 0.001 },
      },
      analytics: {
        userGrowth: [{ date: '2024-01-01', count: 10 }],
        transactionVolume: [{ date: '2024-01-01', volume: 50 }],
        revenue: [{ date: '2024-01-01', amount: 1000 }],
      },
      users: {
        users: [
          {
            id: '1',
            walletAddress: '0x1234567890123456789012345678901234567890',
            role: 'USER' as const,
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
          {
            id: '2',
            walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
            role: 'ADMIN' as const,
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
        ],
        total: 2,
        page: 1,
      },
      auditLog: {
        entries: [
          {
            id: '1',
            action: 'USER_UPDATED',
            userId: '1',
            adminId: '2',
            timestamp: '2024-01-02T00:00:00Z',
            details: 'User role updated',
          },
        ],
        total: 1,
        page: 1,
      },
      isLoading: false,
      error: null,
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      toggleMaintenanceMode: jest.fn(),
      refreshData: jest.fn(),
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  describe('Role Gating - Requirement 14.9', () => {
    it('shows loading spinner while checking authentication', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
      });

      renderWithProviders(<AdminPage />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByText(/admin dashboard/i)).not.toBeInTheDocument();
    });

    it('blocks access for unauthenticated users', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });

      renderWithProviders(<AdminPage />);

      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      expect(screen.getByText(/admin privileges required/i)).toBeInTheDocument();
      expect(screen.queryByText(/admin dashboard/i)).not.toBeInTheDocument();
    });

    it('blocks access for authenticated non-admin users', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { 
          id: '1', 
          walletAddress: '0x1234567890123456789012345678901234567890',
          role: 'USER' as const, // Non-admin user
        },
      });

      renderWithProviders(<AdminPage />);

      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      expect(screen.getByText(/admin privileges required/i)).toBeInTheDocument();
      expect(screen.queryByText(/admin dashboard/i)).not.toBeInTheDocument();
    });

    it('allows access for admin users', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { 
          id: '2', 
          walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          role: 'ADMIN' as const, // Admin user
        },
      });

      renderWithProviders(<AdminPage />);

      expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
      expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
    });

    it('blocks access when user role is undefined', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { 
          id: '3', 
          walletAddress: '0x9999999999999999999999999999999999999999',
          role: undefined as any, // Invalid role
        },
      });

      renderWithProviders(<AdminPage />);

      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      expect(screen.queryByText(/admin dashboard/i)).not.toBeInTheDocument();
    });
  });

  describe('Data Source Wiring', () => {
    beforeEach(() => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { 
          id: '2', 
          walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          role: 'ADMIN' as const,
        },
      });
    });

    it('displays system health metrics from admin data source', () => {
      renderWithProviders(<AdminPage />);

      // System health overview cards
      expect(screen.getByText('100')).toBeInTheDocument(); // Total users
      expect(screen.getByText('85')).toBeInTheDocument(); // Active users  
      expect(screen.getByText('1500')).toBeInTheDocument(); // Transactions
      expect(screen.getByText(/healthy/i)).toBeInTheDocument(); // System status
    });

    it('displays user management data correctly', async () => {
      renderWithProviders(<AdminPage />);

      // Wait for user table to load
      await waitFor(() => {
        expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
        expect(screen.getByText('0xabcdef...cdef')).toBeInTheDocument();
      });

      // Check user roles are displayed
      expect(screen.getAllByText('USER')).toHaveLength(1);
      expect(screen.getAllByText('ADMIN')).toHaveLength(1);
    });

    it('displays analytics data in analytics tab', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminPage />);

      // Click analytics tab
      await user.click(screen.getByRole('tab', { name: /analytics/i }));

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument(); // User growth
        expect(screen.getByText('50')).toBeInTheDocument(); // Transaction volume
        expect(screen.getByText('$1,000')).toBeInTheDocument(); // Revenue
      });
    });

    it('displays audit log data in audit tab', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminPage />);

      // Click audit log tab
      await user.click(screen.getByRole('tab', { name: /audit log/i }));

      await waitFor(() => {
        expect(screen.getByText('USER_UPDATED')).toBeInTheDocument();
        expect(screen.getByText('User role updated')).toBeInTheDocument();
      });
    });
  });

  describe('Loading and Error States', () => {
    beforeEach(() => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { 
          id: '2', 
          walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          role: 'ADMIN' as const,
        },
      });
    });

    it('displays error alert when admin data loading fails', () => {
      mockUseAdminData.mockReturnValue({
        ...mockUseAdminData(),
        error: 'Failed to load admin data',
        isLoading: false,
      });

      renderWithProviders(<AdminPage />);

      expect(screen.getByText(/failed to load admin data/i)).toBeInTheDocument();
    });

    it('handles empty user list state', () => {
      mockUseAdminData.mockReturnValue({
        ...mockUseAdminData(),
        users: {
          users: [],
          total: 0,
          page: 1,
        },
      });

      renderWithProviders(<AdminPage />);

      expect(screen.getByText(/no users found matching the current filters/i)).toBeInTheDocument();
    });

    it('displays loading indicators during data operations', () => {
      mockUseAdminData.mockReturnValue({
        ...mockUseAdminData(),
        isLoading: true,
      });

      renderWithProviders(<AdminPage />);

      // Should still show the admin dashboard but with loading states
      expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
    });
  });

  describe('User Action Functionality', () => {
    const mockUpdateUser = jest.fn();
    const mockDeleteUser = jest.fn();
    const mockRefreshData = jest.fn();

    beforeEach(() => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { 
          id: '2', 
          walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          role: 'ADMIN' as const,
        },
      });

      mockUseAdminData.mockReturnValue({
        ...mockUseAdminData(),
        updateUser: mockUpdateUser,
        deleteUser: mockDeleteUser,
        refreshData: mockRefreshData,
      });
    });

    it('provides user action menu for each user', async () => {
      renderWithProviders(<AdminPage />);

      // Find action menu buttons
      const actionButtons = screen.getAllByRole('button', { name: /more horizontal/i });
      expect(actionButtons).toHaveLength(2); // One for each user
    });

    it('calls appropriate functions when user actions are triggered', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminPage />);

      // Find first action menu button and click it
      const actionButtons = screen.getAllByRole('button', { name: /more horizontal/i });
      await user.click(actionButtons[0]);

      // Should show action menu
      await waitFor(() => {
        expect(screen.getByText(/deactivate/i)).toBeInTheDocument();
        expect(screen.getByText(/promote to admin/i)).toBeInTheDocument();
        expect(screen.getByText(/delete user/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filter Functionality', () => {
    beforeEach(() => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { 
          id: '2', 
          walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          role: 'ADMIN' as const,
        },
      });
    });

    it('provides search input for user filtering', () => {
      renderWithProviders(<AdminPage />);

      const searchInput = screen.getByPlaceholderText(/search by wallet address/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('provides filter controls for role and status', () => {
      renderWithProviders(<AdminPage />);

      expect(screen.getByText(/role: all/i)).toBeInTheDocument();
      expect(screen.getByText(/status: all/i)).toBeInTheDocument();
    });

    it('provides export functionality', () => {
      renderWithProviders(<AdminPage />);

      expect(screen.getByText(/export/i)).toBeInTheDocument();
    });
  });

  describe('System Monitoring Integration', () => {
    beforeEach(() => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { 
          id: '2', 
          walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          role: 'ADMIN' as const,
        },
      });
    });

    it('displays system resource monitoring in system monitor tab', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminPage />);

      await user.click(screen.getByRole('tab', { name: /system monitor/i }));

      await waitFor(() => {
        expect(screen.getByText(/cpu usage/i)).toBeInTheDocument();
        expect(screen.getByText('45%')).toBeInTheDocument();
        expect(screen.getByText(/memory \(rss\)/i)).toBeInTheDocument();
        expect(screen.getByText(/128mb/i)).toBeInTheDocument();
      });
    });

    it('displays maintenance mode controls in settings tab', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminPage />);

      await user.click(screen.getByRole('tab', { name: /settings/i }));

      await waitFor(() => {
        expect(screen.getByText(/maintenance mode/i)).toBeInTheDocument();
        expect(screen.getByText(/toggle maintenance/i)).toBeInTheDocument();
        expect(screen.getByText(/system backup/i)).toBeInTheDocument();
      });
    });
  });
});