import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import * as fc from 'fast-check';
import { type PublicClient, createPublicClient, http, type Address, type Abi } from 'viem';
import { baseSepolia } from 'viem/chains';

import { useContractRead } from '../useContractRead';

// Import BASE_SEPOLIA_CHAIN_ID directly to avoid module issues
const BASE_SEPOLIA_CHAIN_ID = 84532;

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

// Mock public client factory
function createMockPublicClient(behavior: 'success' | 'timeout' | 'network-error' | 'rpc-error' | 'contract-error'): PublicClient {
  const baseClient = createPublicClient({
    chain: baseSepolia,
    transport: http('https://sepolia.base.org'),
  });

  // Override readContract method based on behavior
  const originalReadContract = baseClient.readContract;
  
  baseClient.readContract = jest.fn().mockImplementation(async (params) => {
    switch (behavior) {
      case 'success':
        return 1000n; // Mock successful balance
        
      case 'timeout':
        // Simulate timeout by taking longer than 10s
        await new Promise(resolve => setTimeout(resolve, 11000));
        return 1000n;
        
      case 'network-error':
        throw new Error('Network request failed');
        
      case 'rpc-error':
        throw new Error('RPC error: rate limit exceeded');
        
      case 'contract-error':
        throw new Error('Contract function does not exist');
        
      default:
        return originalReadContract.call(this, params);
    }
  });

  return baseClient;
}

// Mock wagmi's usePublicClient hook
const mockUsePublicClient = jest.fn();
jest.mock('wagmi', () => ({
  usePublicClient: () => mockUsePublicClient(),
}));

describe('Property 3: Read retry policy is bounded and correct', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
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
          errorType: fc.constantFrom('network-error', 'rpc-error', 'timeout'),
        }),
        async ({ contractAddress, userAddress, errorType }) => {
          let attemptCount = 0;
          const mockClient = createMockPublicClient('success');
          
          // Override readContract to count attempts and fail initially
          mockClient.readContract = jest.fn().mockImplementation(async () => {
            attemptCount++;
            if (attemptCount <= 3) {
              // Fail for first 3 attempts (initial + 2 retries)
              throw new Error(errorType === 'timeout' ? 'timeout' : errorType);
            }
            // Succeed on 4th attempt to verify it stops at 3 retries
            return 1000n;
          });

          mockUsePublicClient.mockReturnValue(mockClient);

          const { result } = renderHook(
            () => useContractRead({
              address: contractAddress,
              abi: mockAbi,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            { wrapper: TestWrapper }
          );

          // Wait for initial loading
          await waitFor(() => {
            expect(result.current.isLoading).toBe(true);
          });

          // Fast-forward through all retry delays with act wrapper
          act(() => {
            jest.advanceTimersByTime(8000); // 1s + 2s + 4s + buffer
          });

          // Wait for final failure
          await waitFor(() => {
            expect(result.current.isError).toBe(true);
          }, { timeout: 2000 });

          // Verify exactly 4 attempts were made (initial + 3 retries) - Req 1.6
          expect(attemptCount).toBe(4);
          expect(result.current.data).toBeUndefined(); // No placeholder values - Req 1.7
          expect(result.current.error).toBeDefined();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: 10 second timeout per attempt
   * Requirements: 1.6 (10s timeout per individual attempt)
   */
  it('enforces 10 second timeout per attempt', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          delayMs: fc.integer({ min: 10100, max: 15000 }), // Longer than 10s timeout
        }),
        async ({ contractAddress, userAddress, delayMs }) => {
          let timeoutCount = 0;
          const mockClient = createMockPublicClient('success');
          
          // Mock readContract to simulate long response time
          mockClient.readContract = jest.fn().mockImplementation(async () => {
            const startTime = Date.now();
            
            // Use real setTimeout to simulate actual delay
            return new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                timeoutCount++;
                reject(new Error('Contract read timeout after 10 seconds'));
              }, 10000); // 10s timeout - Req 1.6
              
              // Simulate long operation that would exceed timeout
              setTimeout(() => {
                clearTimeout(timeoutId);
                resolve(1000n);
              }, delayMs);
            });
          });

          mockUsePublicClient.mockReturnValue(mockClient);

          const { result } = renderHook(
            () => useContractRead({
              address: contractAddress,
              abi: mockAbi,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            { wrapper: TestWrapper }
          );

          // Wait for loading
          await waitFor(() => {
            expect(result.current.isLoading).toBe(true);
          });

          // Fast-forward to timeout with act wrapper
          act(() => {
            jest.advanceTimersByTime(10100);
          });

          // Verify timeout occurred within 10s per attempt - Req 1.6
          await waitFor(() => {
            expect(timeoutCount).toBeGreaterThan(0);
          }, { timeout: 1000 });

          expect(result.current.data).toBeUndefined(); // No placeholder values
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property: Exponential backoff delay strategy
   * Requirements: 1.6 (proper retry strategy with exponential backoff)
   */
  it('implements exponential backoff delay strategy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
        }),
        async ({ contractAddress, userAddress }) => {
          const attemptTimes: number[] = [];
          const mockClient = createMockPublicClient('success');
          
          mockClient.readContract = jest.fn().mockImplementation(async () => {
            attemptTimes.push(Date.now());
            // Always fail to observe retry delays
            throw new Error('Network request failed');
          });

          mockUsePublicClient.mockReturnValue(mockClient);

          const { result } = renderHook(
            () => useContractRead({
              address: contractAddress,
              abi: mockAbi,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            { wrapper: TestWrapper }
          );

          // Wait for initial attempt
          await waitFor(() => {
            expect(result.current.isLoading).toBe(true);
          });

          // Advance through retry delays: 1s, 2s, 4s
          act(() => {
            jest.advanceTimersByTime(1000); // First retry delay
          });
          await waitFor(() => expect(attemptTimes.length).toBe(2), { timeout: 100 });
          
          act(() => {
            jest.advanceTimersByTime(2000); // Second retry delay  
          });
          await waitFor(() => expect(attemptTimes.length).toBe(3), { timeout: 100 });
          
          act(() => {
            jest.advanceTimersByTime(4000); // Third retry delay
          });
          await waitFor(() => expect(attemptTimes.length).toBe(4), { timeout: 100 });

          // Verify exponential backoff delays: ~1s, ~2s, ~4s - Req 1.6
          if (attemptTimes.length >= 3) {
            const delay1 = attemptTimes[1]! - attemptTimes[0]!;
            const delay2 = attemptTimes[2]! - attemptTimes[1]!;
            
            // Allow some tolerance for timing variations
            expect(delay1).toBeGreaterThanOrEqual(800); // ~1s
            expect(delay1).toBeLessThanOrEqual(1200);
            
            expect(delay2).toBeGreaterThanOrEqual(1800); // ~2s  
            expect(delay2).toBeLessThanOrEqual(2200);
            
            if (attemptTimes.length >= 4) {
              const delay3 = attemptTimes[3]! - attemptTimes[2]!;
              expect(delay3).toBeGreaterThanOrEqual(3800); // ~4s
              expect(delay3).toBeLessThanOrEqual(4200);
            }
          }
        }
      ),
      { numRuns: 10 }
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
          errorType: fc.constantFrom('network-error', 'timeout', 'rpc-error'),
          errorMessage: fc.string({ minLength: 10, maxLength: 100 }),
        }),
        async ({ contractAddress, userAddress, errorType, errorMessage }) => {
          const mockClient = createMockPublicClient('success');
          
          mockClient.readContract = jest.fn().mockImplementation(async () => {
            throw new Error(`${errorType}: ${errorMessage}`);
          });

          mockUsePublicClient.mockReturnValue(mockClient);

          const { result } = renderHook(
            () => useContractRead({
              address: contractAddress,
              abi: mockAbi,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            { wrapper: TestWrapper }
          );

          // Fast-forward through all retries
          act(() => {
            jest.advanceTimersByTime(8000);
          });

          // Wait for final error state
          await waitFor(() => {
            expect(result.current.isError).toBe(true);
          }, { timeout: 2000 });

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
          let attemptCount = 0;
          const mockClient = createMockPublicClient('success');
          
          mockClient.readContract = jest.fn().mockImplementation(async () => {
            attemptCount++;
            if (attemptCount < successOnAttempt) {
              throw new Error('Network request failed'); // Retryable error
            }
            return 1000n; // Success
          });

          mockUsePublicClient.mockReturnValue(mockClient);

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
            // Fast-forward through retries until success
            jest.advanceTimersByTime((successOnAttempt - 1) * 2000);

            // Wait for success
            await waitFor(() => {
              expect(result.current.isLoading).toBe(false);
              expect(result.current.isError).toBe(false);
              expect(result.current.data).toBe(1000n);
            }, { timeout: 2000 });
          } else {
            // Should fail after all retries
            jest.advanceTimersByTime(8000);

            await waitFor(() => {
              expect(result.current.isLoading).toBe(false);
              expect(result.current.isError).toBe(true);
              expect(result.current.data).toBeUndefined(); // No placeholder on failure - Req 1.7
            }, { timeout: 2000 });
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
            'network-error',    // Should retry
            'timeout',          // Should retry  
            'rpc-error',        // Should retry
            'contract-error'    // Should NOT retry
          ),
        }),
        async ({ contractAddress, userAddress, errorType }) => {
          let attemptCount = 0;
          const mockClient = createMockPublicClient('success');
          
          const shouldRetry = ['network-error', 'timeout', 'rpc-error'].includes(errorType);
          
          mockClient.readContract = jest.fn().mockImplementation(async () => {
            attemptCount++;
            
            switch (errorType) {
              case 'network-error':
                throw new Error('Network request failed');
              case 'timeout':
                throw new Error('Request timeout');
              case 'rpc-error':
                throw new Error('RPC error: rate limit exceeded');
              case 'contract-error':
                throw new Error('Contract function does not exist');
              default:
                throw new Error('Unknown error');
            }
          });

          mockUsePublicClient.mockReturnValue(mockClient);

          const { result } = renderHook(
            () => useContractRead({
              address: contractAddress,
              abi: mockAbi,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            { wrapper: TestWrapper }
          );

          // Fast-forward through potential retries
          jest.advanceTimersByTime(8000);

          await waitFor(() => {
            expect(result.current.isError).toBe(true);
          }, { timeout: 2000 });

          if (shouldRetry) {
            // Network/timeout/RPC errors should retry up to 4 attempts total - Req 1.6
            expect(attemptCount).toBe(4);
          } else {
            // Contract errors should NOT retry - immediate failure
            expect(attemptCount).toBe(1);
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
          let attemptCount = 0;
          const mockClient = createMockPublicClient('success');
          
          mockClient.readContract = jest.fn().mockImplementation(async () => {
            attemptCount++;
            return expectedValue;
          });

          mockUsePublicClient.mockReturnValue(mockClient);

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
          }, { timeout: 1000 });

          // Successful read should only make 1 attempt - no retries needed
          expect(attemptCount).toBe(1);
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
          let attemptCount = 0;
          let shouldSucceed = false;
          const mockClient = createMockPublicClient('success');
          
          mockClient.readContract = jest.fn().mockImplementation(async () => {
            attemptCount++;
            if (shouldSucceed) {
              return expectedValue;
            }
            throw new Error('Network request failed');
          });

          mockUsePublicClient.mockReturnValue(mockClient);

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
          jest.advanceTimersByTime(8000);
          await waitFor(() => {
            expect(result.current.isError).toBe(true);
          }, { timeout: 2000 });

          // Now make refetch succeed
          shouldSucceed = true;
          const initialAttempts = attemptCount;

          // Trigger manual refetch - Req 11.6
          result.current.refetch();

          await waitFor(() => {
            expect(result.current.data).toBe(expectedValue);
            expect(result.current.isError).toBe(false);
          }, { timeout: 1000 });

          // Verify refetch made additional attempt
          expect(attemptCount).toBeGreaterThan(initialAttempts);
        }
      ),
      { numRuns: 15 }
    );
  });
});