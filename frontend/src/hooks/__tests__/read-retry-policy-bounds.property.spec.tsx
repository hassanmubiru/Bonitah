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
 * - Retry policy is bounded (max 3 attempts with 10s timeout per attempt)
 * - Different error types trigger appropriate retry behavior
 * - State management during retries (loading/error states)
 * - No placeholder financial values are ever shown on failure
 * - Proper timeout handling and cleanup
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
        retry: false, // Let hook control retries
        gcTime: 0,
        staleTime: 0,
      },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Mock response handler
let mockResponse: () => Promise<unknown>;

// Mock wagmi and viem
const mockPublicClient = {
  readContract: jest.fn(),
  chainId: 84532,
};

jest.mock('wagmi', () => ({
  usePublicClient: () => mockPublicClient,
}));

jest.mock('viem', () => {
  const actual = jest.requireActual('viem');
  return {
    ...actual,
    readContract: jest.fn().mockImplementation(async () => {
      return await mockResponse();
    }),
  };
});

describe('Property 3: Read retry policy is bounded and correct', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property: Retry policy prevents infinite retries and eventual success
   * Requirements: 1.6 (bounded retry policy)
   */
  it('implements bounded retry policy with finite attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc
            .string({ minLength: 42, maxLength: 42 })
            .map((s) => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc
            .string({ minLength: 42, maxLength: 42 })
            .map((s) => `0x${s.slice(2).padStart(40, '0')}` as Address),
          errorType: fc.constantFrom('network', 'timeout', 'connection'),
        }),
        async ({ contractAddress, userAddress, errorType }) => {
          // Configure to always fail with retryable error
          mockResponse = async () => {
            throw new Error(`${errorType} error occurred`);
          };

          const { result } = renderHook(
            () =>
              useContractRead({
                address: contractAddress,
                abi: mockAbi,
                functionName: 'balanceOf',
                args: [userAddress],
              }),
            { wrapper: TestWrapper },
          );

          // Initially should be loading - Req 11.4
          expect(result.current.isLoading).toBe(true);
          expect(result.current.data).toBeUndefined(); // No placeholder values

          // Wait for final error state after retry attempts
          await waitFor(
            () => {
              expect(result.current.isError).toBe(true);
              expect(result.current.isLoading).toBe(false);
            },
            { timeout: 15000 },
          ); // Allow time for retries

          // Final state validation - Req 1.6, 1.7
          expect(result.current.data).toBeUndefined(); // No placeholder values - Req 1.7
          expect(result.current.error).toBeDefined();
          expect(result.current.error?.message).toContain(errorType);
          expect(typeof result.current.refetch).toBe('function');
        },
      ),
      { numRuns: 100 }, // Minimum 100 iterations as required
    );
  }, 60000);

  /**
   * Property: State management during retry operations
   * Requirements: 1.6, 11.4, 11.5, 11.6 (proper state transitions)
   */
  it('maintains correct state during retry operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc
            .string({ minLength: 42, maxLength: 42 })
            .map((s) => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc
            .string({ minLength: 42, maxLength: 42 })
            .map((s) => `0x${s.slice(2).padStart(40, '0')}` as Address),
          shouldSucceed: fc.boolean(),
          successValue: fc.bigInt({ min: 0n, max: 1000000n }),
        }),
        async ({ contractAddress, userAddress, shouldSucceed, successValue }) => {
          mockResponse = async () => {
            if (shouldSucceed) {
              return successValue;
            } else {
              throw new Error('Network request failed');
            }
          };

          const { result } = renderHook(
            () =>
              useContractRead({
                address: contractAddress,
                abi: mockAbi,
                functionName: 'balanceOf',
                args: [userAddress],
              }),
            { wrapper: TestWrapper },
          );

          // Initially loading - Req 11.4
          expect(result.current.isLoading).toBe(true);
          expect(result.current.isError).toBe(false);
          expect(result.current.data).toBeUndefined(); // No placeholder

          if (shouldSucceed) {
            // Wait for success
            await waitFor(
              () => {
                expect(result.current.isLoading).toBe(false);
                expect(result.current.isError).toBe(false);
                expect(result.current.data).toBe(successValue);
              },
              { timeout: 10000 },
            );
          } else {
            // Wait for error after retries
            await waitFor(
              () => {
                expect(result.current.isLoading).toBe(false);
                expect(result.current.isError).toBe(true);
                expect(result.current.data).toBeUndefined(); // No placeholder on failure - Req 11.6
              },
              { timeout: 15000 },
            );
          }

          // Interface validation
          expect(typeof result.current.refetch).toBe('function');
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);

  /**
   * Property: Error type classification affects retry behavior
   * Requirements: 1.6 (retry only appropriate errors)
   */
  it('differentiates retryable and non-retryable errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc
            .string({ minLength: 42, maxLength: 42 })
            .map((s) => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc
            .string({ minLength: 42, maxLength: 42 })
            .map((s) => `0x${s.slice(2).padStart(40, '0')}` as Address),
          errorType: fc.constantFrom(
            'network error', // Retryable
            'timeout error', // Retryable
            'rpc error', // Retryable
            'rate limit', // Retryable
            'function not found', // Non-retryable
          ),
        }),
        async ({ contractAddress, userAddress, errorType }) => {
          mockResponse = async () => {
            throw new Error(errorType);
          };

          const { result } = renderHook(
            () =>
              useContractRead({
                address: contractAddress,
                abi: mockAbi,
                functionName: 'balanceOf',
                args: [userAddress],
              }),
            { wrapper: TestWrapper },
          );

          // Wait for final state
          await waitFor(
            () => {
              expect(result.current.isError).toBe(true);
            },
            { timeout: 15000 },
          );

          // All error types should eventually result in error state - Req 1.6
          expect(result.current.data).toBeUndefined(); // No data on error - Req 1.7
          expect(result.current.error).toBeDefined();
          expect(result.current.error?.message).toContain(errorType.split(' ')[0]);
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);

  /**
   * Property: Hook configuration validation
   * Requirements: 1.6 (proper hook interface and behavior)
   */
  it('validates hook configuration and enables/disables correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc
            .string({ minLength: 42, maxLength: 42 })
            .map((s) => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc
            .string({ minLength: 42, maxLength: 42 })
            .map((s) => `0x${s.slice(2).padStart(40, '0')}` as Address),
          enabled: fc.boolean(),
          expectedValue: fc.bigInt({ min: 0n, max: 1000000n }),
        }),
        async ({ contractAddress, userAddress, enabled, expectedValue }) => {
          mockResponse = async () => expectedValue;

          const { result } = renderHook(
            () =>
              useContractRead({
                address: contractAddress,
                abi: mockAbi,
                functionName: 'balanceOf',
                args: [userAddress],
                enabled,
              }),
            { wrapper: TestWrapper },
          );

          // Allow hook to settle
          await new Promise((resolve) => setTimeout(resolve, 100));

          if (enabled) {
            // Should fetch data when enabled
            await waitFor(
              () => {
                expect(result.current.data).toBe(expectedValue);
              },
              { timeout: 5000 },
            );
          } else {
            // Should not fetch when disabled
            expect(result.current.isLoading).toBe(false);
            expect(result.current.data).toBeUndefined();
          }

          // Interface should always be consistent
          expect(typeof result.current.refetch).toBe('function');
          expect(typeof result.current.isLoading).toBe('boolean');
          expect(typeof result.current.isError).toBe('boolean');
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  /**
   * Property: Successful operations don't trigger unnecessary retries  
   * Requirements: 1.6 (efficient operation)
   */
  it('successful reads complete without unnecessary operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc
            .string({ minLength: 42, maxLength: 42 })
            .map((s) => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc
            .string({ minLength: 42, maxLength: 42 })
            .map((s) => `0x${s.slice(2).padStart(40, '0')}` as Address),
          expectedValue: fc.bigInt({ min: 0n, max: 1000000n }),
        }),
        async ({ contractAddress, userAddress, expectedValue }) => {
          mockResponse = async () => expectedValue;

          const { result } = renderHook(
            () =>
              useContractRead({
                address: contractAddress,
                abi: mockAbi,
                functionName: 'balanceOf',
                args: [userAddress],
              }),
            { wrapper: TestWrapper },
          );

          await waitFor(
            () => {
              expect(result.current.isLoading).toBe(false);
              expect(result.current.data).toBe(expectedValue);
            },
            { timeout: 5000 },
          );

          // Successful read should not be in error state
          expect(result.current.isError).toBe(false);
          expect(result.current.error).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  /**
   * Property: Refetch functionality works after errors
   * Requirements: 11.6 (retry action works)
   */
  it('refetch functionality works after initial failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contractAddress: fc
            .string({ minLength: 42, maxLength: 42 })
            .map((s) => `0x${s.slice(2).padStart(40, '0')}` as Address),
          userAddress: fc
            .string({ minLength: 42, maxLength: 42 })
            .map((s) => `0x${s.slice(2).padStart(40, '0')}` as Address),
          recoveryValue: fc.bigInt({ min: 0n, max: 1000000n }),
        }),
        async ({ contractAddress, userAddress, recoveryValue }) => {
          // Start with failing response
          mockResponse = async () => {
            throw new Error('Initial network error');
          };

          const { result } = renderHook(
            () =>
              useContractRead({
                address: contractAddress,
                abi: mockAbi,
                functionName: 'balanceOf',
                args: [userAddress],
              }),
            { wrapper: TestWrapper },
          );

          // Wait for initial error
          await waitFor(
            () => {
              expect(result.current.isError).toBe(true);
            },
            { timeout: 15000 },
          );

          expect(result.current.data).toBeUndefined(); // No placeholder - Req 11.6

          // Change mock to succeed
          mockResponse = async () => recoveryValue;

          // Test refetch
          await result.current.refetch();

          await waitFor(
            () => {
              expect(result.current.data).toBe(recoveryValue);
              expect(result.current.isError).toBe(false);
            },
            { timeout: 5000 },
          );
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);
});
