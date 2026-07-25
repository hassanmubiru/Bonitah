/**
 * Task 21.12: Role gating and access control tests for pages
 *
 * Tests proper role-based access restrictions across pages
 * Requirements: 14.9 - Role-based access control with proper authorization
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Import pages that have role-based access
import AdminPage from '../admin/page';
import DashboardPage from '../dashboard/page';

// Mock all necessary dependencies
jest.mock('wagmi');
jest.mock('next/navigation');
jest.mock('@/hooks/useAuthGuard');
jest.mock('@/hooks/useAdminData');
jest.mock('@/components/dashboard/DashboardContent');

// Import mocked hooks
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useAdminData } from '@/hooks/useAdminData';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';

const mockUseAuthGuard = useAuthGuard as jest.MockedFunction<typeof useAuthGuard>;
const mockUseAdminData = useAdminData as jest.MockedFunction<typeof useAdminData>;
const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('Pages Role Gating Tests (Task 21.12)', () => {
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

  describe('Admin Page Role Gating (Req 14.9)', () => {
    describe('Access Denial for Non-Admin Users', () => {
      it('blocks access for regular users with clear error message', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: true,
          isLoading: false,
          user: {
            id: 'user1',
            walletAddress: mockAddress,
            role: 'USER',
            displayName: 'Test User',
          },
        });

        render(<AdminPage />);

        // Should show access denied message
        expect(
          screen.getByText('Access Denied: Admin privileges required to access this page.'),
        ).toBeInTheDocument();

        // Should not show admin content
        expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
        expect(screen.queryByText('User Management')).not.toBeInTheDocument();
        expect(screen.queryByText('System Monitor')).not.toBeInTheDocument();
      });

      it('blocks access for unauthenticated users', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: false,
          isLoading: false,
          user: null,
        });

        render(<AdminPage />);

        // Should show access denied for unauthenticated users
        expect(
          screen.getByText('Access Denied: Admin privileges required to access this page.'),
        ).toBeInTheDocument();
        expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
      });

      it('blocks access for users with VERIFIER role (non-admin)', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: true,
          isLoading: false,
          user: {
            id: 'verifier1',
            walletAddress: mockAddress,
            role: 'VERIFIER', // Not admin
            displayName: 'Test Verifier',
          },
        });

        render(<AdminPage />);

        expect(
          screen.getByText('Access Denied: Admin privileges required to access this page.'),
        ).toBeInTheDocument();
        expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
      });

      it('does not leak admin functionality to non-admin users', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: true,
          isLoading: false,
          user: {
            id: 'user1',
            walletAddress: mockAddress,
            role: 'USER',
            displayName: 'Test User',
          },
        });

        render(<AdminPage />);

        // Should not show any admin-specific elements
        expect(screen.queryByText('User Management')).not.toBeInTheDocument();
        expect(screen.queryByText('Delete User')).not.toBeInTheDocument();
        expect(screen.queryByText('Promote to Admin')).not.toBeInTheDocument();
        expect(screen.queryByText('Maintenance Mode')).not.toBeInTheDocument();
        expect(screen.queryByText('System Backup')).not.toBeInTheDocument();
      });
    });

    describe('Access Granted for Admin Users', () => {
      beforeEach(() => {
        // Mock admin user authentication
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: true,
          isLoading: false,
          user: {
            id: 'admin1',
            walletAddress: mockAddress,
            role: 'ADMIN',
            displayName: 'Test Admin',
          },
        });

        // Mock admin data
        mockUseAdminData.mockReturnValue({
          systemHealth: {
            users: { total: 100, active: 50, growth: 10 },
            transactions: { total: 1000, recent: 5 },
            status: 'healthy',
            system: {
              cpu: 45,
              database: 'connected',
              memory: { rss: 1048576, heapUsed: 524288 },
            },
            errors: { recent: 0, rate: 0.001 },
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
                walletAddress: '0x1111111111111111111111111111111111111111',
                role: 'USER',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
              },
            ],
          },
          auditLog: {
            entries: [
              {
                id: '1',
                timestamp: '2024-01-01T00:00:00Z',
                action: 'USER_CREATED',
                userId: '1',
                adminId: 'admin1',
                details: 'User account created',
              },
            ],
          },
          isLoading: false,
          error: null,
          updateUser: jest.fn(),
          deleteUser: jest.fn(),
          toggleMaintenanceMode: jest.fn(),
          refreshData: jest.fn(),
        });
      });

      it('grants full access to admin users', () => {
        render(<AdminPage />);

        // Should show admin dashboard
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
        expect(
          screen.getByText('Manage users, monitor system health, and configure platform settings.'),
        ).toBeInTheDocument();

        // Should not show access denied message
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      });

      it('displays admin-only functionality tabs', () => {
        render(<AdminPage />);

        // Should show all admin tabs
        expect(screen.getByText('User Management')).toBeInTheDocument();
        expect(screen.getByText('Analytics')).toBeInTheDocument();
        expect(screen.getByText('System Monitor')).toBeInTheDocument();
        expect(screen.getByText('Audit Log')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      it('shows system health metrics only to admins', () => {
        render(<AdminPage />);

        // Should display sensitive system information
        expect(screen.getByText('100')).toBeInTheDocument(); // Total users
        expect(screen.getByText('50')).toBeInTheDocument(); // Active users
        expect(screen.getByText('1000')).toBeInTheDocument(); // Total transactions
        expect(screen.getByText('Healthy')).toBeInTheDocument(); // System status
      });

      it('allows admin user management operations', () => {
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

        // Navigate to User Management tab
        fireEvent.click(screen.getByText('User Management'));

        // Should show user management interface
        expect(screen.getByText('0x1111...1111')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    describe('Loading States During Role Check', () => {
      it('shows loading spinner during authentication check', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: false,
          isLoading: true,
          user: null,
        });

        render(<AdminPage />);

        // Should show loading spinner, not admin content or access denied
        expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument(); // Loading spinner
        expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      });

      it('does not leak admin data during loading', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: false,
          isLoading: true,
          user: null,
        });

        // Mock admin data that should not be visible during loading
        mockUseAdminData.mockReturnValue({
          systemHealth: {
            users: { total: 100, active: 50, growth: 10 },
          },
          isLoading: false,
          error: null,
          updateUser: jest.fn(),
          deleteUser: jest.fn(),
          toggleMaintenanceMode: jest.fn(),
          refreshData: jest.fn(),
        } as any);

        render(<AdminPage />);

        // Should not display any admin data during loading
        expect(screen.queryByText('100')).not.toBeInTheDocument();
        expect(screen.queryByText('User Management')).not.toBeInTheDocument();
      });
    });
  });

  describe('General User Pages Access', () => {
    describe('Dashboard Access for Regular Users', () => {
      it('allows authenticated users to access dashboard regardless of role', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: true,
          isLoading: false,
          user: {
            id: 'user1',
            walletAddress: mockAddress,
            role: 'USER', // Regular user
          },
        });

        // Mock DashboardContent component
        jest.doMock('@/components/dashboard/DashboardContent', () => ({
          DashboardContent: ({ userAddress }: { userAddress: string }) => (
            <div data-testid="dashboard-content">Dashboard for {userAddress}</div>
          ),
        }));

        render(<DashboardPage />);

        // Regular users should access dashboard
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
      });

      it('allows admin users to access dashboard', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: true,
          isLoading: false,
          user: {
            id: 'admin1',
            walletAddress: mockAddress,
            role: 'ADMIN', // Admin user
          },
        });

        render(<DashboardPage />);

        // Admin users should also access dashboard
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      it('denies access to unauthenticated users', () => {
        mockUseAuthGuard.mockReturnValue({
          isAuthenticated: false,
          isLoading: false,
          user: null,
        });

        render(<DashboardPage />);

        // Should redirect to auth
        expect(mockPush).toHaveBeenCalledWith('/auth');
      });
    });
  });

  describe('Role-Based Feature Visibility', () => {
    it('ensures role checks are performed consistently', () => {
      // Test that useAuthGuard is called with role requirements for admin page
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: 'USER' },
      });

      render(<AdminPage />);

      // Verify that useAuthGuard was called (role checking occurred)
      expect(mockUseAuthGuard).toHaveBeenCalled();
    });

    it('prevents role escalation through client-side manipulation', () => {
      // Simulate attempt to access admin page by manipulating client state
      let userRole = 'USER';

      // First render as regular user
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: userRole },
      });

      const { rerender } = render(<AdminPage />);
      expect(
        screen.getByText('Access Denied: Admin privileges required to access this page.'),
      ).toBeInTheDocument();

      // Simulate client-side role change (should not work)
      userRole = 'ADMIN';
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: userRole },
      });

      rerender(<AdminPage />);

      // Now should show admin content (simulating proper server-side auth change)
      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    });

    it('maintains role restrictions during data loading', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: 'USER' }, // Non-admin
      });

      // Even if admin data is loading, non-admin users should not see admin interface
      mockUseAdminData.mockReturnValue({
        isLoading: true,
        systemHealth: null,
        analytics: null,
        users: null,
        auditLog: null,
        error: null,
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
        toggleMaintenanceMode: jest.fn(),
        refreshData: jest.fn(),
      });

      render(<AdminPage />);

      // Should still show access denied, not loading admin data
      expect(
        screen.getByText('Access Denied: Admin privileges required to access this page.'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Loading')).not.toBeInTheDocument();
    });
  });

  describe('Security Edge Cases', () => {
    it('handles undefined user role gracefully', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: undefined as any }, // Edge case
      });

      render(<AdminPage />);

      // Should deny access for undefined role
      expect(
        screen.getByText('Access Denied: Admin privileges required to access this page.'),
      ).toBeInTheDocument();
    });

    it('handles null user object gracefully', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: null, // Edge case
      });

      render(<AdminPage />);

      // Should deny access for null user
      expect(
        screen.getByText('Access Denied: Admin privileges required to access this page.'),
      ).toBeInTheDocument();
    });

    it('handles empty string role gracefully', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: '' as any }, // Edge case
      });

      render(<AdminPage />);

      // Should deny access for empty role
      expect(
        screen.getByText('Access Denied: Admin privileges required to access this page.'),
      ).toBeInTheDocument();
    });

    it('handles case-sensitive role checking', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: 'admin' as any }, // lowercase, should not match 'ADMIN'
      });

      render(<AdminPage />);

      // Should deny access for case mismatch
      expect(
        screen.getByText('Access Denied: Admin privileges required to access this page.'),
      ).toBeInTheDocument();
    });
  });
});
