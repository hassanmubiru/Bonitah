'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { SiweMessage } from 'siwe';

import { BASE_SEPOLIA_CHAIN_ID } from '@/lib/shared';

/**
 * Authentication state for SIWE (Sign-In With Ethereum) flow.
 */
export interface AuthState {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether authentication is in progress */
  isLoading: boolean;
  /** Authentication error if any */
  error: string | null;
  /** Authenticated user's address if signed in */
  address?: string | undefined;
  /** User's role if signed in */
  role?: string | undefined;
}

/**
 * SIWE authentication hook providing wallet-based sign-in functionality.
 *
 * Implements Requirements 2.4-2.10 for wallet connection and authentication:
 * - Generates SIWE message with backend-issued nonce
 * - Requests signature from connected wallet
 * - Verifies signature with backend to establish session
 * - Manages JWT token for authenticated requests
 * - Handles session expiry and logout
 */
export function useSiweAuth() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true, // Start in loading state
    error: null,
  });

  // Use refs to track state and prevent multiple calls
  const isCheckingAuth = useRef(false);
  const hasInitialized = useRef(false);

  /**
   * Check if current JWT is valid and get user info
   */
  const checkAuth = useCallback(async () => {
    // Prevent multiple simultaneous auth checks
    if (isCheckingAuth.current) {
      return;
    }

    isCheckingAuth.current = true;
    setAuthState((prev) => ({ ...prev, isLoading: true }));

    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3002';
    const token = localStorage.getItem('bfn-auth-token');

    if (!token) {
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      isCheckingAuth.current = false;
      hasInitialized.current = true;
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const user = await response.json();
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          error: null,
          address: user.address,
          role: user.role,
        });
      } else {
        // Token invalid, remove it
        localStorage.removeItem('bfn-auth-token');
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('bfn-auth-token');
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } finally {
      isCheckingAuth.current = false;
      hasInitialized.current = true;
    }
  }, []); // No dependencies to keep function stable

  /**
   * Sign in with connected wallet using SIWE
   */
  const signIn = useCallback(async () => {
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3002';

    if (!address || !isConnected) {
      setAuthState((prev) => ({
        ...prev,
        error: 'Please connect your wallet first',
      }));
      return;
    }

    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Step 1: Get nonce from backend (Req 2.4)
      const nonceResponse = await fetch(`${apiUrl}/auth/nonce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });

      if (!nonceResponse.ok) {
        throw new Error('Failed to get authentication nonce');
      }

      const { nonce } = await nonceResponse.json();

      // Step 2: Create SIWE message (Req 2.4)
      const domain = window.location.host;
      const origin = window.location.origin;
      const statement = 'Sign in to Bonitah Financial Network';

      const message = new SiweMessage({
        domain,
        address,
        statement,
        uri: origin,
        version: '1',
        chainId: chainId || BASE_SEPOLIA_CHAIN_ID,
        nonce,
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      });

      const messageString = message.prepareMessage();

      // Step 3: Request signature from wallet (Req 2.4, 2.5)
      const signature = await signMessageAsync({
        message: messageString,
      });

      // Step 4: Verify signature with backend (Req 2.6-2.8)
      const verifyResponse = await fetch(`${apiUrl}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageString,
          signature,
        }),
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.message || 'Authentication verification failed');
      }

      const { jwt, address: authAddress, role } = await verifyResponse.json();

      // Store JWT for future requests (Req 2.7)
      localStorage.setItem('bfn-auth-token', jwt);

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        address: authAddress,
        role,
      });
    } catch (error) {
      console.error('SIWE authentication failed:', error);
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      }));
    }
  }, [address, isConnected, chainId, signMessageAsync]);

  /**
   * Sign out and clear session
   */
  const signOut = useCallback(async () => {
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3002';

    try {
      const token = localStorage.getItem('bfn-auth-token');
      if (token) {
        // Notify backend of logout
        await fetch(`${apiUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Clear local state regardless of backend response
      localStorage.removeItem('bfn-auth-token');
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      disconnect();
    }
  }, [disconnect]);

  // Check authentication only on mount
  useEffect(() => {
    if (!hasInitialized.current) {
      checkAuth();
    }
  }, []); // Empty dependency array - only run on mount

  // Clear auth state if wallet disconnects, but don't re-check
  useEffect(() => {
    if (!isConnected && hasInitialized.current) {
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, [isConnected]);

  return {
    ...authState,
    signIn,
    signOut,
    checkAuth,
  };
}
