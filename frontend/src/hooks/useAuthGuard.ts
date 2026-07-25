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
    // Only check authentication when wallet connects AND we're not already authenticated
    if (isConnected && !isAuthenticated && !isLoading) {
      checkAuth();
    }
  }, [isConnected, isAuthenticated, isLoading, checkAuth]);

  return {
    isAuthenticated,
    isLoading,
    isOnCorrectNetwork,
    isConnected,
  };
}
