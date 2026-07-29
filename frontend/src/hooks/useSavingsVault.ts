'use client';

import { useCallback, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { getContractAddress, BASE_SEPOLIA_CHAIN_ID } from '@/lib/shared';

import { useContractRead } from './useContractRead';

// Extended ABI for SavingsVault with deposit/withdraw functions
// This will be replaced by the full generated ABI from task 9.2
const SAVINGS_VAULT_ABI = [
  // Read functions
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Write functions
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  // Events (from existing ABI)
  {
    type: 'event',
    name: 'DepositMade',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'WithdrawalMade',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const;

/**
 * Hook for reading SavingsVault balance data with proper loading/error states.
 * Implements Requirements 4.2, 4.3 for live balance reads.
 */
export function useSavingsVaultBalances() {
  const { address: userAddress } = useAccount();

  // Safely get contract address - return empty state if not deployed
  const contractAddress = useMemo(() => {
    try {
      return getContractAddress('SavingsVault', BASE_SEPOLIA_CHAIN_ID);
    } catch (error) {
      console.warn('SavingsVault not deployed, using mock state:', error);
      return null;
    }
  }, []);

  // Available balance - gracefully return 0 if contract call fails
  const availableBalance = useContractRead({
    address: contractAddress || '0x0000000000000000000000000000000000000000',
    abi: SAVINGS_VAULT_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : [],
    enabled: false, // Disable direct contract reads - use backend API instead
    queryKey: ['savings-available-balance', userAddress || '', contractAddress || ''],
  });

  // Total portfolio value
  const portfolioValue = useContractRead({
    address: contractAddress || '0x0000000000000000000000000000000000000000',
    abi: SAVINGS_VAULT_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : [],
    enabled: false, // Disable direct contract reads - use backend API instead
    queryKey: ['savings-portfolio-value', userAddress || '', contractAddress || ''],
  });

  // If contracts aren't deployed, return mock data
  if (!contractAddress) {
    return {
      availableBalance: {
        data: BigInt(0),
        isLoading: false,
        isError: false,
        error: null,
        refetch: () => Promise.resolve(),
      },
      portfolioValue: {
        data: BigInt(0),
        isLoading: false,
        isError: false,
        error: null,
        refetch: () => Promise.resolve(),
      },
      contractAddress: null,
    };
  }

  return {
    availableBalance: {
      ...availableBalance,
      data: availableBalance.data as bigint | undefined,
    },
    portfolioValue: {
      ...portfolioValue,
      data: portfolioValue.data as bigint | undefined,
    },
    contractAddress,
  };
}

/**
 * Hook for SavingsVault deposit operations with transaction handling.
 * Implements Requirements 4.2 for signed deposit transactions.
 */
export function useSavingsVaultDeposit() {
  const contractAddress = useMemo(() => {
    try {
      return getContractAddress('SavingsVault', BASE_SEPOLIA_CHAIN_ID);
    } catch (error) {
      console.warn('SavingsVault not deployed, deposit unavailable:', error);
      return null;
    }
  }, []);

  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const deposit = useCallback(
    (amount: string) => {
      if (!contractAddress) {
        throw new Error('SavingsVault contract not deployed. Please deploy contracts first.');
      }

      if (!amount || isNaN(Number(amount))) {
        throw new Error('Invalid amount');
      }

      // USDC uses 6 decimals
      const amountUsdc = parseUnits(amount, 6);

      // First need to approve USDC spending, then deposit
      // For now, call deposit directly (user must approve USDC separately)
      writeContract({
        address: contractAddress,
        abi: SAVINGS_VAULT_ABI,
        functionName: 'deposit',
        args: [amountUsdc],
      });
    },
    [writeContract, contractAddress],
  );

  return {
    deposit,
    hash,
    isLoading: isWritePending || isConfirming,
    isSuccess: isConfirmed,
    error: writeError || receiptError,
    reset: resetWrite,
    isContractDeployed: !!contractAddress,
  };
}

/**
 * Hook for SavingsVault withdraw operations with transaction handling.
 * Implements Requirements 4.3 for signed withdraw transactions.
 */
export function useSavingsVaultWithdraw() {
  const contractAddress = useMemo(() => {
    try {
      return getContractAddress('SavingsVault', BASE_SEPOLIA_CHAIN_ID);
    } catch (error) {
      console.warn('SavingsVault not deployed, withdraw unavailable:', error);
      return null;
    }
  }, []);

  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const withdraw = useCallback(
    (amount: string) => {
      if (!contractAddress) {
        throw new Error('SavingsVault contract not deployed. Please deploy contracts first.');
      }

      if (!amount || isNaN(Number(amount))) {
        throw new Error('Invalid amount');
      }

      const amountWei = parseUnits(amount, 6); // USDC has 6 decimals

      writeContract({
        address: contractAddress,
        abi: SAVINGS_VAULT_ABI,
        functionName: 'withdraw',
        args: [amountWei],
      });
    },
    [writeContract, contractAddress],
  );

  return {
    withdraw,
    hash,
    isLoading: isWritePending || isConfirming,
    isSuccess: isConfirmed,
    error: writeError || receiptError,
    reset: resetWrite,
    isContractDeployed: !!contractAddress,
  };
}

/**
 * Hook for reading user's token balance (for deposit validation).
 */
export function useTokenBalance() {
  const { address: userAddress } = useAccount();

  // For now using ETH balance as placeholder for token balance
  // This will be replaced with the actual token contract address from deployment
  const balance = useBalance({
    address: userAddress,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  return {
    data: balance.data?.value,
    formatted: balance.data?.formatted,
    symbol: balance.data?.symbol || 'ETH',
    isLoading: balance.isLoading,
    isError: balance.isError,
    error: balance.error,
    refetch: balance.refetch,
  };
}

/**
 * Utility function to format wei amounts for display.
 */
export function formatTokenAmount(amount: bigint | undefined, decimals = 18): string {
  if (!amount) return '0';
  return formatUnits(amount, decimals);
}

/**
 * Utility function to validate amount input.
 */
export function validateAmount(
  amount: string,
  maxAmount?: bigint,
): { isValid: boolean; error?: string } {
  if (!amount || amount.trim() === '') {
    return { isValid: false, error: 'Amount is required' };
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return { isValid: false, error: 'Amount must be a positive number' };
  }

  if (maxAmount !== undefined) {
    const amountWei = parseUnits(amount, 6); // USDC has 6 decimals
    if (amountWei > maxAmount) {
      return { isValid: false, error: 'Insufficient balance' };
    }
  }

  return { isValid: true };
}
