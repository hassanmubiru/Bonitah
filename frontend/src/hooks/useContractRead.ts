'use client';

import { useQuery } from '@tanstack/react-query';
import { type Address, type Abi } from 'viem';
import { readContract } from 'viem/actions';
import { usePublicClient } from 'wagmi';

// Import BASE_SEPOLIA_CHAIN_ID directly to avoid module issues
const BASE_SEPOLIA_CHAIN_ID = 84532;

/**
 * Contract read error types for proper error handling.
 */
export interface ContractReadError extends Error {
  name: string;
  message: string;
  cause?: unknown;
}

/**
 * Read state machine for UI components.
 * Implements Requirements 1.6, 1.7, 11.4, 11.5, 11.6.
 */
export interface ContractReadState<TData> {
  /** The returned data from the contract read, undefined if loading or error */
  data: TData | undefined;
  /** True while the read is in progress (including retries) */
  isLoading: boolean;
  /** True if all retries have been exhausted */
  isError: boolean;
  /** The error that occurred, if any */
  error: ContractReadError | null;
  /** Manually refetch the data */
  refetch: () => void;
}

/**
 * Parameters for contract read operations.
 * Simplified to avoid complex generic constraints.
 */
export interface UseContractReadOptions {
  /** Contract address on Base Sepolia */
  address: Address;
  /** Contract ABI */
  abi: Abi;
  /** Function name to call */
  functionName: string;
  /** Function arguments */
  args?: readonly unknown[];
  /** Whether the query is enabled (defaults to true) */
  enabled?: boolean;
  /** Custom query key for caching (optional) */
  queryKey?: string[];
}

/**
 * Custom hook for reading blockchain data with retry policy and timeout.
 *
 * Simplified generic approach to avoid complex TypeScript constraints.
 */
export function useContractRead({
  address,
  abi,
  functionName,
  args = [],
  enabled = true,
  queryKey = [],
}: UseContractReadOptions): ContractReadState<unknown> {
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ['contract-read', address, functionName, ...(args as unknown[]), ...queryKey],
    queryFn: async () => {
      if (!publicClient) {
        throw new Error('Public client not available');
      }

      // Create timeout promise (5s per attempt - reduced for faster feedback)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Contract read timeout after 5 seconds'));
        }, 5_000);
      });

      // Perform the contract read with timeout
      const readPromise = readContract(publicClient, {
        address,
        abi,
        functionName,
        args,
        chainId: BASE_SEPOLIA_CHAIN_ID,
      } as Parameters<typeof readContract>[1]);

      try {
        // Race between read and timeout
        const result = await Promise.race([readPromise, timeoutPromise]);
        return result;
      } catch (error) {
        // Convert to our error type for consistent handling
        const contractError: ContractReadError = {
          name: 'ContractReadError',
          message: error instanceof Error ? error.message : 'Unknown contract read error',
          cause: error,
        };
        throw contractError;
      }
    },
    enabled: enabled && !!publicClient,

    // Retry policy:
    // Don't retry on contract reverts (function doesn't exist or access denied)
    retry: (failureCount, error) => {
      if (failureCount >= 2) return false;

      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        // Don't retry on contract-specific errors
        if (
          message.includes('revert') ||
          message.includes('not found on abi') ||
          message.includes('execution reverted') ||
          message.includes('invalid function')
        ) {
          return false;
        }
        // Only retry on network errors
        return (
          message.includes('timeout') ||
          message.includes('network') ||
          message.includes('fetch') ||
          message.includes('rate limit')
        );
      }
      return false;
    },

    // Faster backoff delay: 500ms, 1000ms
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 1000),

    // Cache for 60 seconds (longer cache for better performance)
    staleTime: 60_000,

    // Keep in cache for 10 minutes after going stale
    gcTime: 10 * 60 * 1000,

    // Don't refetch on window focus (explicit user action only)
    refetchOnWindowFocus: false,

    // Don't refetch on reconnect automatically
    refetchOnReconnect: false,
  });

  return {
    data: query.data,
    isLoading: query.isLoading || query.isFetching,
    isError: query.isError,
    error: query.error as ContractReadError | null,
    refetch: () => {
      query.refetch();
    },
  };
}

/**
 * Convenience hook for reading balance-like values from contracts.
 * Returns bigint values as-is for proper financial calculations.
 */
export function useContractBalance(
  contractAddress: Address,
  abi: Abi,
  userAddress: Address | undefined,
  functionName = 'balanceOf',
  enabled = true,
): ContractReadState<bigint> {
  return useContractRead({
    address: contractAddress,
    abi,
    functionName,
    args: userAddress ? [userAddress] : [],
    enabled: enabled && !!userAddress,
    queryKey: ['balance', userAddress || ''],
  }) as ContractReadState<bigint>;
}

/**
 * Convenience hook for reading portfolio value from SavingsVault contract.
 * Returns the total portfolio value including deposits, goals, and locked savings.
 */
export function usePortfolioValue(
  contractAddress: Address,
  abi: Abi,
  userAddress: Address | undefined,
  enabled = true,
): ContractReadState<bigint> {
  return useContractRead({
    address: contractAddress,
    abi,
    functionName: 'portfolioValue',
    args: userAddress ? [userAddress] : [],
    enabled: enabled && !!userAddress,
    queryKey: ['portfolio', userAddress || ''],
  }) as ContractReadState<bigint>;
}

/**
 * Convenience hook for reading user's reputation score from Registry contract.
 */
export function useReputationScore(
  contractAddress: Address,
  abi: Abi,
  userAddress: Address | undefined,
  enabled = true,
): ContractReadState<bigint> {
  return useContractRead({
    address: contractAddress,
    abi,
    functionName: 'reputationOf',
    args: userAddress ? [userAddress] : [],
    enabled: enabled && !!userAddress,
    queryKey: ['reputation', userAddress || ''],
  }) as ContractReadState<bigint>;
}
