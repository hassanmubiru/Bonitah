'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';

import { useSiweAuth } from './useSiweAuth';
import { BASE_SEPOLIA_CHAIN_ID } from '@bfn/shared';

/**
 * Authentication guard hook that manages authentication state.
 * 
 * Note: Redirects are handled by individual pages to prevent loops.
 */
export function useAuthGuard() {
  const { isConnected, chainId } = useAccount();
  const { isAuthenticated, isLoading, checkAuth } = useSiweAuth();

  const isOnCorrectNetwork = chainId === BASE_SEPOLIA_CHAIN_ID;

  useEffect(() => {
    // Check authentication status on mount and when wallet connects
    if (isConnected) {
      checkAuth();
    }
  }, [isConnected, checkAuth]);

  return {
    isAuthenticated,
    isLoading,
    isOnCorrectNetwork,
    isConnected,
  };
}
