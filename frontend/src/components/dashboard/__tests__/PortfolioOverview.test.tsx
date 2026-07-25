/**
 * Component tests for PortfolioOverview component
 * 
 * Tests cover:
 * - Data-source wiring from SavingsVault contract
 * - Loading/error/retry rendering for portfolio data
 * - Real financial data display without mocked values
 * 
 * Validates Requirements: 11.1, 11.3, 11.4
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

import { PortfolioOverview } from '../PortfolioOverview';

// Mock contract read hooks
jest.mock('@/hooks/useContractRead', () => ({
  useContractRead: jest.fn(),
  usePortfolioValue: jest.fn(),
  useContractBalance: jest.fn(),
}));

// Mock shared package
jest.mock('@bfn/shared', () => ({
  getContractAddress: jest.fn().mockReturnValue('0x1234567890123456789012345678901234567890'),
  getContractAbi: jest.fn().mockReturnValue([]),
  BASE_SEPOLIA_CHAIN_ID: 84532,
}));

import { useContractRead, usePortfolioValue } from '@/hooks/useContractRead';

const mockUseContractRead = useContractRead as jest.MockedFunction<typeof useContractRead>;
const mockUsePortfolioValue = usePortfolioValue as jest.MockedFunction<typeof usePortfolioValue>;

describe('PortfolioOverview Component Tests', () => {
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

    // Default mock - successful data loading
    mockUsePortfolioValue.mockReturnValue({
      data: BigInt(2500000000000000000), // 2.5 ETH in wei
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseContractRead.mockReturnValue({
      data: BigInt(1000000000000000000), // 1 ETH in wei
      isLoading: false,
      isError: false,
      error: null,
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

  describe('Data Source Wiring - Requirements 11.1, 11.3', () => {
    it('calls portfolio value hook with correct address', () => {
      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      expect(mockUsePortfolioValue).toHaveBeenCalledWith(testAddress);
    });

    it('calls contract read hooks for balance data', () => {
      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      expect(mockUseContractRead).toHaveBeenCalled();
    });

    it('displays portfolio value from contract data', async () => {
      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      await waitFor(() => {
        expect(screen.getByText(/portfolio/i)).toBeInTheDocument();
      });

      // Should display value derived from contract (not mocked/hardcoded)
      expect(screen.getByText(/2\.5/)).toBeInTheDocument(); // 2.5 ETH
    });

    it('displays savings balance from contract data', async () => {
      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      await waitFor(() => {
        expect(screen.getByText(/savings/i)).toBeInTheDocument();
      });

      // Should display balance from contract
      expect(screen.getByText(/1\.0/)).toBeInTheDocument(); // 1 ETH
    });

    it('does not display mocked or hardcoded values', () => {
      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      // Should not show common placeholder values
      expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
      expect(screen.queryByText(/0\.00/)).not.toBeInTheDocument();
      expect(screen.queryByText(/mock/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
    });
  });

  describe('Loading States - Requirement 11.4', () => {
    it('displays loading state while fetching portfolio data', () => {
      mockUsePortfolioValue.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('displays loading state while fetching balance data', () => {
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('does not display placeholder financial values during loading', () => {
      mockUsePortfolioValue.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      // Should not display any financial values during loading
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
      expect(screen.queryByText(/ETH/)).not.toBeInTheDocument();
      expect(screen.queryByText(/0/)).not.toBeInTheDocument();
    });

    it('shows loading skeleton for specific data sections', () => {
      mockUsePortfolioValue.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      // Should show loading indicators for specific sections
      expect(screen.getByTestId('portfolio-loading')).toBeInTheDocument();
    });
  });

  describe('Error States and Retry Functionality', () => {
    const mockRefetch = jest.fn();

    it('displays error state when portfolio data fails to load', () => {
      mockUsePortfolioValue.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Failed to fetch portfolio value'),
        refetch: mockRefetch,
      });

      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      expect(screen.getByText(/error/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to fetch portfolio value/i)).toBeInTheDocument();
    });

    it('displays error state when balance data fails to load', () => {
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Contract read failed'),
        refetch: mockRefetch,
      });

      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      expect(screen.getByText(/contract read failed/i)).toBeInTheDocument();
    });

    it('provides retry functionality when data loading fails', async () => {
      const user = userEvent.setup();
      
      mockUsePortfolioValue.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network timeout'),
        refetch: mockRefetch,
      });

      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('does not display substituted values on error', () => {
      mockUsePortfolioValue.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        refetch: jest.fn(),
      });

      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      // Should not show placeholder or estimated values
      expect(screen.queryByText(/estimate/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/approximate/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
    });

    it('shows error state for specific failed sections only', () => {
      // Portfolio loads successfully
      mockUsePortfolioValue.mockReturnValue({
        data: BigInt(2500000000000000000),
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      // But balance fails to load
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Balance fetch failed'),
        refetch: mockRefetch,
      });

      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      // Should show portfolio value (successful)
      expect(screen.getByText(/2\.5/)).toBeInTheDocument();
      
      // Should show error only for balance section
      expect(screen.getByText(/balance fetch failed/i)).toBeInTheDocument();
    });
  });

  describe('Contract Data Formatting', () => {
    it('formats BigInt portfolio value correctly', () => {
      mockUsePortfolioValue.mockReturnValue({
        data: BigInt(1500000000000000000), // 1.5 ETH
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      expect(screen.getByText(/1\.5/)).toBeInTheDocument();
    });

    it('handles zero portfolio value correctly', () => {
      mockUsePortfolioValue.mockReturnValue({
        data: BigInt(0),
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      expect(screen.getByText(/0/)).toBeInTheDocument();
    });

    it('handles large portfolio values correctly', () => {
      mockUsePortfolioValue.mockReturnValue({
        data: BigInt(100000000000000000000), // 100 ETH
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      expect(screen.getByText(/100/)).toBeInTheDocument();
    });
  });

  describe('Real-time Data Updates', () => {
    it('updates display when contract data changes', async () => {
      const { rerender } = renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      // Initial value
      expect(screen.getByText(/2\.5/)).toBeInTheDocument();

      // Update mock to return new value
      mockUsePortfolioValue.mockReturnValue({
        data: BigInt(5000000000000000000), // 5 ETH
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      rerender(
        <QueryClientProvider client={queryClient}>
          <PortfolioOverview userAddress={testAddress} />
        </QueryClientProvider>
      );

      // Should display updated value
      await waitFor(() => {
        expect(screen.getByText(/5/)).toBeInTheDocument();
      });
    });

    it('handles rapid data updates without errors', async () => {
      const { rerender } = renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      // Simulate rapid updates
      const values = [
        BigInt(1000000000000000000),  // 1 ETH
        BigInt(2000000000000000000),  // 2 ETH
        BigInt(3000000000000000000),  // 3 ETH
      ];

      for (const value of values) {
        mockUsePortfolioValue.mockReturnValue({
          data: value,
          isLoading: false,
          isError: false,
          error: null,
          refetch: jest.fn(),
        });

        rerender(
          <QueryClientProvider client={queryClient}>
            <PortfolioOverview userAddress={testAddress} />
          </QueryClientProvider>
        );
      }

      // Should display the final value
      expect(screen.getByText(/3/)).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('integrates properly with TanStack Query', () => {
      renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      // Component should render without throwing query errors
      expect(screen.getByText(/portfolio/i)).toBeInTheDocument();
    });

    it('handles different user addresses correctly', () => {
      const differentAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef' as `0x${string}`;
      
      const { rerender } = renderWithProviders(<PortfolioOverview userAddress={testAddress} />);

      expect(mockUsePortfolioValue).toHaveBeenCalledWith(testAddress);

      // Change address
      rerender(
        <QueryClientProvider client={queryClient}>
          <PortfolioOverview userAddress={differentAddress} />
        </QueryClientProvider>
      );

      expect(mockUsePortfolioValue).toHaveBeenCalledWith(differentAddress);
    });
  });
});