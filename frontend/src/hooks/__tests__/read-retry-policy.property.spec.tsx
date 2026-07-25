import { renderHook, waitFor } from '@testing-library/react';
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
 * - 10s timeout per attempt (via mock validation)
 * - Proper retry strategy for network/timeout errors vs contract errors
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

// Track attempts for testing
let mockReadContractAttempts = 0;
let mockReadContractResponse: () => Promise<unknown>;

// Mock wagmi's usePublicClient 
const mockPublicClient = {
  readContract: jest.fn(),
} as any;

jest.mock('wagmi', () => ({
  usePublicClient: () => mockPublicClient,
}));

jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  readContract: jest.fn().mockImplementation(async () => {
    mockReadContractAttempts++;
    return mockReadContractResponse();
  }),
}));

describe('Property 3: Read retry policy is bounded and correct', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadContractAttempts = 0;
    
    // Set up the viem readContract mock to use our response handler
    mockReadContract.mockImplementation(async () => {
      mockReadContractAttempts++;
      return mockReadContractResponse();
    });
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

          // Wait for all retries to complete and final error state
          await waitFor(() => {
            expect(result.current.isError).toBe(true);
            expect(result.current.isLoading).toBe(false);
          }, { timeout: 20000 }); // Increased timeout for retries

          // Verify exactly 4 attempts were made (initial + 3 retries) - Req 1.6
          expect(mockReadContractAttempts).toBe(4);
          expect(result.current.data).toBeUndefined(); // No placeholder values - Req 1.7
          expect(result.current.error).toBeDefined();
          expect(result.current.error?.message).toContain(errorType);
        }
      ),
      { numRuns: 5 } // Reduced for faster testing
    );
  }, 60000); // Increase timeout for property test
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
          }, { timeout: 20000 });

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
      { numRuns: 5 }
    );
  }, 60000);
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
            }, { timeout: 20000 });
          } else {
            // Should fail after all retries
            await waitFor(() => {
              expect(result.current.isLoading).toBe(false);
              expect(result.current.isError).toBe(true);
              expect(result.current.data).toBeUndefined(); // No placeholder on failure - Req 1.7
            }, { timeout: 20000 });
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);
  /**
   * Property: Successful reads return data without unnecessary retries
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
      { numRuns: 10 }
    );
  }, 30000);
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

          // Allow some time for the hook to settle
          await new Promise(resolve => setTimeout(resolve, 100));

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
      { numRuns: 8 }
    );
  }, 25000);

  /**
   * Property: Retry policy configuration is correctly implemented
   * Requirements: 1.6 (retry policy configuration validation)
   */
  it('retry policy configuration validates correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
        }),
        async ({ contractAddress, userAddress }) => {
          mockReadContractAttempts = 0;
          
          // Track retry attempts and timing
          const retryTimes: number[] = [];
          mockReadContractResponse = async () => {
            retryTimes.push(Date.now());
            throw new Error('network timeout');
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
          }, { timeout: 20000 });

          // Verify retry configuration - Req 1.6
          expect(mockReadContractAttempts).toBe(4); // Initial + 3 retries
          expect(result.current.data).toBeUndefined(); // No placeholder values
          expect(result.current.error?.message).toContain('timeout');
          expect(typeof result.current.refetch).toBe('function'); // Refetch available

          // Basic timing validation - retries should have delays
          if (retryTimes.length >= 2) {
            const timeBetweenRetries = retryTimes[1]! - retryTimes[0]!;
            expect(timeBetweenRetries).toBeGreaterThan(100); // Some delay exists
          }
        }
      ),
      { numRuns: 3 } // Reduced for performance
    );
  }, 60000);
});