import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useAccount } from 'wagmi';

import AdminPage from '../page';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useSiweAuth } from '@/hooks/useSiweAuth';

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
}));

// Mock auth hooks
jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: jest.fn(),
}));

jest.mock('@/hooks/useSiweAuth', () => ({
  useSiweAuth: jest.fn(),
}));

// Mock AdminDashboard component
jest.mock('@/components/admin/AdminDashboard', () => ({
  AdminDashboard: jest.fn(() => (
    <div data-testid="admin-dashboard">
      Admin Dashboard Content
    </div>
  )),
}));

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;
const mockUseAuthGuard = useAuthGuard as jest.MockedFunction<typeof useAuthGuard>;
const mockUseSiweAuth = useSiweAuth as jest.MockedFunction<typeof useSiweAuth>;

describe('Admin Page Component Tests (Task 21.12 - Role Gating)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Role-Based Access Control', () => {
    it('displays admin dashboard when user has ADMIN role', async () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        role: 'ADMIN', // Admin role
        address: '0x1234567890123456789012345678901234567890',
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
        expect(screen.getByText('Admin Dashboard Content')).toBeInTheDocument();
      });
    });

    it('blocks access when user has USER role', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        role: 'USER', // Regular user role
        address: '0x1234567890123456789012345678901234567890',
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      render(<AdminPage />);

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.getByText('You do not have permission to access this page.')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
    });

    it('blocks access when user has VERIFIER role (not ADMIN)', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        role: 'VERIFIER', // Verifier role (not admin)
        address: '0x1234567890123456789012345678901234567890',
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      render(<AdminPage />);

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
    });

    it('blocks access when role is undefined', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        role: undefined, // No role assigned
        address: '0x1234567890123456789012345678901234567890',
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      render(<AdminPage />);

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
    });
  });

  describe('Loading and Authentication States', () => {
    it('displays loading state while checking authentication', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true, // Loading auth
      });

      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        role: undefined,
        address: undefined,
        isLoading: true,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      render(<AdminPage />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    });

    it('displays loading state while wallet is connecting', () => {
      mockUseAccount.mockReturnValue({
        isConnected: false, // Not connected
        address: undefined,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      });

      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        role: undefined,
        address: undefined,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      render(<AdminPage />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows access denied immediately when not authenticated', () => {
      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false, // Not loading, just not authenticated
      });

      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        role: undefined,
        address: undefined,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      render(<AdminPage />);

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.getByText('You must be signed in as an administrator to access this page.')).toBeInTheDocument();
    });
  });

  describe('UI Structure and Accessibility', () => {
    it('uses proper semantic HTML for access denied state', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        role: 'USER',
        address: '0x1234567890123456789012345678901234567890',
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      render(<AdminPage />);

      expect(screen.getByRole('heading', { level: 1, name: 'Access Denied' })).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('uses proper semantic HTML for admin dashboard', async () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        role: 'ADMIN',
        address: '0x1234567890123456789012345678901234567890',
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Admin Dashboard' })).toBeInTheDocument();
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('provides appropriate navigation suggestions in access denied state', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        role: 'USER',
        address: '0x1234567890123456789012345678901234567890',
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      render(<AdminPage />);

      expect(screen.getByText('You do not have permission to access this page.')).toBeInTheDocument();
      expect(screen.getByText('Please contact your administrator if you believe you should have access.')).toBeInTheDocument();
      
      // Should provide navigation back to dashboard
      expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Security', () => {
    it('handles role changes during session gracefully', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      // Start with admin role
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        role: 'ADMIN',
        address: '0x1234567890123456789012345678901234567890',
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      const { rerender } = render(<AdminPage />);
      
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();

      // Role gets revoked during session
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        role: 'USER', // Role downgraded
        address: '0x1234567890123456789012345678901234567890',
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      rerender(<AdminPage />);

      expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    it('prevents access when authentication is compromised', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      // Auth guard shows not authenticated (e.g., JWT expired)
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });

      // But useSiweAuth still shows admin (stale state)
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true, // Stale/inconsistent state
        role: 'ADMIN',
        address: '0x1234567890123456789012345678901234567890',
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      render(<AdminPage />);

      // Should prioritize auth guard and block access
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
    });

    it('handles undefined or null role values securely', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        role: null as any, // Null role
        address: '0x1234567890123456789012345678901234567890',
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      render(<AdminPage />);

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
    });

    it('does not leak admin content in DOM when access is denied', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        role: 'USER',
        address: '0x1234567890123456789012345678901234567890',
        isLoading: false,
        error: null,
        signIn: jest.fn(),
        signOut: jest.fn(),
        checkAuth: jest.fn(),
      });

      const { container } = render(<AdminPage />);

      // Admin dashboard should not be rendered at all
      expect(container.querySelector('[data-testid="admin-dashboard"]')).not.toBeInTheDocument();
      
      // Should not contain any admin-specific content
      expect(container.textContent).not.toContain('Admin Dashboard Content');
    });
  });
});