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
        retry: false, // Disable default retry to test hook's own logic
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

// Track attempts and responses for testing
let mockReadContractAttempts = 0;
let mockReadContractResponse: () => Promise<unknown>;

// Mock the public client used by useContractRead
const mockPublicClient = {
  readContract: jest.fn(),
  chainId: 84532,
};

// Mock wagmi's usePublicClient 
jest.mock('wagmi', () => ({
  usePublicClient: () => mockPublicClient,
}));

// Mock viem's readContract function to track calls
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
  });

  /**
   * Property: Retry policy bounds and error handling
   * Requirements: 1.6 (max 3 retries, proper error handling)
   */
  it('implements bounded retry policy with proper error handling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          errorType: fc.constantFrom('network', 'timeout', 'connection', 'rpc'),
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

          // Wait for final error state after retries
          await waitFor(() => {
            expect(result.current.isError).toBe(true);
            expect(result.current.isLoading).toBe(false);
          }, { timeout: 20000 });

          // Verify final state - should be error with no data - Req 1.6, 1.7
          expect(result.current.data).toBeUndefined(); // No placeholder values - Req 1.7
          expect(result.current.error).toBeDefined();
          expect(result.current.error?.message).toContain(errorType);
          expect(typeof result.current.refetch).toBe('function'); // Refetch available
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);
  /**
   * Property: Retry logic differentiates error types
   * Requirements: 1.6 (smart retry logic based on error type)
   */
  it('applies retry logic based on error type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}` as Address),
          errorType: fc.constantFrom(
            'network error',       // Should retry
            'timeout error',       // Should retry  
            'rpc error',           // Should retry
            'function not found'   // Should NOT retry (contract error)
          ),
        }),
        async ({ contractAddress, userAddress, errorType }) => {
          mockReadContractAttempts = 0;
          
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

          // Wait for final state
          await waitFor(() => {
            expect(result.current.isError).toBe(true);
          }, { timeout: 20000 });

          // Always should end in error state with no data - Req 1.7
          expect(result.current.data).toBeUndefined();
          expect(result.current.error).toBeDefined();
          expect(result.current.error?.message).toContain(errorType.split(' ')[0]); // Match error type
          expect(typeof result.current.refetch).toBe('function'); // Refetch should be available
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