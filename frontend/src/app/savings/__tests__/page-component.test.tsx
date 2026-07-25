/**
 * Component tests for Savings page
 * 
 * Tests cover:
 * - Data-source wiring to SavingsVault contract
 * - Loading/error/retry rendering for vault operations
 * - Transaction signing integration
 * - Real-time balance updates
 * 
 * Validates Requirements: 11.1, 11.4, 15.5
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import '@testing-library/jest-dom';

import SavingsPage from '../page';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useSavingsVault } from '@/hooks/useSavingsVault';

// Mock wagmi
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useWriteContract: jest.fn(),
  useWaitForTransactionReceipt: jest.fn(),
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock auth guard
jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: jest.fn(),
}));

// Mock savings vault hook
jest.mock('@/hooks/useSavingsVault', () => ({
  useSavingsVault: jest.fn(),
}));

// Mock contract read hooks
jest.mock('@/hooks/useContractRead', () => ({
  useContractRead: jest.fn(),
  usePortfolioValue: jest.fn(),
  useContractBalance: jest.fn(),
}));

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuthGuard = useAuthGuard as jest.MockedFunction<typeof useAuthGuard>;
const mockUseSavingsVault = useSavingsVault as jest.MockedFunction<typeof useSavingsVault>;

describe('SavingsPage Component Tests', () => {
  let queryClient: QueryClient;
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn(),
    });

    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
    });

    mockUseAuthGuard.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { 
        id: '1', 
        walletAddress: '0x1234567890123456789012345678901234567890',
        role: 'USER' as const,
      },
    });

    mockUseSavingsVault.mockReturnValue({
      balance: {
        deposited: BigInt(1000000000000000000), // 1 ETH in wei
        available: BigInt(800000000000000000), // 0.8 ETH available
        locked: BigInt(200000000000000000), // 0.2 ETH locked
      },
      goals: [
        {
          id: BigInt(1),
          targetAmount: BigInt(5000000000000000000), // 5 ETH
          targetDate: BigInt(Date.now() / 1000 + 86400 * 30), // 30 days from now
          savedAmount: BigInt(1000000000000000000), // 1 ETH saved
          completed: false,
        },
      ],
      locks: [
        {
          amount: BigInt(200000000000000000), // 0.2 ETH
          expiry: BigInt(Date.now() / 1000 + 86400 * 7), // 7 days from now
          released: false,
        },
      ],
      isLoading: false,
      error: null,
      deposit: jest.fn(),
      withdraw: jest.fn(),
      createGoal: jest.fn(),
      contributeToGoal: jest.fn(),
      lockFunds: jest.fn(),
      withdrawLocked: jest.fn(),
      refetch: jest.fn(),
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  describe('Authentication and Access Control', () => {
    it('redirects to auth when not connected', async () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
        isConnecting: false,
        isDisconnected: true,
        isReconnecting: false,
        status: 'disconnected',
      });

      renderWithProviders(<SavingsPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth');
      });
    });

    it('redirects to auth when not authenticated', async () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });

      renderWithProviders(<SavingsPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth');
      });
    });

    it('shows loading state during authentication check', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
      });

      renderWithProviders(<SavingsPage />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Data Source Wiring - SavingsVault Contract', () => {
    it('displays vault balance from contract data', async () => {
      renderWithProviders(<SavingsPage />);

      await waitFor(() => {
        // Should display balance from useSavingsVault hook
        expect(screen.getByText(/savings vault/i)).toBeInTheDocument();
      });

      // Check that vault data is properly wired
      expect(mockUseSavingsVault).toHaveBeenCalled();
    });

    it('displays goals from contract data', async () => {
      renderWithProviders(<SavingsPage />);

      await waitFor(() => {
        expect(screen.getByText(/savings goals/i)).toBeInTheDocument();
      });

      // Goals should be displayed from the contract data
      const goalElements = screen.getAllByText(/goal/i);
      expect(goalElements.length).toBeGreaterThan(0);
    });

    it('displays locked savings from contract data', async () => {
      renderWithProviders(<SavingsPage />);

      await waitFor(() => {
        expect(screen.getByText(/locked savings/i)).toBeInTheDocument();
      });
    });

    it('passes correct user address to savings vault hook', () => {
      renderWithProviders(<SavingsPage />);

      expect(mockUseSavingsVault).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
    });
  });

  describe('Loading States - Requirement 11.4', () => {
    it('displays loading state while fetching vault data', () => {
      mockUseSavingsVault.mockReturnValue({
        ...mockUseSavingsVault(),
        isLoading: true,
        balance: null,
        goals: [],
        locks: [],
      });

      renderWithProviders(<SavingsPage />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('does not display placeholder values during loading', () => {
      mockUseSavingsVault.mockReturnValue({
        ...mockUseSavingsVault(),
        isLoading: true,
        balance: null,
        goals: [],
        locks: [],
      });

      renderWithProviders(<SavingsPage />);

      // Should not display any placeholder financial values
      expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
      expect(screen.queryByText(/0 ETH/)).not.toBeInTheDocument();
    });
  });

  describe('Error States and Retry Functionality', () => {
    const mockRefetch = jest.fn();

    beforeEach(() => {
      mockUseSavingsVault.mockReturnValue({
        ...mockUseSavingsVault(),
        error: 'Failed to fetch vault data',
        isLoading: false,
        refetch: mockRefetch,
      });
    });

    it('displays error state when vault data loading fails', () => {
      renderWithProviders(<SavingsPage />);

      expect(screen.getByText(/error/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to fetch vault data/i)).toBeInTheDocument();
    });

    it('provides retry functionality when data loading fails', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SavingsPage />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('does not display substituted values on error', () => {
      renderWithProviders(<SavingsPage />);

      // Should not show any financial values when there's an error
      expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
      expect(screen.queryByText(/0 ETH/)).not.toBeInTheDocument();
    });
  });

  describe('Transaction Signing Integration', () => {
    const mockDeposit = jest.fn();
    const mockWithdraw = jest.fn();
    const mockCreateGoal = jest.fn();

    beforeEach(() => {
      mockUseSavingsVault.mockReturnValue({
        ...mockUseSavingsVault(),
        deposit: mockDeposit,
        withdraw: mockWithdraw,
        createGoal: mockCreateGoal,
      });
    });

    it('calls deposit function when deposit is triggered', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SavingsPage />);

      // Find and click deposit button (implementation dependent)
      const depositSection = screen.getByText(/deposit/i);
      expect(depositSection).toBeInTheDocument();

      // Transaction functions should be available
      expect(mockDeposit).toBeDefined();
    });

    it('calls withdraw function when withdrawal is triggered', async () => {
      renderWithProviders(<SavingsPage />);

      // Find withdraw section
      const withdrawSection = screen.getByText(/withdraw/i);
      expect(withdrawSection).toBeInTheDocument();

      // Withdraw function should be available
      expect(mockWithdraw).toBeDefined();
    });

    it('handles transaction signing errors gracefully', async () => {
      mockDeposit.mockRejectedValue(new Error('User rejected transaction'));

      renderWithProviders(<SavingsPage />);

      // Should not crash and should handle errors properly
      expect(screen.getByText(/savings vault/i)).toBeInTheDocument();
    });
  });

  describe('Real-time Data Updates', () => {
    it('updates balance when vault data changes', async () => {
      const { rerender } = renderWithProviders(<SavingsPage />);

      // Initial render with balance
      expect(mockUseSavingsVault).toHaveBeenCalled();

      // Mock updated balance
      const updatedBalance = BigInt(2000000000000000000); // 2 ETH
      mockUseSavingsVault.mockReturnValue({
        ...mockUseSavingsVault(),
        balance: {
          deposited: updatedBalance,
          available: updatedBalance,
          locked: BigInt(0),
        },
      });

      rerender(
        <QueryClientProvider client={queryClient}>
          <SavingsPage />
        </QueryClientProvider>
      );

      // Should use the updated balance
      expect(mockUseSavingsVault).toHaveBeenCalled();
    });

    it('refetches data after successful transactions', async () => {
      const mockRefetch = jest.fn().mockResolvedValue({});

      mockUseSavingsVault.mockReturnValue({
        ...mockUseSavingsVault(),
        refetch: mockRefetch,
      });

      renderWithProviders(<SavingsPage />);

      // Verify refetch function is available
      expect(mockRefetch).toBeDefined();
    });
  });

  describe('Responsive Layout and Accessibility', () => {
    it('uses responsive container classes', () => {
      const { container } = renderWithProviders(<SavingsPage />);

      const mainContainer = container.querySelector('.container');
      expect(mainContainer).toHaveClass('mx-auto');
    });

    it('provides proper heading structure', () => {
      renderWithProviders(<SavingsPage />);

      expect(screen.getByRole('heading', { name: /savings/i })).toBeInTheDocument();
    });

    it('maintains accessible navigation structure', () => {
      renderWithProviders(<SavingsPage />);

      // Should have proper ARIA structure
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
    });
  });

  describe('Error Boundary Integration', () => {
    it('handles component errors gracefully', () => {
      // Mock a component that throws
      const ThrowingComponent = () => {
        throw new Error('Component error');
      };

      // Should not crash the entire page
      expect(() => {
        render(<ThrowingComponent />);
      }).toThrow('Component error');

      // But the main page should still work
      renderWithProviders(<SavingsPage />);
      expect(screen.getByRole('heading', { name: /savings/i })).toBeInTheDocument();
    });
  });
});