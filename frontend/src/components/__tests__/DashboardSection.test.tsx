import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type Address, type Abi } from 'viem';

import { useContractRead } from '@/hooks/useContractRead';

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
  formatValue = (value) => String(value)
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
          <p>Error loading {title.toLowerCase()}: {error?.message || 'Unknown error'}</p>
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
      <div data-testid={`${title}-data`}>
        {formatValue(data)}
      </div>
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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Mock wagmi's usePublicClient hook
const mockUsePublicClient = jest.fn();
jest.mock('wagmi', () => ({
  usePublicClient: () => mockUsePublicClient(),
}));

// Mock public client
const mockPublicClient = {
  readContract: jest.fn(),
};

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
    jest.useFakeTimers();
    mockUsePublicClient.mockReturnValue(mockPublicClient);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  /**
   * Test Requirement 11.4: Display loading state during fetch without placeholder values
   */
  describe('Loading State (Req 11.4)', () => {
    it('displays loading state during data fetch without placeholder values', async () => {
      // Mock slow response to capture loading state
      mockPublicClient.readContract.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(1000n), 2000))
      );

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
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

      // Complete the request
      act(() => {
        jest.advanceTimersByTime(2500);
      });

      // Should eventually show data
      await waitFor(() => {
        expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
        expect(screen.getByText('1000 ETH')).toBeInTheDocument();
      });

      // Loading state should be gone
      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
    });

    it('maintains loading state during retries without showing placeholder values', async () => {
      let attemptCount = 0;
      mockPublicClient.readContract.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Network request failed'));
        }
        return Promise.resolve(1500n);
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Should show loading state during initial attempt - Req 11.4
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();

      // Advance through retry delays
      act(() => {
        jest.advanceTimersByTime(1000); // First retry
      });

      await waitFor(() => {
        expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      });

      // Still no placeholder values during retries - Req 11.4
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
      expect(screen.queryByText(/ETH/)).not.toBeInTheDocument();

      // Complete successful retry
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
        expect(screen.getByText('1500 ETH')).toBeInTheDocument();
      });
    });

    it('shows loading state for multiple concurrent sections independently', async () => {
      // Mock different response times for different sections
      mockPublicClient.readContract.mockImplementation((params) => {
        const delay = params.functionName === 'balanceOf' ? 1000 : 3000;
        return new Promise(resolve => 
          setTimeout(() => resolve(params.functionName === 'balanceOf' ? 1000n : 2000n), delay)
        );
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} title="Balance" functionName="balanceOf" />
          <DashboardSection {...testProps} title="Portfolio" functionName="portfolioValue" />
        </TestWrapper>
      );

      // Both should show loading initially - Req 11.4
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.getByTestId('Portfolio-loading')).toBeInTheDocument();

      // No placeholder values for either - Req 11.4
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Portfolio-data')).not.toBeInTheDocument();

      // Balance completes first
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
        expect(screen.getByText('1000 ETH')).toBeInTheDocument();
      });

      // Portfolio still loading - Req 11.4
      expect(screen.getByTestId('Portfolio-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('Portfolio-data')).not.toBeInTheDocument();

      // Portfolio completes
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('Portfolio-data')).toBeInTheDocument();
        expect(screen.getByText('2000 ETH')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test Requirement 11.5: Transition from loading to error state if fetch doesn't complete within 30 seconds
   * Note: This tests the behavior conceptually since the 30s timeout is handled by TanStack Query
   */
  describe('Error State Transition (Req 11.5)', () => {
    it('transitions from loading to error state when requests fail', async () => {
      // Mock a failing request to simulate what would happen after timeout
      mockPublicClient.readContract.mockRejectedValue(new Error('Request timeout'));

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Initially shows loading state - Req 11.4
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();

      // Should transition to error state when request fails - Req 11.5
      await waitFor(() => {
        expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
        expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
      });

      // Error state should be accessible
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
      expect(screen.getByRole('alert')).toHaveTextContent('Error loading balance: Request timeout');
    });

    it('applies timeout behavior per section independently', async () => {
      // Mock different behaviors for different sections  
      mockPublicClient.readContract.mockImplementation((params) => {
        if (params.functionName === 'balanceOf') {
          return Promise.resolve(1000n); // Succeeds quickly
        }
        // portfolioValue fails (simulating timeout)
        return Promise.reject(new Error('Request timeout'));
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} title="Balance" functionName="balanceOf" />
          <DashboardSection {...testProps} title="Portfolio" functionName="portfolioValue" />
        </TestWrapper>
      );

      await waitFor(() => {
        // Balance succeeds
        expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
        expect(screen.getByText('1000 ETH')).toBeInTheDocument();
        
        // Portfolio fails (timeout) - Req 11.5
        expect(screen.getByTestId('Portfolio-error')).toBeInTheDocument();
      });

      // Balance should remain successful
      expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
    });

    it('handles timeout-like behavior during retry attempts', async () => {
      let attemptCount = 0;
      mockPublicClient.readContract.mockImplementation(() => {
        attemptCount++;
        // Simulate repeated failures that would eventually timeout
        return Promise.reject(new Error('Network timeout'));
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Should eventually be in error state
      await waitFor(() => {
        expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
      });

      // Should have made multiple attempts through the retry mechanism
      expect(attemptCount).toBeGreaterThan(1);
    });
  });

  /**
   * Test Requirement 11.6: Display error state with retry action when fetch fails
   */
  describe('Error State with Retry Action (Req 11.6)', () => {
    it('displays error state with working retry button when fetch fails', async () => {
      const errorMessage = 'Network connection failed';
      mockPublicClient.readContract.mockRejectedValue(new Error(errorMessage));

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Wait for error state - Req 11.6
      await waitFor(() => {
        expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
      });

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
    });

    it('retry button actually re-initiates the section fetch', async () => {
      let shouldFail = true;
      mockPublicClient.readContract.mockImplementation(() => {
        if (shouldFail) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(2000n);
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Wait for initial error
      await waitFor(() => {
        expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
      });

      // Make next attempt succeed
      shouldFail = false;

      // Click retry button - Req 11.6
      const retryButton = screen.getByTestId('Balance-retry');
      fireEvent.click(retryButton);

      // Should go back to loading state
      await waitFor(() => {
        expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
      });

      // Should eventually show data from successful retry
      await waitFor(() => {
        expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
        expect(screen.getByText('2000 ETH')).toBeInTheDocument();
      });

      // Should verify readContract was called again
      expect(mockPublicClient.readContract).toHaveBeenCalledTimes(2);
    });

    it('never shows substituted values in error state', async () => {
      mockPublicClient.readContract.mockRejectedValue(new Error('Contract call failed'));

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
      });

      // Verify no financial values are displayed - Req 11.6
      expect(screen.queryByText(/\d+/)).not.toBeInTheDocument();
      expect(screen.queryByText(/ETH/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
      expect(screen.queryByText(/balance/i)).toBeInTheDocument(); // Only in error message
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();

      // Should only show error message and retry button
      const errorSection = screen.getByTestId('Balance-error');
      expect(errorSection).toHaveTextContent('Error loading balance: Contract call failed');
      expect(screen.getByTestId('Balance-retry')).toBeInTheDocument();
    });

    it('retry works after timeout errors', async () => {
      let shouldTimeout = true;
      mockPublicClient.readContract.mockImplementation(() => {
        if (shouldTimeout) {
          return new Promise(() => {}); // Never resolves (timeout)
        }
        return Promise.resolve(3000n);
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Wait for timeout error - Req 11.5
      act(() => {
        jest.advanceTimersByTime(31000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
      });

      // Make retry succeed
      shouldTimeout = false;

      // Click retry - Req 11.6
      const retryButton = screen.getByTestId('Balance-retry');
      fireEvent.click(retryButton);

      // Should succeed after retry
      await waitFor(() => {
        expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
        expect(screen.getByText('3000 ETH')).toBeInTheDocument();
      });
    });

    it('handles multiple retry attempts correctly', async () => {
      let failureCount = 0;
      mockPublicClient.readContract.mockImplementation(() => {
        failureCount++;
        if (failureCount <= 2) {
          return Promise.reject(new Error(`Failure ${failureCount}`));
        }
        return Promise.resolve(4000n);
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // First failure
      await waitFor(() => {
        expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
        expect(screen.getByText('Error loading balance: Failure 1')).toBeInTheDocument();
      });

      // First retry - should fail again
      fireEvent.click(screen.getByTestId('Balance-retry'));

      await waitFor(() => {
        expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
        expect(screen.getByText('Error loading balance: Failure 2')).toBeInTheDocument();
      });

      // Second retry - should succeed
      fireEvent.click(screen.getByTestId('Balance-retry'));

      await waitFor(() => {
        expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
        expect(screen.getByText('4000 ETH')).toBeInTheDocument();
      });

      expect(failureCount).toBe(3);
    });

    it('maintains error state independently across multiple sections', async () => {
      mockPublicClient.readContract.mockImplementation((params) => {
        if (params.functionName === 'balanceOf') {
          return Promise.reject(new Error('Balance fetch failed'));
        }
        return Promise.resolve(5000n); // Portfolio succeeds
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} title="Balance" functionName="balanceOf" />
          <DashboardSection {...testProps} title="Portfolio" functionName="portfolioValue" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
        expect(screen.getByTestId('Portfolio-data')).toBeInTheDocument();
      });

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
      mockPublicClient.readContract.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(6000n), 1000))
      );

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Initial: loading state
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();

      // Complete request
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      // Final: success state
      await waitFor(() => {
        expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
        expect(screen.getByText('6000 ETH')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
    });

    it('follows proper loading → error state transition', async () => {
      mockPublicClient.readContract.mockRejectedValue(new Error('Request failed'));

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Initial: loading state
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();

      // Final: error state
      await waitFor(() => {
        expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
      });

      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
    });

    it('follows proper error → loading → success state transition via retry', async () => {
      let shouldFail = true;
      mockPublicClient.readContract.mockImplementation(() => {
        if (shouldFail) {
          return Promise.reject(new Error('Initial failure'));
        }
        return Promise.resolve(7000n);
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Initial failure → error state
      await waitFor(() => {
        expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
      });

      // Enable success for retry
      shouldFail = false;

      // Retry → loading state
      fireEvent.click(screen.getByTestId('Balance-retry'));

      await waitFor(() => {
        expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();

      // Success → data state
      await waitFor(() => {
        expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
        expect(screen.getByText('7000 ETH')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
    });

    it('has proper accessibility attributes in all states', async () => {
      let callCount = 0;
      mockPublicClient.readContract.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: simulate loading then timeout
          return new Promise(() => {});
        } else if (callCount === 2) {
          // Retry: fail with error
          return Promise.reject(new Error('Retry failed'));
        } else {
          // Second retry: succeed
          return Promise.resolve(8000n);
        }
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Loading state accessibility
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');

      // Timeout to error state
      act(() => {
        jest.advanceTimersByTime(31000);
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Error state accessibility
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
      expect(screen.getByTestId('Balance-retry')).toHaveAttribute('aria-label', 'Retry loading balance');

      // Retry fails → error state
      fireEvent.click(screen.getByTestId('Balance-retry'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Error loading balance: Retry failed');
      });

      // Second retry succeeds → data state
      fireEvent.click(screen.getByTestId('Balance-retry'));

      await waitFor(() => {
        expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
      });

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
      mockPublicClient.readContract.mockResolvedValue(9000n);

      render(
        <TestWrapper>
          <DashboardSection {...testProps} enabled={false} />
        </TestWrapper>
      );

      // Should not show loading, error, or data when disabled
      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();

      // Should still show the section structure but no content
      expect(screen.getByTestId('Balance-section')).toBeInTheDocument();
      expect(screen.getByText('Balance')).toBeInTheDocument();
    });

    it('does not make contract calls when disabled', () => {
      render(
        <TestWrapper>
          <DashboardSection {...testProps} enabled={false} />
        </TestWrapper>
      );

      // Wait to ensure no calls are made
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockPublicClient.readContract).not.toHaveBeenCalled();
    });

    it('can be enabled and disabled dynamically', async () => {
      mockPublicClient.readContract.mockResolvedValue(10000n);
      
      const { rerender } = render(
        <TestWrapper>
          <DashboardSection {...testProps} enabled={false} />
        </TestWrapper>
      );

      // Initially disabled
      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(mockPublicClient.readContract).not.toHaveBeenCalled();

      // Enable
      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} enabled={true} />
        </TestWrapper>
      );

      // Should start loading
      await waitFor(() => {
        expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      });

      // Should complete successfully
      await waitFor(() => {
        expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
        expect(screen.getByText('10000 ETH')).toBeInTheDocument();
      });

      expect(mockPublicClient.readContract).toHaveBeenCalledTimes(1);
    });
  });
});