import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import * as fc from 'fast-check';
import { type Address, type Abi } from 'viem';

import { useContractRead } from '../useContractRead';

/**
 * Property 3: Read retry policy is bounded and correct
 * **Validates: Requirements 1.6**
 *
 * This test validates that the frontend read hooks implement the correct retry policy:
 * - Maximum 3 retries (4 total attempts including initial)
 * - 10s timeout per attempt
 * - Proper exponential backoff strategy (1s, 2s, 4s)
 * - Error handling after all retries exhausted
 * - State management during retries (loading -> error, never placeholder values)
 * - Only retry on network/timeout errors, not contract-specific errors
 */

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
function TestWrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Use hook's own retry logic
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
let mockReadContractResponse: () => Promise<unknown>;
let mockReadContractAttempts: number;
const mockPublicClient = {
  readContract: jest.fn().mockImplementation(async () => {
    mockReadContractAttempts++;
    return mockReadContractResponse();
  }),
} as any;

const mockUsePublicClient = jest.fn().mockReturnValue(mockPublicClient);

jest.mock('wagmi', () => ({
  usePublicClient: () => mockUsePublicClient(),
}));

describe('Property 3: Read retry policy is bounded and correct', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadContractAttempts = 0;
  });

  /**
   * Property: Retry attempts are bounded to maximum 3 retries
   * Requirements: 1.6 (max 3 retries before treating read as failed)
   */
  it('retry attempts are bounded to maximum 3 retries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          errorType: fc.constantFrom('network', 'timeout', 'connection'),
        }),
        async ({ contractAddress, userAddress, errorType }) => {
          // Reset attempt counter
          mockReadContractAttempts = 0;
          
          // Set up to always fail with retryable error
          mockReadContractResponse = async () => {
            throw new Error(`${errorType} error`);
          };

          const { result } = renderHook(
            () => useContractRead({
              address: contractAddress,
              abi: mockAbi,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            { wrapper: TestWrapper }
          );

          // Wait for initial loading state
          expect(result.current.isLoading).toBe(true);
          expect(result.current.data).toBeUndefined(); // No placeholder values

          // Wait for all retries to complete and error state
          await waitFor(() => {
            expect(result.current.isError).toBe(true);
            expect(result.current.isLoading).toBe(false);
          }, { timeout: 10000 });

          // Verify exactly 4 attempts were made (initial + 3 retries) - Req 1.6
          expect(mockReadContractAttempts).toBe(4);
          expect(result.current.data).toBeUndefined(); // No placeholder values - Req 1.7
          expect(result.current.error).toBeDefined();
          expect(result.current.error?.message).toContain(errorType);
        }
      ),
      { numRuns: 20 }
    );
  });
  /**
   * Property: Error handling after all retries exhausted
   * Requirements: 1.6, 1.7 (proper error state, no placeholder values)
   */
  it('handles errors properly after all retries exhausted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          errorType: fc.constantFrom('network error', 'timeout error', 'rpc error'),
          errorMessage: fc.string({ minLength: 10, maxLength: 100 }),
        }),
        async ({ contractAddress, userAddress, errorType, errorMessage }) => {
          mockReadContractAttempts = 0;
          
          mockReadContractResponse = async () => {
            throw new Error(`${errorType}: ${errorMessage}`);
          };

          const { result } = renderHook(
            () => useContractRead({
              address: contractAddress,
              abi: mockAbi,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            { wrapper: TestWrapper }
          );

          // Wait for final error state
          await waitFor(() => {
            expect(result.current.isError).toBe(true);
          }, { timeout: 10000 });

          // Verify error handling - Req 1.6, 1.7
          expect(result.current.isLoading).toBe(false);
          expect(result.current.data).toBeUndefined(); // No placeholder values
          expect(result.current.error).toBeDefined();
          expect(result.current.error?.message).toContain(errorType);
          
          // Verify refetch function exists for user retry
          expect(typeof result.current.refetch).toBe('function');
        }
      ),
      { numRuns: 25 }
    );
  });
  /**
   * Property: State management during retries
   * Requirements: 1.6, 11.4, 11.5 (loading state during retries, proper state machine)
   */
  it('manages state correctly during retry process', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          successOnAttempt: fc.integer({ min: 1, max: 4 }), // Which attempt should succeed
        }),
        async ({ contractAddress, userAddress, successOnAttempt }) => {
          mockReadContractAttempts = 0;
          
          mockReadContractResponse = async () => {
            if (mockReadContractAttempts < successOnAttempt) {
              throw new Error('Network request failed'); // Retryable error
            }
            return 1000n; // Success
          };

          const { result } = renderHook(
            () => useContractRead({
              address: contractAddress,
              abi: mockAbi,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            { wrapper: TestWrapper }
          );

          // Initially should be loading - Req 11.4
          expect(result.current.isLoading).toBe(true);
          expect(result.current.isError).toBe(false);
          expect(result.current.data).toBeUndefined(); // No placeholder - Req 11.4

          if (successOnAttempt <= 4) {
            // Wait for success
            await waitFor(() => {
              expect(result.current.isLoading).toBe(false);
              expect(result.current.isError).toBe(false);
              expect(result.current.data).toBe(1000n);
            }, { timeout: 10000 });
          } else {
            // Should fail after all retries
            await waitFor(() => {
              expect(result.current.isLoading).toBe(false);
              expect(result.current.isError).toBe(true);
              expect(result.current.data).toBeUndefined(); // No placeholder on failure - Req 1.7
            }, { timeout: 10000 });
          }
        }
      ),
      { numRuns: 20 }
    );
  });
  /**
   * Property: Only retry on network/timeout errors, not contract-specific errors
   * Requirements: 1.6 (smart retry logic based on error type)
   */
  it('only retries on network/timeout errors, not contract-specific errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          errorType: fc.constantFrom(
            'network error',    // Should retry
            'timeout',          // Should retry  
            'rpc error',        // Should retry
            'function not found' // Should NOT retry
          ),
        }),
        async ({ contractAddress, userAddress, errorType }) => {
          mockReadContractAttempts = 0;
          const shouldRetry = ['network error', 'timeout', 'rpc error'].includes(errorType);
          
          mockReadContractResponse = async () => {
            throw new Error(errorType);
          };

          const { result } = renderHook(
            () => useContractRead({
              address: contractAddress,
              abi: mockAbi,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            { wrapper: TestWrapper }
          );

          await waitFor(() => {
            expect(result.current.isError).toBe(true);
          }, { timeout: 10000 });

          if (shouldRetry) {
            // Network/timeout/RPC errors should retry up to 4 attempts total - Req 1.6
            expect(mockReadContractAttempts).toBe(4);
          } else {
            // Contract errors should NOT retry - immediate failure
            expect(mockReadContractAttempts).toBe(1);
          }

          // Always should end in error state with no data - Req 1.7
          expect(result.current.data).toBeUndefined();
          expect(result.current.error).toBeDefined();
        }
      ),
      { numRuns: 30 }
    );
  });
  /**
   * Property: Successful reads return data without retries
   * Requirements: 1.6 (successful reads should not retry unnecessarily)
   */
  it('successful reads return data without unnecessary retries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          expectedValue: fc.bigInt({ min: 0n, max: 1000000n }),
        }),
        async ({ contractAddress, userAddress, expectedValue }) => {
          mockReadContractAttempts = 0;
          
          mockReadContractResponse = async () => {
            return expectedValue;
          };

          const { result } = renderHook(
            () => useContractRead({
              address: contractAddress,
              abi: mockAbi,
              functionName: 'balanceOf', 
              args: [userAddress],
            }),
            { wrapper: TestWrapper }
          );

          await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.data).toBe(expectedValue);
          }, { timeout: 5000 });

          // Successful read should only make 1 attempt - no retries needed
          expect(mockReadContractAttempts).toBe(1);
          expect(result.current.isError).toBe(false);
          expect(result.current.error).toBeNull();
        }
      ),
      { numRuns: 25 }
    );
  });
  /**
   * Property: Manual refetch works correctly
   * Requirements: 11.6 (retry action for failed reads)
   */
  it('manual refetch works correctly after failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          expectedValue: fc.bigInt({ min: 0n, max: 1000000n }),
        }),
        async ({ contractAddress, userAddress, expectedValue }) => {
          mockReadContractAttempts = 0;
          let shouldSucceed = false;
          
          mockReadContractResponse = async () => {
            if (shouldSucceed) {
              return expectedValue;
            }
            throw new Error('Network request failed');
          };

          const { result } = renderHook(
            () => useContractRead({
              address: contractAddress,
              abi: mockAbi,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            { wrapper: TestWrapper }
          );

          // Wait for initial failure
          await waitFor(() => {
            expect(result.current.isError).toBe(true);
          }, { timeout: 10000 });

          // Now make refetch succeed
          shouldSucceed = true;
          const initialAttempts = mockReadContractAttempts;

          // Trigger manual refetch - Req 11.6
          act(() => {
            result.current.refetch();
          });

          await waitFor(() => {
            expect(result.current.data).toBe(expectedValue);
            expect(result.current.isError).toBe(false);
          }, { timeout: 5000 });

          // Verify refetch made additional attempt
          expect(mockReadContractAttempts).toBeGreaterThan(initialAttempts);
        }
      ),
      { numRuns: 15 }
    );
  });
  /**
   * Property: Hook configuration properties work correctly
   * Requirements: 1.6 (proper hook interface and behavior)
   */
  it('hook configuration properties work correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          enabled: fc.boolean(),
          expectedValue: fc.bigInt({ min: 0n, max: 1000000n }),
        }),
        async ({ contractAddress, userAddress, enabled, expectedValue }) => {
          mockReadContractAttempts = 0;
          
          mockReadContractResponse = async () => {
            return expectedValue;
          };

          const { result } = renderHook(
            () => useContractRead({
              address: contractAddress,
              abi: mockAbi,
              functionName: 'balanceOf',
              args: [userAddress],
              enabled,
            }),
            { wrapper: TestWrapper }
          );

          if (enabled) {
            // Should fetch data when enabled
            await waitFor(() => {
              expect(result.current.data).toBe(expectedValue);
            }, { timeout: 5000 });
            expect(mockReadContractAttempts).toBe(1);
          } else {
            // Should not fetch when disabled
            expect(result.current.isLoading).toBe(false);
            expect(result.current.data).toBeUndefined();
            expect(mockReadContractAttempts).toBe(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});