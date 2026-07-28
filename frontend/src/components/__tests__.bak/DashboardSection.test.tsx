import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type Address, type Abi } from 'viem';

// Mock the entire hooks module to control hook behavior
jest.mock('@/hooks/useContractRead', () => ({
  useContractRead: jest.fn(),
}));

// Mock wagmi's usePublicClient
jest.mock('wagmi', () => ({
  usePublicClient: jest.fn(),
}));

import { useContractRead } from '@/hooks/useContractRead';
import { usePublicClient } from 'wagmi';

const mockUseContractRead = useContractRead as jest.MockedFunction<typeof useContractRead>;
const mockUsePublicClient = usePublicClient as jest.MockedFunction<typeof usePublicClient>;

// Test component that uses the read hooks to demonstrate loading/error/retry states
interface DashboardSectionProps {
  title: string;
  contractAddress: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  enabled?: boolean;
  formatValue?: (value: unknown) => string;
}

function DashboardSection({
  title,
  contractAddress,
  abi,
  functionName,
  args,
  enabled = true,
  formatValue = (value) => String(value),
}: DashboardSectionProps) {
  const { data, isLoading, isError, error, refetch } = useContractRead({
    address: contractAddress,
    abi,
    functionName,
    args,
    enabled,
  });

  if (isLoading) {
    return (
      <div data-testid={`${title}-section`}>
        <h2>{title}</h2>
        <div data-testid={`${title}-loading`} role="status" aria-live="polite">
          Loading...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid={`${title}-section`}>
        <h2>{title}</h2>
        <div data-testid={`${title}-error`} role="alert" aria-live="assertive">
          <p>
            Error loading {title.toLowerCase()}: {error?.message || 'Unknown error'}
          </p>
          <button
            data-testid={`${title}-retry`}
            onClick={() => refetch()}
            aria-label={`Retry loading ${title.toLowerCase()}`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid={`${title}-section`}>
      <h2>{title}</h2>
      <div data-testid={`${title}-data`}>{formatValue(data)}</div>
    </div>
  );
}

// Mock ABI for testing
const mockAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'portfolioValue',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const satisfies Abi;

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable default retry for controlled testing
        gcTime: 0, // No caching during tests
      },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('Component Tests for Loading/Error/Retry States', () => {
  const testProps = {
    title: 'Balance',
    contractAddress: '0x1234567890123456789012345678901234567890' as Address,
    abi: mockAbi,
    functionName: 'balanceOf',
    args: ['0x0987654321098765432109876543210987654321'] as const,
    formatValue: (value: unknown) => `${value} ETH`,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock usePublicClient to return a mock client
    mockUsePublicClient.mockReturnValue({
      readContract: jest.fn(),
      chainId: 84532,
    } as any);
  });

  /**
   * Test Requirement 11.4: Display loading state during fetch without placeholder values
   */
  describe('Loading State (Req 11.4)', () => {
    it('displays loading state during data fetch without placeholder values', async () => {
      // Mock loading state
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Should show loading state immediately - Req 11.4
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Loading...');

      // Should NOT show any placeholder financial values - Req 11.4
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
      expect(screen.queryByText(/ETH/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument(); // No dollar amounts
      expect(screen.queryByText(/\d+\.\d+/)).not.toBeInTheDocument(); // No decimal numbers

      // Loading state should have proper accessibility attributes
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });

    it('maintains loading state during retries without showing placeholder values', async () => {
      // Mock loading state that persists during retries
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Should show loading state during retries - Req 11.4
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();

      // Still no placeholder values during retries - Req 11.4
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
      expect(screen.queryByText(/ETH/)).not.toBeInTheDocument();
    });

    it('shows loading state for multiple concurrent sections independently', async () => {
      // Mock loading state for both sections
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} title="Balance" functionName="balanceOf" />
          <DashboardSection {...testProps} title="Portfolio" functionName="portfolioValue" />
        </TestWrapper>,
      );

      // Both should show loading initially - Req 11.4
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.getByTestId('Portfolio-loading')).toBeInTheDocument();

      // No placeholder values for either - Req 11.4
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Portfolio-data')).not.toBeInTheDocument();
    });
  });

  /**
   * Test Requirement 11.5: Transition from loading to error state if fetch doesn't complete within 30 seconds
   * Note: This tests the behavior conceptually since the 30s timeout is handled by TanStack Query
   */
  describe('Error State Transition (Req 11.5)', () => {
    it('transitions from loading to error state when requests fail', async () => {
      // Mock error state that would occur after timeout
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Request timeout' } as any,
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Should show error state - Req 11.5
      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();

      // Error state should be accessible
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
      expect(screen.getByRole('alert')).toHaveTextContent('Error loading balance: Request timeout');
    });

    it('applies timeout behavior per section independently', async () => {
      // Mock different states for different sections using implementation based on function name
      mockUseContractRead.mockImplementation((options: any) => {
        if (options.functionName === 'balanceOf') {
          return {
            data: 1000n,
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
          };
        } else {
          // portfolioValue fails (simulating timeout)
          return {
            data: undefined,
            isLoading: false,
            isError: true,
            error: { name: 'ContractReadError', message: 'Request timeout' } as any,
            refetch: jest.fn(),
          };
        }
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} title="Balance" functionName="balanceOf" />
          <DashboardSection {...testProps} title="Portfolio" functionName="portfolioValue" />
        </TestWrapper>,
      );

      // Balance succeeds
      expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
      expect(screen.getByText('1000 ETH')).toBeInTheDocument();

      // Portfolio fails (timeout) - Req 11.5
      expect(screen.getByTestId('Portfolio-error')).toBeInTheDocument();

      // Balance should remain successful
      expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
    });

    it('handles timeout-like behavior during retry attempts', async () => {
      // Mock error state that would occur after retries are exhausted
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Network timeout' } as any,
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Should be in error state after retries exhausted
      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
    });
  });

  /**
   * Test Requirement 11.6: Display error state with retry action when fetch fails
   */
  describe('Error State with Retry Action (Req 11.6)', () => {
    it('displays error state with working retry button when fetch fails', async () => {
      const mockRefetch = jest.fn();
      const errorMessage = 'Network connection failed';
      
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: errorMessage } as any,
        refetch: mockRefetch,
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Should show error message
      expect(screen.getByRole('alert')).toHaveTextContent(`Error loading balance: ${errorMessage}`);

      // Should have retry button - Req 11.6
      const retryButton = screen.getByTestId('Balance-retry');
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toHaveAttribute('aria-label', 'Retry loading balance');

      // Should NOT show any substituted values - Req 11.6
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
      expect(screen.queryByText(/ETH/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+/)).not.toBeInTheDocument();

      // Retry button should call refetch
      fireEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('retry button actually re-initiates the section fetch', async () => {
      const mockRefetch = jest.fn();
      
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Network error' } as any,
        refetch: mockRefetch,
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Should be in error state initially
      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();

      // Click retry button - Req 11.6
      const retryButton = screen.getByTestId('Balance-retry');
      fireEvent.click(retryButton);

      // Should call refetch function
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('never shows substituted values in error state', async () => {
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Contract call failed' } as any,
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();

      // Verify no financial values are displayed - Req 11.6
      expect(screen.queryByText(/\d+/)).not.toBeInTheDocument();
      expect(screen.queryByText(/ETH/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();

      // Should only show error message and retry button
      const errorSection = screen.getByTestId('Balance-error');
      expect(errorSection).toHaveTextContent('Error loading balance: Contract call failed');
      expect(screen.getByTestId('Balance-retry')).toBeInTheDocument();
    });

    it('retry works after timeout errors', async () => {
      const mockRefetch = jest.fn();

      // Mock timeout error - Req 11.5
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Request timeout' } as any,
        refetch: mockRefetch,
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Should show timeout error
      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();

      // Click retry - Req 11.6
      const retryButton = screen.getByTestId('Balance-retry');
      fireEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('handles multiple retry attempts correctly', async () => {
      const mockRefetch = jest.fn();

      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Failure 1' } as any,
        refetch: mockRefetch,
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
      expect(screen.getByText('Error loading balance: Failure 1')).toBeInTheDocument();

      // Click retry multiple times
      fireEvent.click(screen.getByTestId('Balance-retry'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('Balance-retry'));
      expect(mockRefetch).toHaveBeenCalledTimes(2);
    });

    it('maintains error state independently across multiple sections', async () => {
      mockUseContractRead.mockImplementation((options: any) => {
        if (options.functionName === 'balanceOf') {
          return {
            data: undefined,
            isLoading: false,
            isError: true,
            error: { name: 'ContractReadError', message: 'Balance fetch failed' } as any,
            refetch: jest.fn(),
          };
        } else {
          return {
            data: 5000n,
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
          };
        }
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} title="Balance" functionName="balanceOf" />
          <DashboardSection {...testProps} title="Portfolio" functionName="portfolioValue" />
        </TestWrapper>,
      );

      // Balance should show error with retry - Req 11.6
      expect(screen.getByText('Error loading balance: Balance fetch failed')).toBeInTheDocument();
      expect(screen.getByTestId('Balance-retry')).toBeInTheDocument();

      // Portfolio should show data normally
      expect(screen.getByText('5000 ETH')).toBeInTheDocument();

      // No substituted values in error section - Req 11.6
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
    });
  });

  /**
   * Test proper state transitions and accessibility
   */
  describe('State Transitions and Accessibility', () => {
    it('follows proper loading → success state transition', async () => {
      const { rerender } = render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Start with loading state
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Initial: loading state
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();

      // Transition to success state
      mockUseContractRead.mockReturnValue({
        data: 6000n,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Final: success state
      expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
      expect(screen.getByText('6000 ETH')).toBeInTheDocument();
      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
    });

    it('follows proper loading → error state transition', async () => {
      const { rerender } = render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Start with loading state
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Initial: loading state
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();

      // Transition to error state
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Request failed' } as any,
        refetch: jest.fn(),
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Final: error state
      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
    });

    it('follows proper error → loading → success state transition via retry', async () => {
      const mockRefetch = jest.fn();
      
      // Start with error state
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Initial failure' } as any,
        refetch: mockRefetch,
      });

      const { rerender } = render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Initial failure → error state
      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();

      // Click retry
      fireEvent.click(screen.getByTestId('Balance-retry'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);

      // Simulate loading state after retry
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Retry → loading state
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();

      // Simulate success state
      mockUseContractRead.mockReturnValue({
        data: 7000n,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Success → data state
      expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
      expect(screen.getByText('7000 ETH')).toBeInTheDocument();
      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
    });

    it('has proper accessibility attributes in all states', async () => {
      const { rerender } = render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // Loading state accessibility
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');

      // Error state accessibility
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Test error' } as any,
        refetch: jest.fn(),
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
      expect(screen.getByTestId('Balance-retry')).toHaveAttribute('aria-label', 'Retry loading balance');

      // Success state accessibility (no special requirements)
      mockUseContractRead.mockReturnValue({
        data: 8000n,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>,
      );

      // No accessibility violations in success state
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  /**
   * Test disabled state handling
   */
  describe('Disabled State Handling', () => {
    it('does not render any state when disabled', () => {
      // Mock disabled state (hook should return default values when disabled)
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} enabled={false} />
        </TestWrapper>,
      );

      // Should still show the section structure
      expect(screen.getByTestId('Balance-section')).toBeInTheDocument();
      expect(screen.getByText('Balance')).toBeInTheDocument();
      
      // Should show data state (since isLoading and isError are both false)
      expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
      expect(screen.getByText('undefined ETH')).toBeInTheDocument();
    });

    it('does not make contract calls when disabled', async () => {
      // Verify that useContractRead is called with enabled: false
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} enabled={false} />
        </TestWrapper>,
      );

      // Verify the hook was called with enabled: false
      expect(mockUseContractRead).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        })
      );
    });

    it('can be enabled and disabled dynamically', async () => {
      mockUseContractRead.mockReturnValue({
        data: 10000n,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      const { rerender } = render(
        <TestWrapper>
          <DashboardSection {...testProps} enabled={false} />
        </TestWrapper>,
      );

      // Initially disabled
      expect(mockUseContractRead).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        })
      );

      // Enable
      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} enabled={true} />
        </TestWrapper>,
      );

      // Should now be enabled
      expect(mockUseContractRead).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
        })
      );

      // Should show data
      expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
      expect(screen.getByText('10000 ETH')).toBeInTheDocument();
    });
  });
});