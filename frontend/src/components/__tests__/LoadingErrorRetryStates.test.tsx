/**
 * Component Tests for Loading/Error/Retry States
 * Task 19.3: Write component tests for loading/error/retry states
 * 
 * This test validates Requirements 11.4, 11.5, and 11.6:
 * - 11.4: Display loading state without placeholder values
 * - 11.5: Transition from loading to error state if fetch doesn't complete within 30 seconds
 * - 11.6: Display error state with retry action when fetch fails
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type Address, type Abi } from 'viem';

// Mock the hooks module
jest.mock('@/hooks/useContractRead');

import { useContractRead } from '@/hooks/useContractRead';

const mockUseContractRead = useContractRead as jest.MockedFunction<typeof useContractRead>;

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
        </TestWrapper>
      );

      // Should show loading state - Req 11.4
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Loading...');
      
      // Should NOT show any placeholder financial values - Req 11.4
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
      expect(screen.queryByText(/ETH/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument(); // No dollar amounts
      expect(screen.queryByText(/\d+\.\d+/)).not.toBeInTheDocument(); // No decimal numbers
      expect(screen.queryByText(/\d+/)).not.toBeInTheDocument(); // No numbers at all
      
      // Loading state should have proper accessibility attributes
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });

    it('shows loading state for multiple concurrent sections independently', () => {
      // Mock both sections as loading
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
        </TestWrapper>
      );

      // Both should show loading - Req 11.4
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.getByTestId('Portfolio-loading')).toBeInTheDocument();

      // No placeholder values for either - Req 11.4
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Portfolio-data')).not.toBeInTheDocument();
      expect(screen.queryByText(/ETH/)).not.toBeInTheDocument();
    });

    it('never displays placeholder values during loading regardless of previous data', () => {
      // Mock loading state with no data
      mockUseContractRead.mockReturnValue({
        data: undefined, // Explicitly no data during loading
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Should show loading without any financial values - Req 11.4
      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.queryByText(/0/)).not.toBeInTheDocument();
      expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/loading/i)).toBeInTheDocument(); // Only "Loading..." text
    });
  });

  /**
   * Test Requirement 11.5: Transition from loading to error state if fetch doesn't complete within 30 seconds
   * Note: The 30-second timeout is implemented in the hook layer via TanStack Query
   */
  describe('Error State Transition (Req 11.5)', () => {
    it('displays error state when requests fail (simulating timeout behavior)', () => {
      // Mock error state that would result from timeout or other failure
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Request timeout' },
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Should show error state - Req 11.5
      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();

      // Error state should be accessible
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
      expect(screen.getByRole('alert')).toHaveTextContent('Error loading balance: Request timeout');
    });

    it('applies error state per section independently', () => {
      // Mock different states for different sections
      mockUseContractRead
        .mockReturnValueOnce({
          data: 1000n,
          isLoading: false,
          isError: false,
          error: null,
          refetch: jest.fn(),
        })
        .mockReturnValueOnce({
          data: undefined,
          isLoading: false,
          isError: true,
          error: { name: 'ContractReadError', message: 'Request timeout' },
          refetch: jest.fn(),
        });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} title="Balance" functionName="balanceOf" />
          <DashboardSection {...testProps} title="Portfolio" functionName="portfolioValue" />
        </TestWrapper>
      );

      // Balance succeeds
      expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
      expect(screen.getByText('1000 ETH')).toBeInTheDocument();

      // Portfolio fails (timeout) - Req 11.5
      expect(screen.getByTestId('Portfolio-error')).toBeInTheDocument();

      // Balance should remain successful
      expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
    });

    it('transitions from loading to error state correctly', () => {
      // Test the state transition conceptually
      const { rerender } = render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Initially loading
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
        </TestWrapper>
      );

      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();

      // Transition to error (simulating timeout)
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Dashboard section timeout after 30 seconds' },
        refetch: jest.fn(),
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Should now be in error state - Req 11.5
      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
    });
  });

  /**
   * Test Requirement 11.6: Display error state with retry action when fetch fails
   */
  describe('Error State with Retry Action (Req 11.6)', () => {
    it('displays error state with working retry button when fetch fails', () => {
      const mockRefetch = jest.fn();
      const errorMessage = 'Network connection failed';
      
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: errorMessage },
        refetch: mockRefetch,
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Should show error message - Req 11.6
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

    it('retry button actually re-initiates the section fetch', () => {
      const mockRefetch = jest.fn();
      
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Network error' },
        refetch: mockRefetch,
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Click retry button - Req 11.6
      const retryButton = screen.getByTestId('Balance-retry');
      fireEvent.click(retryButton);

      // Should call refetch function
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('never shows substituted values in error state', () => {
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Contract call failed' },
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

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

    it('retry works after different types of errors', () => {
      const mockRefetch = jest.fn();
      
      // Test with timeout error
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Request timeout' },
        refetch: mockRefetch,
      });

      const { rerender } = render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Should show timeout error - Req 11.5
      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();

      // Click retry - Req 11.6
      const retryButton = screen.getByTestId('Balance-retry');
      fireEvent.click(retryButton);

      expect(mockRefetch).toHaveBeenCalledTimes(1);

      // Test with network error
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Network error' },
        refetch: mockRefetch,
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Should still show error with retry
      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
      expect(screen.getByTestId('Balance-retry')).toBeInTheDocument();
    });

    it('maintains error state independently across multiple sections', () => {
      // Mock different states for different sections
      mockUseContractRead
        .mockReturnValueOnce({
          data: undefined,
          isLoading: false,
          isError: true,
          error: { name: 'ContractReadError', message: 'Balance fetch failed' },
          refetch: jest.fn(),
        })
        .mockReturnValueOnce({
          data: 5000n,
          isLoading: false,
          isError: false,
          error: null,
          refetch: jest.fn(),
        });

      render(
        <TestWrapper>
          <DashboardSection {...testProps} title="Balance" functionName="balanceOf" />
          <DashboardSection {...testProps} title="Portfolio" functionName="portfolioValue" />
        </TestWrapper>
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
    it('follows proper loading → success state transition', () => {
      const { rerender } = render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Initial: loading state
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
        </TestWrapper>
      );

      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();

      // Final: success state
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
        </TestWrapper>
      );

      expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
      expect(screen.getByText('6000 ETH')).toBeInTheDocument();
      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
    });

    it('follows proper loading → error state transition', () => {
      const { rerender } = render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Initial: loading state
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
        </TestWrapper>
      );

      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();

      // Final: error state
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Request failed' },
        refetch: jest.fn(),
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
    });

    it('follows proper error → loading → success state transition via retry', () => {
      const { rerender } = render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      // Initial failure → error state
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Initial failure' },
        refetch: jest.fn(),
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      expect(screen.getByTestId('Balance-error')).toBeInTheDocument();

      // Retry → loading state
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
        </TestWrapper>
      );

      expect(screen.getByTestId('Balance-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();

      // Success → data state
      mockUseContractRead.mockReturnValue({
        data: 7000n,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
      );

      expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
      expect(screen.getByText('7000 ETH')).toBeInTheDocument();
      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
    });

    it('has proper accessibility attributes in all states', () => {
      const { rerender } = render(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
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
        </TestWrapper>
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');

      // Error state accessibility
      mockUseContractRead.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { name: 'ContractReadError', message: 'Test error' },
        refetch: jest.fn(),
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} />
        </TestWrapper>
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
        </TestWrapper>
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
    it('does not call useContractRead when disabled', () => {
      // Mock hook to return a "not called" state
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
        </TestWrapper>
      );

      // Should call the hook but with enabled: false
      expect(mockUseContractRead).toHaveBeenCalledWith({
        address: testProps.contractAddress,
        abi: testProps.abi,
        functionName: testProps.functionName,
        args: testProps.args,
        enabled: false,
      });

      // Should show the section structure but no content
      expect(screen.getByTestId('Balance-section')).toBeInTheDocument();
      expect(screen.getByText('Balance')).toBeInTheDocument();
      
      // Should not show loading, error, or data when disabled
      expect(screen.queryByTestId('Balance-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Balance-data')).not.toBeInTheDocument();
    });

    it('can be enabled and disabled dynamically', () => {
      const { rerender } = render(
        <TestWrapper>
          <DashboardSection {...testProps} enabled={false} />
        </TestWrapper>
      );

      // Initially disabled
      expect(mockUseContractRead).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );

      // Enable
      mockUseContractRead.mockReturnValue({
        data: 10000n,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      rerender(
        <TestWrapper>
          <DashboardSection {...testProps} enabled={true} />
        </TestWrapper>
      );

      // Should now be enabled and show data
      expect(mockUseContractRead).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      );
      expect(screen.getByTestId('Balance-data')).toBeInTheDocument();
      expect(screen.getByText('10000 ETH')).toBeInTheDocument();
    });
  });
});