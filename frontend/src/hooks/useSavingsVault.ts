'use client';

import { useCallback } from 'react';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useBalance,
} from 'wagmi';
import { parseUnits, formatUnits, type Address } from 'viem';
import {
  getContractAddress,
  getContractAbi,
  BASE_SEPOLIA_CHAIN_ID,
} from '@bfn/shared';

import { useContractRead } from './useContractRead';

// Extended ABI for SavingsVault with deposit/withdraw functions
// This will be replaced by the full generated ABI from task 9.2
const SAVINGS_VAULT_ABI = [
  // Read functions
  {
    name: 'availableBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'portfolioValue',
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
  
  const contractAddress = getContractAddress(BASE_SEPOLIA_CHAIN_ID, 'SavingsVault');

  // Available balance (deposited - locked)
  const availableBalance = useContractRead({
    address: contractAddress,
    abi: SAVINGS_VAULT_ABI,
    functionName: 'availableBalance',
    args: userAddress ? [userAddress] : undefined,
    enabled: !!userAddress,
    queryKey: ['savings-available-balance', userAddress || ''],
  });

  // Total portfolio value
  const portfolioValue = useContractRead({
    address: contractAddress,
    abi: SAVINGS_VAULT_ABI,
    functionName: 'portfolioValue',
    args: userAddress ? [userAddress] : undefined,
    enabled: !!userAddress,
    queryKey: ['savings-portfolio-value', userAddress || ''],
  });

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
  const contractAddress = getContractAddress(BASE_SEPOLIA_CHAIN_ID, 'SavingsVault');
  
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
      if (!amount || isNaN(Number(amount))) {
        throw new Error('Invalid amount');
      }

      const amountWei = parseUnits(amount, 18); // Assuming 18 decimals for stablecoin
      
      writeContract({
        address: contractAddress,
        abi: SAVINGS_VAULT_ABI,
        functionName: 'deposit',
        args: [amountWei],
      });
    },
    [writeContract, contractAddress]
  );

  return {
    deposit,
    hash,
    isLoading: isWritePending || isConfirming,
    isSuccess: isConfirmed,
    error: writeError || receiptError,
    reset: resetWrite,
  };
}

/**
 * Hook for SavingsVault withdraw operations with transaction handling.
 * Implements Requirements 4.3 for signed withdraw transactions.
 */
export function useSavingsVaultWithdraw() {
  const contractAddress = getContractAddress(BASE_SEPOLIA_CHAIN_ID, 'SavingsVault');
  
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
      if (!amount || isNaN(Number(amount))) {
        throw new Error('Invalid amount');
      }

      const amountWei = parseUnits(amount, 18); // Assuming 18 decimals for stablecoin
      
      writeContract({
        address: contractAddress,
        abi: SAVINGS_VAULT_ABI,
        functionName: 'withdraw',
        args: [amountWei],
      });
    },
    [writeContract, contractAddress]
  );

  return {
    withdraw,
    hash,
    isLoading: isWritePending || isConfirming,
    isSuccess: isConfirmed,
    error: writeError || receiptError,
    reset: resetWrite,
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
export function validateAmount(amount: string, maxAmount?: bigint): { isValid: boolean; error?: string } {
  if (!amount || amount.trim() === '') {
    return { isValid: false, error: 'Amount is required' };
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return { isValid: false, error: 'Amount must be a positive number' };
  }

  if (maxAmount !== undefined) {
    const amountWei = parseUnits(amount, 18);
    if (amountWei > maxAmount) {
      return { isValid: false, error: 'Insufficient balance' };
    }
  }

  return { isValid: true };
}