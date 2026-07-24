'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';

import { useSiweAuth } from './useSiweAuth';
import { BASE_SEPOLIA_CHAIN_ID } from '@bfn/shared';

/**
 * Authentication guard hook that redirects unauthenticated users to auth page.
 *
 * Implements session management and authentication enforcement:
 * - Checks wallet connection and network
 * - Verifies SIWE authentication status
 * - Redirects to /auth if not authenticated
 * - Returns loading state during checks
 */
export function useAuthGuard() {
  const router = useRouter();
  const { isConnected, chainId } = useAccount();
  const { isAuthenticated, isLoading, checkAuth } = useSiweAuth();

  const isOnCorrectNetwork = chainId === BASE_SEPOLIA_CHAIN_ID;

  useEffect(() => {
    // Check authentication status on mount
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // If not loading and not authenticated, redirect to auth
    if (!isLoading && !isAuthenticated) {
      router.push('/auth');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    // If wallet disconnects or wrong network, redirect to auth
    if (!isConnected || !isOnCorrectNetwork) {
      router.push('/auth');
    }
  }, [isConnected, isOnCorrectNetwork, router]);

  return {
    isAuthenticated,
    isLoading: isLoading || !isConnected || !isOnCorrectNetwork,
    isOnCorrectNetwork,
  };
}
