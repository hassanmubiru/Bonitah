/**
 * Component tests for RecentTransactions component
 * 
 * Tests cover:
 * - Data-source wiring to backend transactions API
 * - Loading/error/retry rendering for transaction history
 * - Transaction display formatting and ordering
 * - Maximum 50 transactions display (Requirement 11.2)
 * 
 * Validates Requirements: 11.2, 11.4, 15.5
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import '@testing-library/jest-dom';

import { RecentTransactions } from '../RecentTransactions';

// Mock React Query
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('RecentTransactions Component Tests', () => {
  let queryClient: QueryClient;
  const testAddress = '0x1234567890123456789012345678901234567890' as `0x${string}`;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Default mock - successful API response with transactions
    mockUseQuery.mockReturnValue({
      data: {
        transactions: [
          {
            id: 'tx-1',
            hash: '0xabc123',
            type: 'deposit',
            amount: '1000000000000000000', // 1 ETH in wei
            timestamp: '2024-01-02T12:00:00Z',
            status: 'confirmed',
            fromAddress: testAddress,
            toAddress: '0xdef456',
          },
          {
            id: 'tx-2',
            hash: '0xdef456',
            type: 'withdrawal',
            amount: '500000000000000000', // 0.5 ETH in wei
            timestamp: '2024-01-01T10:00:00Z',
            status: 'confirmed',
            fromAddress: '0xdef456',
            toAddress: testAddress,
          },
        ],
        total: 2,
        page: 1,
        hasMore: false,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isSuccess: true,
    } as any);
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  describe('Data Source Wiring - Backend API', () => {
    it('fetches transaction data from backend API', () => {
      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      expect(mockUseQuery).toHaveBeenCalledWith({
        queryKey: ['transactions', testAddress],
        queryFn: expect.any(Function),
        enabled: true,
      });
    });

    it('displays transaction data from API response', async () => {
      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      await waitFor(() => {
        expect(screen.getByText(/recent activity/i)).toBeInTheDocument();
      });

      // Should display transactions from API
      expect(screen.getByText('Deposit')).toBeInTheDocument();
      expect(screen.getByText('Withdrawal')).toBeInTheDocument();
      expect(screen.getByText('1.0 ETH')).toBeInTheDocument();
      expect(screen.getByText('0.5 ETH')).toBeInTheDocument();
    });

    it('displays transactions ordered by most recent first (Requirement 11.2)', () => {
      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      const transactionElements = screen.getAllByTestId(/transaction-item/);
      
      // First element should be the more recent transaction (2024-01-02)
      expect(transactionElements[0]).toHaveTextContent('Deposit');
      // Second element should be the older transaction (2024-01-01)
      expect(transactionElements[1]).toHaveTextContent('Withdrawal');
    });

    it('handles maximum 50 transactions limit (Requirement 11.2)', () => {
      // Mock API response with 50+ transactions
      const transactions = Array.from({ length: 60 }, (_, i) => ({
        id: `tx-${i}`,
        hash: `0x${i.toString().padStart(6, '0')}`,
        type: 'deposit',
        amount: '1000000000000000000',
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
        status: 'confirmed',
        fromAddress: testAddress,
        toAddress: '0xdef456',
      }));

      mockUseQuery.mockReturnValue({
        data: {
          transactions: transactions.slice(0, 50), // API should return max 50
          total: 60,
          page: 1,
          hasMore: true,
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        isSuccess: true,
      } as any);

      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      // Should display exactly 50 transactions
      const transactionElements = screen.getAllByTestId(/transaction-item/);
      expect(transactionElements).toHaveLength(50);
    });
  });

  describe('Loading States - Requirement 11.4', () => {
    it('displays loading state while fetching transactions', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
        isSuccess: false,
      } as any);

      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('does not display placeholder transaction data during loading', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
        isSuccess: false,
      } as any);

      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      // Should not display any transaction items during loading
      expect(screen.queryByTestId(/transaction-item/)).not.toBeInTheDocument();
      expect(screen.queryByText(/0 ETH/)).not.toBeInTheDocument();
      expect(screen.queryByText(/pending/)).not.toBeInTheDocument();
    });

    it('shows loading skeleton for transaction list', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
        isSuccess: false,
      } as any);

      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      expect(screen.getByTestId('transactions-loading')).toBeInTheDocument();
    });
  });

  describe('Error States and Retry Functionality', () => {
    const mockRefetch = jest.fn();

    it('displays error state when API call fails', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Failed to fetch transactions'),
        refetch: mockRefetch,
        isSuccess: false,
      } as any);

      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      expect(screen.getByText(/error/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to fetch transactions/i)).toBeInTheDocument();
    });

    it('provides retry functionality when API fails', async () => {
      const user = userEvent.setup();
      
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network timeout'),
        refetch: mockRefetch,
        isSuccess: false,
      } as any);

      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('does not display substituted transaction data on error', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('API error'),
        refetch: jest.fn(),
        isSuccess: false,
      } as any);

      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      // Should not show placeholder transactions
      expect(screen.queryByTestId(/transaction-item/)).not.toBeInTheDocument();
      expect(screen.queryByText(/no transactions/i)).not.toBeInTheDocument();
    });

    it('handles network errors gracefully', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network error: Unable to reach server'),
        refetch: jest.fn(),
        isSuccess: false,
      } as any);

      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  describe('Empty State Handling', () => {
    it('displays empty state when no transactions exist', () => {
      mockUseQuery.mockReturnValue({
        data: {
          transactions: [],
          total: 0,
          page: 1,
          hasMore: false,
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        isSuccess: true,
      } as any);

      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      expect(screen.getByText(/no recent transactions/i)).toBeInTheDocument();
    });

    it('provides helpful message for empty transaction history', () => {
      mockUseQuery.mockReturnValue({
        data: {
          transactions: [],
          total: 0,
          page: 1,
          hasMore: false,
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        isSuccess: true,
      } as any);

      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      expect(screen.getByText(/start making deposits/i)).toBeInTheDocument();
    });
  });

  describe('Transaction Data Formatting', () => {
    it('formats transaction amounts correctly', () => {
      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      expect(screen.getByText('1.0 ETH')).toBeInTheDocument();
      expect(screen.getByText('0.5 ETH')).toBeInTheDocument();
    });

    it('displays transaction hashes in shortened format', () => {
      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      expect(screen.getByText('0xabc1...')).toBeInTheDocument();
      expect(screen.getByText('0xdef4...')).toBeInTheDocument();
    });

    it('formats timestamps in human-readable format', () => {
      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      // Should display relative or formatted dates
      expect(screen.getByText(/jan/i) || screen.getByText(/ago/i)).toBeInTheDocument();
    });

    it('displays transaction status correctly', () => {
      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      expect(screen.getAllByText(/confirmed/i)).toHaveLength(2);
    });
  });

  describe('Real-time Updates', () => {
    it('updates transaction list when new data is available', async () => {
      const { rerender } = renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      // Initial state - 2 transactions
      expect(screen.getAllByTestId(/transaction-item/)).toHaveLength(2);

      // Add new transaction to mock
      mockUseQuery.mockReturnValue({
        data: {
          transactions: [
            {
              id: 'tx-3',
              hash: '0x789abc',
              type: 'goal_contribution',
              amount: '250000000000000000', // 0.25 ETH
              timestamp: '2024-01-03T15:00:00Z',
              status: 'confirmed',
              fromAddress: testAddress,
              toAddress: '0xgoal123',
            },
            ...mockUseQuery().data.transactions,
          ],
          total: 3,
          page: 1,
          hasMore: false,
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        isSuccess: true,
      } as any);

      rerender(
        <QueryClientProvider client={queryClient}>
          <RecentTransactions userAddress={testAddress} />
        </QueryClientProvider>
      );

      // Should now display 3 transactions
      await waitFor(() => {
        expect(screen.getAllByTestId(/transaction-item/)).toHaveLength(3);
      });

      expect(screen.getByText('Goal Contribution')).toBeInTheDocument();
      expect(screen.getByText('0.25 ETH')).toBeInTheDocument();
    });

    it('refetches data on user interaction', async () => {
      const mockRefetch = jest.fn().mockResolvedValue({});
      
      mockUseQuery.mockReturnValue({
        data: {
          transactions: [],
          total: 0,
          page: 1,
          hasMore: false,
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        isSuccess: true,
      } as any);

      const user = userEvent.setup();
      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Component Integration', () => {
    it('handles different user addresses correctly', () => {
      const differentAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef' as `0x${string}`;
      
      const { rerender } = renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['transactions', testAddress],
        })
      );

      rerender(
        <QueryClientProvider client={queryClient}>
          <RecentTransactions userAddress={differentAddress} />
        </QueryClientProvider>
      );

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['transactions', differentAddress],
        })
      );
    });

    it('integrates with authentication context', () => {
      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      // Should only fetch transactions when address is provided
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
        })
      );
    });

    it('handles pagination correctly when available', () => {
      mockUseQuery.mockReturnValue({
        data: {
          transactions: Array.from({ length: 20 }, (_, i) => ({
            id: `tx-${i}`,
            hash: `0x${i.toString().padStart(6, '0')}`,
            type: 'deposit',
            amount: '1000000000000000000',
            timestamp: new Date().toISOString(),
            status: 'confirmed',
            fromAddress: testAddress,
            toAddress: '0xdef456',
          })),
          total: 50,
          page: 1,
          hasMore: true,
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        isSuccess: true,
      } as any);

      renderWithProviders(<RecentTransactions userAddress={testAddress} />);

      // Should indicate more transactions are available
      expect(screen.getByText(/view all transactions/i)).toBeInTheDocument();
    });
  });
});