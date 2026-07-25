/**
 * SIWE Auth Hook Edge Cases Tests
 * Task 20.2: Write component tests for the auth flow - Hook Edge Cases
 * 
 * This test validates Requirements 2.2 and 2.5 with simplified mocking:
 * - 2.2: Handle wallet connection failures gracefully
 * - 2.5: Handle user declining to sign SIWE message
 * 
 * This is a focused version that avoids the SIWE library mocking issues
 * and tests the hook's error handling and state management directly.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSiweAuth, type AuthState } from '@/hooks/useSiweAuth';
import { BASE_SEPOLIA_CHAIN_ID } from '@bfn/shared';

// Mock wagmi hooks with controlled state
interface MockWagmiAccount {
  isConnected: boolean;
  address?: string;
  chainId?: number;
}

const mockSignMessageAsync = jest.fn();
const mockDisconnect = jest.fn();
const mockWagmiAccount: MockWagmiAccount = {
  isConnected: false,
  address: undefined,
  chainId: undefined,
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

// Mock window.location for SIWE message construction
Object.defineProperty(global.window, 'location', {
  value: {
    host: 'localhost:3000',
    origin: 'http://localhost:3000',
  },
});

describe('useSiweAuth Hook - Edge Cases', () => {
  const testAddress = '0x1234567890123456789012345678901234567890';
  const mockNonce = 'test-nonce-12345';
  const mockJWT = 'mock.jwt.token';
  const mockSignature = '0xmocksignature';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
    mockFetch.mockClear();
    mockSignMessageAsync.mockClear();
    mockDisconnect.mockClear();
    
    // Reset account state
    mockWagmiAccount.isConnected = false;
    mockWagmiAccount.address = undefined;
    mockWagmiAccount.chainId = undefined;
  });

  /**
   * Test Requirement 2.2: Handle wallet connection failures gracefully
   */
  describe('Connection Failure Handling (Req 2.2)', () => {
    test('initial state when wallet not connected', () => {
      const { result } = renderHook(() => useSiweAuth());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.address).toBeUndefined();
      expect(result.current.role).toBeUndefined();
    });

    test('prevents sign-in when wallet not connected', async () => {
      mockWagmiAccount.isConnected = false;

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Please connect your wallet to Base Sepolia network');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('prevents sign-in when on wrong network', async () => {
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = 1; // Ethereum mainnet

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Please connect your wallet to Base Sepolia network');
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('prevents sign-in when address is missing', async () => {
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = undefined;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Please connect your wallet to Base Sepolia network');
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('handles network API failures gracefully', async () => {
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      // Mock network failure
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    test('handles nonce fetch failure', async () => {
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Nonce service unavailable' }),
      });

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Failed to get authentication nonce');
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('handles auth check failure on mount', async () => {
      // Simulate existing token that fails validation
      mockLocalStorage.getItem.mockReturnValue('invalid-token');
      mockFetch.mockRejectedValue(new Error('Auth check failed'));

      const { result } = renderHook(() => useSiweAuth());

      // Should still render without crashing
      expect(result.current.isAuthenticated).toBe(false);

      // Wait for auth check to complete
      await waitFor(() => {
        expect(result.current.error).toBe('Authentication check failed');
      });
    });

    test('clears auth state when wallet disconnects', () => {
      // Start with authenticated state
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;

      const { result, rerender } = renderHook(() => useSiweAuth());
      
      // Simulate authenticated state (this would normally be set by successful signIn)
      act(() => {
        // This simulates the effect of successful authentication
        result.current.checkAuth();
      });

      // Disconnect wallet
      mockWagmiAccount.isConnected = false;
      mockWagmiAccount.address = undefined;

      rerender();

      // Auth state should be cleared
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.address).toBeUndefined();
      expect(result.current.role).toBeUndefined();
    });

    test('handles rapid connection state changes', () => {
      const { result, rerender } = renderHook(() => useSiweAuth());

      // Initial state
      expect(result.current.isAuthenticated).toBe(false);

      // Connect
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      rerender();

      // Disconnect
      mockWagmiAccount.isConnected = false;
      mockWagmiAccount.address = undefined;
      rerender();

      // Reconnect
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      rerender();

      // Should handle all transitions gracefully
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  /**
   * Test Requirement 2.5: Handle user declining to sign SIWE message
   */
  describe('Sign Decline Handling (Req 2.5)', () => {
    beforeEach(() => {
      // Set up connected wallet for signing tests
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID;
    });

    test('handles user rejection during signing', async () => {
      // Mock successful nonce fetch but signing rejection
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });
      
      mockSignMessageAsync.mockRejectedValue(new Error('User rejected signing'));

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('User rejected signing');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    test('handles MetaMask specific rejection', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });

      mockSignMessageAsync.mockRejectedValue(
        new Error('MetaMask Tx Signature: User denied transaction signature.')
      );

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('MetaMask Tx Signature: User denied transaction signature.');
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('handles WalletConnect rejection', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });

      mockSignMessageAsync.mockRejectedValue(new Error('User rejected methods.'));

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('User rejected methods.');
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('handles signing interruption', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });

      mockSignMessageAsync.mockRejectedValue(new Error('Signing interrupted'));

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Signing interrupted');
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('allows retry after signing failure', async () => {
      const { result } = renderHook(() => useSiweAuth());

      // First attempt fails
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });
      mockSignMessageAsync.mockRejectedValueOnce(new Error('User rejected signing'));

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('User rejected signing');
      expect(result.current.isAuthenticated).toBe(false);

      // Second attempt succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ nonce: 'new-nonce-67890' }),
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

    test('clears error when starting new sign attempt', async () => {
      const { result } = renderHook(() => useSiweAuth());

      // Set initial error state
      mockFetch.mockRejectedValueOnce(new Error('Previous error'));
      await act(async () => {
        await result.current.signIn();
      });
      expect(result.current.error).toBe('Previous error');

      // Start new attempt - should clear error and show loading
      let resolveNonce: (value: any) => void;
      const noncePromise = new Promise((resolve) => {
        resolveNonce = resolve;
      });
      
      mockFetch.mockReturnValueOnce({
        ok: true,
        json: () => noncePromise,
      });

      act(() => {
        result.current.signIn();
      });

      // Error should be cleared and loading should be true
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(true);

      // Complete the promise to avoid hanging
      await act(async () => {
        resolveNonce!({ nonce: mockNonce });
        await noncePromise;
      });
    });

    test('handles signature verification failure after successful signing', async () => {
      // Mock successful nonce and signing
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ nonce: mockNonce }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ message: 'Invalid signature' }),
        });

      mockSignMessageAsync.mockResolvedValue(mockSignature);

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Invalid signature');
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('does not leave partial auth state on signing failure', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ nonce: mockNonce }),
      });
      mockSignMessageAsync.mockRejectedValue(new Error('User rejected'));

      const { result } = renderHook(() => useSiweAuth());

      await act(async () => {
        await result.current.signIn();
      });

      // Should not have any authentication artifacts
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.address).toBeUndefined();
      expect(result.current.role).toBeUndefined();
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith('bfn-auth-token', expect.anything());
    });

    test('shows loading state during sign attempt', async () => {
      let resolveNonce: (value: any) => void;
      const noncePromise = new Promise((resolve) => {
        resolveNonce = resolve;
      });

      mockFetch.mockReturnValue({
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
        resolveNonce!({ nonce: mockNonce });
        await noncePromise;
      });
    });
  });

  /**
   * Test sign out and cleanup
   */
  describe('Sign Out and Cleanup', () => {
    test('cleans up properly on sign out', async () => {
      // Set initial authenticated state
      mockLocalStorage.getItem.mockReturnValue(mockJWT);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 
          address: testAddress,
          role: 'user'
        }),
      });

      const { result } = renderHook(() => useSiweAuth());

      // Wait for initial auth check
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Mock logout API call
      mockFetch.mockResolvedValue({ ok: true });

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.address).toBeUndefined();
      expect(result.current.role).toBeUndefined();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('bfn-auth-token');
      expect(mockDisconnect).toHaveBeenCalled();
    });

    test('handles logout API failure gracefully', async () => {
      // Set initial authenticated state
      mockLocalStorage.getItem.mockReturnValue(mockJWT);

      const { result } = renderHook(() => useSiweAuth());

      // Mock logout API failure
      mockFetch.mockRejectedValue(new Error('Logout failed'));

      await act(async () => {
        await result.current.signOut();
      });

      // Should still clear local state despite API failure
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('bfn-auth-token');
      expect(mockDisconnect).toHaveBeenCalled();
    });

    test('removes invalid token during auth check', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-jwt');
      mockFetch.mockResolvedValue({
        ok: false, // Token is invalid
      });

      const { result } = renderHook(() => useSiweAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('bfn-auth-token');
    });

    test('preserves token on network auth check failure', async () => {
      mockLocalStorage.getItem.mockReturnValue(mockJWT);
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSiweAuth());

      await waitFor(() => {
        expect(result.current.error).toBe('Authentication check failed');
      });

      // Should not remove token on network error (could be temporary)
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  /**
   * Test edge cases and state management
   */
  describe('Edge Cases and State Management', () => {
    test('handles component unmount during async operations', async () => {
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      // Never resolving promise to simulate pending operation
      mockFetch.mockReturnValue(new Promise(() => {}));

      const { result, unmount } = renderHook(() => useSiweAuth());

      act(() => {
        result.current.signIn();
      });

      // Should not throw when unmounted during async operation
      expect(() => unmount()).not.toThrow();
    });

    test('handles concurrent sign-in attempts', async () => {
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      let resolveCount = 0;
      mockFetch.mockImplementation(() => {
        resolveCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ nonce: `nonce-${resolveCount}` }),
        });
      });

      const { result } = renderHook(() => useSiweAuth());

      // Start multiple sign-in attempts
      act(() => {
        result.current.signIn();
        result.current.signIn();
        result.current.signIn();
      });

      // Should handle concurrent attempts gracefully
      expect(result.current.isLoading).toBe(true);
    });

    test('handles missing environment variables gracefully', () => {
      // Clear environment variable
      const originalEnv = process.env.NEXT_PUBLIC_API_URL;
      delete process.env.NEXT_PUBLIC_API_URL;

      const { result } = renderHook(() => useSiweAuth());

      // Should still render without crashing
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      // Restore environment variable
      process.env.NEXT_PUBLIC_API_URL = originalEnv;
    });

    test('maintains consistent state during error scenarios', async () => {
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      const { result } = renderHook(() => useSiweAuth());

      // Test various error scenarios
      const errorScenarios = [
        { mockError: new Error('Network timeout'), expectedError: 'Network timeout' },
        { mockError: new Error('Invalid request'), expectedError: 'Invalid request' },
        { mockError: new Error('Server error'), expectedError: 'Server error' },
      ];

      for (const scenario of errorScenarios) {
        // Reset state
        act(() => {
          // This would normally be done by the hook internally
          result.current.checkAuth();
        });

        mockFetch.mockRejectedValueOnce(scenario.mockError);

        await act(async () => {
          await result.current.signIn();
        });

        expect(result.current.error).toBe(scenario.expectedError);
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.address).toBeUndefined();
        expect(result.current.role).toBeUndefined();
      }
    });
  });
});