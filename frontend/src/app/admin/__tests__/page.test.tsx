import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import AdminPage from '../page';
import { useAuthGuard } from '@/hooks/useAuthGuard';

// Mock hooks
jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: jest.fn(),
}));

// Mock useAdminData hook
jest.mock('@/hooks/useAdminData', () => ({
  useAdminData: jest.fn(),
}));

const mockUseAuthGuard = useAuthGuard as jest.MockedFunction<typeof useAuthGuard>;
const mockUseAdminData = require('@/hooks/useAdminData').useAdminData as jest.MockedFunction<any>;

describe('Admin Page Component Tests (Task 21.12 - Role Gating)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for useAdminData
    mockUseAdminData.mockReturnValue({
      systemHealth: {
        users: { total: 100, active: 85, growth: 12 },
        transactions: { total: 1500, recent: 25 },
        status: 'healthy',
        system: { cpu: 45, memory: { rss: 134217728, heapUsed: 67108864 }, database: 'connected' },
        errors: { recent: 0, rate: 0.001 }
      },
      analytics: {
        userGrowth: [{ count: 10 }],
        transactionVolume: [{ volume: 100 }],
        revenue: [{ amount: 1000 }]
      },
      users: {
        users: [
          {
            id: '1',
            walletAddress: '0x1234567890123456789012345678901234567890',
            role: 'USER',
            isActive: true,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-02T00:00:00Z'
          }
        ]
      },
      auditLog: {
        entries: [
          {
            id: '1',
            timestamp: '2023-01-01T00:00:00Z',
            action: 'USER_CREATED',
            userId: '1',
            adminId: 'admin1',
            details: 'User account created'
          }
        ]
      },
      isLoading: false,
      error: null,
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      toggleMaintenanceMode: jest.fn(),
      refreshData: jest.fn()
    });
  });

  describe('Role-Based Access Control', () => {
    it('displays admin dashboard when user has ADMIN role', async () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: 'ADMIN' }, // Admin role
      });

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Manage users, monitor system health, and configure platform settings.')).toBeInTheDocument();
      });
    });

    it('blocks access when user has USER role', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: 'USER' }, // Regular user role
      });

      render(<AdminPage />);

      expect(screen.getByText('Access Denied: Admin privileges required to access this page.')).toBeInTheDocument();
      expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
    });

    it('blocks access when user has VERIFIER role (not ADMIN)', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: 'VERIFIER' }, // Verifier role (not admin)
      });

      render(<AdminPage />);

      expect(screen.getByText('Access Denied: Admin privileges required to access this page.')).toBeInTheDocument();
      expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
    });

    it('blocks access when role is undefined', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: undefined }, // No role assigned
      });

      render(<AdminPage />);

      expect(screen.getByText('Access Denied: Admin privileges required to access this page.')).toBeInTheDocument();
      expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
    });
  });

  describe('Loading and Authentication States', () => {
    it('displays loading state while checking authentication', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true, // Loading auth
        user: undefined,
      });

      const { container } = render(<AdminPage />);

      // Check for loading spinner animation class
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
      expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    });

    it('shows access denied immediately when not authenticated', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false, // Not loading, just not authenticated
        user: undefined,
      });

      render(<AdminPage />);

      expect(screen.getByText('Access Denied: Admin privileges required to access this page.')).toBeInTheDocument();
    });
  });

  describe('Data Source Wiring', () => {
    it('displays system health metrics from useAdminData hook', async () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: 'ADMIN' },
      });

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument(); // Total users
        expect(screen.getByText('85')).toBeInTheDocument(); // Active users
        expect(screen.getByText('1500')).toBeInTheDocument(); // Transactions
        // The status shows the raw value with capitalize class, so it should be 'Healthy'
        expect(screen.getByText(/healthy/i)).toBeInTheDocument(); // System status - case insensitive match
      });
    });

    it('displays user management data correctly', async () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: 'ADMIN' },
      });

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('0x1234...7890')).toBeInTheDocument(); // Wallet address
        expect(screen.getByText('USER')).toBeInTheDocument(); // Role badge
        expect(screen.getByText('Active')).toBeInTheDocument(); // Status badge
      });
    });
  });

  describe('Loading/Error States', () => {
    it('displays error state when admin data fails to load', async () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: 'ADMIN' },
      });

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
        refreshData: jest.fn()
      });

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load admin data')).toBeInTheDocument();
      });
    });

    it('handles role changes during session gracefully', () => {
      // Start with admin role
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: 'ADMIN' },
      });

      const { rerender } = render(<AdminPage />);
      
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();

      // Role gets revoked during session
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: 'USER' }, // Role downgraded
      });

      rerender(<AdminPage />);

      expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
      expect(screen.getByText('Access Denied: Admin privileges required to access this page.')).toBeInTheDocument();
    });

    it('prevents access when authentication is compromised', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false, // Not authenticated
        isLoading: false,
        user: { role: 'ADMIN' }, // Stale/inconsistent state
      });

      render(<AdminPage />);

      // Should prioritize auth guard and block access
      expect(screen.getByText('Access Denied: Admin privileges required to access this page.')).toBeInTheDocument();
      expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
    });

    it('does not leak admin content in DOM when access is denied', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { role: 'USER' },
      });

      const { container } = render(<AdminPage />);

      // Admin dashboard should not be rendered at all
      expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
      
      // Should not contain any admin-specific content
      expect(container.textContent).not.toContain('User Management');
      expect(container.textContent).not.toContain('System Monitor');
      expect(container.textContent).not.toContain('Audit Log');
    });
  });
});
