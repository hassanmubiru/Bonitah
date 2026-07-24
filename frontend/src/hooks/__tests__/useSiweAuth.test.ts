/**
 * Hook Tests for SIWE Authentication
 * Task 20.2: Write component tests for the auth flow - Hook Testing
 * 
 * This test validates Requirements 2.2 and 2.5:
 * - 2.2: Handle wallet connection failures gracefully  
 * - 2.5: Handle user declining to sign SIWE message
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { type Address } from 'viem';

import { useSiweAuth } from '@/hooks/useSiweAuth';
import { BASE_SEPOLIA_CHAIN_ID } from '@bfn/shared';

// Mock wagmi hooks
const mockSignMessageAsync = jest.fn();
const mockDisconnect = jest.fn();
const mockWagmiAccount = {
  isConnected: true,
  address: '0x1234567890123456789012345678901234567890' as Address,
  chainId: BASE_SEPOLIA_CHAIN_ID,
};

jest.mock('wagmi', () => ({
  useAccount: () => mockWagmiAccount,
  useSignMessage: () => ({
    signMessageAsync: mockSignMessageAsync,
  }),
  useDisconnect: () => ({
    disconnect: mockDisconnect,
  }),
}));

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
});

// Mock environment variable
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';

describe('useSiweAuth Hook Tests', () => {
  const testAddress = '0x1234567890123456789012345678901234567890' as Address;
  const mockNonce = 'test-nonce-12345';
  const mockJWT = 'mock.jwt.token';
  const mockSignature = '0xmocksignature';

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
    
    // Reset wagmi account state
    mockWagmiAccount.isConnected = true;
    mockWagmiAccount.address = testAddress;
    mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID;
    
    // Reset fetch mock
    mockFetch.mockClear();
  });

  /**
   * Test Requirement 2.2: Handle wallet connection failures gracefully
   */
  describe('Connection Failure Handling (Req 2.2)', () => {
    it('handles wallet not connected gracefully', async () => {
      mockWagmiAccount.isConnected = false;
      mockWagmiAccount.address = undefined;

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Please connect your wallet to Base Sepolia network');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('handles wrong network gracefully', async () => {
      mockWagmiAccount.chainId = 1; // Ethereum Mainnet

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Please connect your wallet to Base Sepolia network');
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles missing address gracefully', async () => {
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = undefined;

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Please connect your wallet to Base Sepolia network');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('handles network disconnection during auth process', async () => {
      const { result } = renderHook(() => useSiweAuth());

      // Start with connected wallet
      expect(result.current.isAuthenticated).toBe(false);

      // Disconnect wallet
      act(() => {
        mockWagmiAccount.isConnected = false;
        mockWagmiAccount.address = undefined;
      });

      // Re-render to trigger useEffect
      const { result: newResult } = renderHook(() => useSiweAuth());

      expect(newResult.current.isAuthenticated).toBe(false);
      expect(newResult.current.address).toBeUndefined();
    });

    it('prevents authentication when wallet connection is unstable', async () => {
      // Simulate unstable connection
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;

      const { result, rerender } = renderHook(() => useSiweAuth());

      // Start sign-in process
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });

      await act(async () => {
        // Disconnect wallet during sign-in
        mockWagmiAccount.isConnected = false;
        mockWagmiAccount.address = undefined;
        
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Please connect your wallet to Base Sepolia network');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('handles API connection failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Network request failed');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('handles nonce generation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Nonce generation failed' }),
      });

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Failed to get authentication nonce');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('handles backend API downtime gracefully', async () => {
      // Mock fetch timeout/connection refused
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('ECONNREFUSED');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  /**
   * Test Requirement 2.5: Handle user declining to sign SIWE message
   */
  describe('Sign Decline Handling (Req 2.5)', () => {
    it('handles user rejecting signature request', async () => {
      // Mock successful nonce fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });

      // Mock user rejection
      mockSignMessageAsync.mockRejectedValueOnce(new Error('User rejected signing'));

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('User rejected signing');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('handles MetaMask user denial', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });

      // Mock MetaMask-specific rejection
      mockSignMessageAsync.mockRejectedValueOnce(
        new Error('MetaMask Tx Signature: User denied transaction signature.')
      );

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('MetaMask Tx Signature: User denied transaction signature.');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('handles WalletConnect user rejection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });

      mockSignMessageAsync.mockRejectedValueOnce(
        new Error('User rejected methods.')
      );

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('User rejected methods.');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('allows retry after user declines signing', async () => {
      const { result } = renderHook(() => useSiweAuth());

      // First attempt - user declines
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });
      mockSignMessageAsync.mockRejectedValueOnce(new Error('User rejected signing'));

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('User rejected signing');

      // Second attempt - user accepts
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ nonce: 'new-nonce-12345' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            jwt: mockJWT, 
            address: testAddress,
            role: 'user'
          }),
        });
      mockSignMessageAsync.mockResolvedValueOnce(mockSignature);

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.address).toBe(testAddress);
    });

    it('clears previous errors when starting new sign-in attempt', async () => {
      const { result } = renderHook(() => useSiweAuth());

      // Set initial error state
      mockFetch.mockRejectedValueOnce(new Error('Initial error'));
      
      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Initial error');

      // Start new attempt - should clear error and show loading
      mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Pending promise

      act(() => {
        result.current.signIn();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(true);
    });

    it('handles signature validation failure after successful signing', async () => {
      // Mock successful nonce and signing
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });
      mockSignMessageAsync.mockResolvedValueOnce(mockSignature);

      // Mock signature verification failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid signature format' }),
      });

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Invalid signature format');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('preserves wallet connection state when signing fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });
      mockSignMessageAsync.mockRejectedValueOnce(new Error('User rejected signing'));

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      // Wallet should still be connected even though signing failed
      expect(mockWagmiAccount.isConnected).toBe(true);
      expect(mockWagmiAccount.address).toBe(testAddress);
      
      // But authentication should have failed
      expect(result.current.error).toBe('User rejected signing');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('handles signing interruption gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });

      // Mock signing interruption (e.g., wallet closed)
      mockSignMessageAsync.mockRejectedValueOnce(new Error('Wallet connection interrupted'));

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Wallet connection interrupted');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('does not leave partial authentication state on sign failure', async () => {
      const { result } = renderHook(() => useSiweAuth());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });
      mockSignMessageAsync.mockRejectedValueOnce(new Error('User rejected signing'));

      await act(async () => {
        await result.current.signIn();
      });

      // Should not have any authentication artifacts
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.address).toBeUndefined();
      expect(result.current.role).toBeUndefined();
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith('bfn-auth-token', expect.anything());
    });
  });

  /**
   * Test successful authentication flow for comparison
   */
  describe('Successful Authentication (Control Tests)', () => {
    it('completes successful authentication flow', async () => {
      // Mock all successful responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ nonce: mockNonce }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            jwt: mockJWT, 
            address: testAddress,
            role: 'user'
          }),
        });
      mockSignMessageAsync.mockResolvedValueOnce(mockSignature);

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.address).toBe(testAddress);
      expect(result.current.role).toBe('user');
      expect(result.current.isLoading).toBe(false);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('bfn-auth-token', mockJWT);
    });

    it('shows loading state during authentication process', async () => {
      let resolveNonce: (value: any) => void;
      const noncePromise = new Promise((resolve) => {
        resolveNonce = resolve;
      });

      mockFetch.mockReturnValueOnce({
        ok: true,
        json: () => noncePromise,
      });

      const { result } = renderHook(() => useSiweAuth());

      // Start sign-in
      act(() => {
        result.current.signIn();
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();

      // Complete the process
      await act(async () => {
        resolveNonce({ nonce: mockNonce });
        await noncePromise;
      });
    });

    it('checks existing authentication on mount', async () => {
      mockLocalStorage.getItem.mockReturnValueOnce(mockJWT);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          address: testAddress,
          role: 'user'
        }),
      });

      const { result } = renderHook(() => useSiweAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(result.current.address).toBe(testAddress);
      expect(result.current.role).toBe('user');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/auth/me', {
        headers: {
          Authorization: `Bearer ${mockJWT}`,
        },
      });
    });
  });

  /**
   * Test error recovery and cleanup
   */
  describe('Error Recovery and Cleanup', () => {
    it('removes invalid token on auth check failure', async () => {
      mockLocalStorage.getItem.mockReturnValueOnce('invalid-jwt');
      mockFetch.mockResolvedValueOnce({
        ok: false, // Invalid token response
      });

      const { result } = renderHook(() => useSiweAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('bfn-auth-token');
    });

    it('handles auth check network failures gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValueOnce(mockJWT);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSiweAuth());

      await waitFor(() => {
        expect(result.current.error).toBe('Authentication check failed');
      });

      // Should not remove token on network error (could be temporary)
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });

    it('cleans up properly on sign out', async () => {
      // Set initial authenticated state
      mockLocalStorage.getItem.mockReturnValueOnce(mockJWT);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          address: testAddress,
          role: 'user'
        }),
      });

      const { result } = renderHook(() => useSiweAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Mock logout API call
      mockFetch.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.address).toBeUndefined();
      expect(result.current.role).toBeUndefined();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('bfn-auth-token');
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});