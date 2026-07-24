'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { type Address, type Abi, readContract } from 'viem';
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
 */
export interface UseContractReadOptions<
  TAbi extends Abi,
  TFunctionName extends string,
  TArgs extends readonly unknown[] = readonly []
> {
  /** Contract address on Base Sepolia */
  address: Address;
  /** Contract ABI */
  abi: TAbi;
  /** Function name to call */
  functionName: TFunctionName;
  /** Function arguments */
  args?: TArgs;
  /** Whether the query is enabled (defaults to true) */
  enabled?: boolean;
  /** Custom query key for caching (optional) */
  queryKey?: string[];
}

/**
 * Custom hook for reading blockchain data with retry policy and timeout.
 * 
 * Implements Requirement 1.6:
 * - 10s timeout per attempt
 * - Up to 3 retries before treating as failed
 * - Proper exponential backoff strategy
 * - Error handling after all retries exhausted
 * - State management during retries
 *
 * Implements Requirements 1.7, 11.4, 11.5, 11.6:
 * - Never displays substituted, cached, or placeholder values on failure
 * - Displays loading state during reads
 * - Displays error state with retry action on failure
 * - Proper state machine: loading -> data | error
 */
export function useContractRead<
  TAbi extends Abi,
  TFunctionName extends string,
  TArgs extends readonly unknown[] = readonly []
>({
  address,
  abi,
  functionName,
  args = [] as any,
  enabled = true,
  queryKey = []
}: UseContractReadOptions<TAbi, TFunctionName, TArgs>): ContractReadState<unknown> {
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ['contract-read', address, functionName, ...(args as any[]), ...queryKey],
    queryFn: async () => {
      if (!publicClient) {
        throw new Error('Public client not available');
      }

      // Create timeout promise (10s per attempt - Req 1.6)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Contract read timeout after 10 seconds'));
        }, 10_000);
      });

      // Perform the contract read with timeout
      const readPromise = readContract(publicClient, {
        address,
        abi,
        functionName,
        args,
        chainId: BASE_SEPOLIA_CHAIN_ID,
      });

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
    
    // Retry policy (Req 1.6):
    // - Up to 3 retries (4 total attempts: initial + 3 retries)
    // - Exponential backoff: 1s, 2s, 4s delays between retries
    retry: (failureCount, error) => {
      // Stop retrying after 3 attempts (Req 1.6: max 3 retries)
      if (failureCount >= 3) {
        return false;
      }

      // Retry on network errors, timeouts, and RPC errors
      // Don't retry on contract-specific errors (invalid function, etc.)
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        const isRetryableError = (
          message.includes('timeout') ||
          message.includes('network') ||
          message.includes('fetch') ||
          message.includes('connection') ||
          message.includes('rpc') ||
          message.includes('rate limit')
        );
        return isRetryableError;
      }

      return false;
    },
    
    // Exponential backoff delay: 1000ms, 2000ms, 4000ms
    retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex), 4000),
    
    // Cache for 30 seconds (financial data staleness policy)
    staleTime: 30_000,
    
    // Keep in cache for 5 minutes after going stale
    gcTime: 5 * 60 * 1000,
    
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
  enabled = true
): ContractReadState<bigint> {
  return useContractRead({
    address: contractAddress,
    abi,
    functionName,
    args: userAddress ? [userAddress] : undefined,
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
  enabled = true
): ContractReadState<bigint> {
  return useContractRead({
    address: contractAddress,
    abi,
    functionName: 'portfolioValue',
    args: userAddress ? [userAddress] : undefined,
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
  enabled = true
): ContractReadState<bigint> {
  return useContractRead({
    address: contractAddress,
    abi,
    functionName: 'getReputationScore',
    args: userAddress ? [userAddress] : undefined,
    enabled: enabled && !!userAddress,
    queryKey: ['reputation', userAddress || ''],
  }) as ContractReadState<bigint>;
}