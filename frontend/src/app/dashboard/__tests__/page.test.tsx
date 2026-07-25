import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';

import DashboardPage from '../page';
import { useAuthGuard } from '@/hooks/useAuthGuard';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
}));

// Mock auth guard hook
jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: jest.fn(),
}));

// Mock DashboardContent component
jest.mock('@/components/dashboard/DashboardContent', () => ({
  DashboardContent: jest.fn(({ userAddress }: { userAddress: string }) => (
    <div data-testid="dashboard-content">
      Dashboard Content for {userAddress}
    </div>
  )),
}));

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;
const mockUseAuthGuard = useAuthGuard as jest.MockedFunction<typeof useAuthGuard>;

describe('Dashboard Page Component Tests (Task 21.12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Data Source Wiring', () => {
    it('passes user address to DashboardContent when authenticated', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      
      mockUseAccount.mockReturnValue({
        address: testAddress as any,
        isConnected: true,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
        expect(screen.getByText(`Dashboard Content for ${testAddress}`)).toBeInTheDocument();
      });
    });

    it('correctly handles connected wallet address changes', async () => {
      const firstAddress = '0x1111111111111111111111111111111111111111';
      const secondAddress = '0x2222222222222222222222222222222222222222';

      // First render with first address
      mockUseAccount.mockReturnValue({
        address: firstAddress as any,
        isConnected: true,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      const { rerender } = render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(`Dashboard Content for ${firstAddress}`)).toBeInTheDocument();
      });

      // Re-render with second address
      mockUseAccount.mockReturnValue({
        address: secondAddress as any,
        isConnected: true,
      } as any);

      rerender(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(`Dashboard Content for ${secondAddress}`)).toBeInTheDocument();
      });
    });
  });

  describe('Loading/Error/Retry Rendering', () => {
    it('displays loading state while checking authentication', () => {
      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890' as any,
        isConnected: true,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true, // Loading state
      });

      render(<DashboardPage />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
    });

    it('displays loading state when wallet is not connected', () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false, // Not connected
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });

      render(<DashboardPage />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
    });

    it('displays loading state when address is missing', () => {
      mockUseAccount.mockReturnValue({
        address: undefined, // No address
        isConnected: true,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });

      render(<DashboardPage />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
    });
  });

  describe('Authentication and Access Control', () => {
    it('redirects to auth page when wallet is not connected', () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });

      render(<DashboardPage />);

      expect(mockPush).toHaveBeenCalledWith('/auth');
    });

    it('redirects to auth page when address is missing', () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: true,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });

      render(<DashboardPage />);

      expect(mockPush).toHaveBeenCalledWith('/auth');
    });

    it('redirects to auth page when not authenticated', () => {
      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890' as any,
        isConnected: true,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false, // Not authenticated
        isLoading: false,
      });

      render(<DashboardPage />);

      expect(mockPush).toHaveBeenCalledWith('/auth');
    });

    it('does not redirect when fully authenticated', () => {
      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890' as any,
        isConnected: true,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      render(<DashboardPage />);

      expect(mockPush).not.toHaveBeenCalledWith('/auth');
    });
  });

  describe('UI Structure and Content', () => {
    it('displays correct page title and description when authenticated', async () => {
      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890' as any,
        isConnected: true,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
        expect(screen.getByText('Your financial overview and recent activity on Bonitah Financial Network')).toBeInTheDocument();
      });
    });

    it('uses proper responsive container classes', async () => {
      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890' as any,
        isConnected: true,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      const { container } = render(<DashboardPage />);

      await waitFor(() => {
        expect(container.querySelector('.container')).toBeInTheDocument();
        expect(container.querySelector('.mx-auto')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles rapid authentication state changes gracefully', () => {
      // Start with loading
      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890' as any,
        isConnected: true,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      });

      const { rerender } = render(<DashboardPage />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Change to authenticated
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      rerender(<DashboardPage />);

      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    });

    it('handles wallet disconnection during dashboard view', () => {
      // Start authenticated
      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890' as any,
        isConnected: true,
      } as any);
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      const { rerender } = render(<DashboardPage />);
      
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();

      // Disconnect wallet
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
      } as any);

      rerender(<DashboardPage />);

      expect(mockPush).toHaveBeenCalledWith('/auth');
    });
  });
});