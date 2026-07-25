/**
 * Fixed Component Tests for Authentication Flow
 * Task 20.2: Write component tests for the auth flow
 * 
 * This test validates Requirements 2.2, 2.3, and 2.5:
 * - 2.2: Handle wallet connection failures gracefully
 * - 2.3: Prompt user to switch to Base Sepolia when on wrong network
 * - 2.5: Handle user declining to sign SIWE message
 * 
 * This is a focused version that fixes the mocking issues in the existing tests
 * and ensures proper coverage of the required failure scenarios.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BASE_SEPOLIA_CHAIN_ID } from '@bfn/shared';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock wagmi hooks with proper typing
interface MockAccount {
  address?: string;
  isConnected: boolean;
  chainId?: number;
}

const mockAccount: MockAccount = {
  isConnected: false,
  address: undefined,
  chainId: undefined,
};

jest.mock('wagmi', () => ({
  useAccount: () => mockAccount,
}));

// Mock the SIWE auth hook with controllable state
interface MockAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  address?: string;
  role?: string;
}

const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockCheckAuth = jest.fn();

let mockAuthState: MockAuthState = {
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

jest.mock('@/hooks/useSiweAuth', () => ({
  useSiweAuth: () => ({
    ...mockAuthState,
    signIn: mockSignIn,
    signOut: mockSignOut,
    checkAuth: mockCheckAuth,
  }),
}));

// Mock NetworkGuard to simulate wrong network scenarios
let mockShowNetworkGuard = false;
jest.mock('@/components/NetworkGuard', () => ({
  NetworkGuard: ({ children, onNetworkSwitched }: { 
    children: React.ReactNode;
    onNetworkSwitched?: () => void;
  }) => {
    if (mockShowNetworkGuard) {
      return (
        <div data-testid="wrong-network-ui">
          <div role="heading" aria-level={1}>Wrong Network</div>
          <div>You're connected to the wrong network. Please switch to Base Sepolia.</div>
          <button 
            onClick={() => {
              // Simulate successful network switch
              mockShowNetworkGuard = false;
              onNetworkSwitched?.();
            }}
          >
            Switch to Base Sepolia
          </button>
        </div>
      );
    }
    return <div data-testid="network-guard">{children}</div>;
  },
}));

// Mock RainbowKit ConnectButton
let mockConnectButtonError = false;
jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => {
    if (mockConnectButtonError) {
      return (
        <div data-testid="connect-button-error">
          <div>Failed to connect wallet</div>
          <button disabled>Connection Failed</button>
        </div>
      );
    }
    return (
      <button 
        data-testid="connect-button"
        onClick={() => {
          // Simulate wallet connection
          if (!mockConnectButtonError) {
            mockAccount.isConnected = true;
            mockAccount.address = testAddress;
            mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;
          }
        }}
      >
        Connect Wallet
      </button>
    );
  },
}));

// Import the component after mocks are set up
import AuthPage from '@/app/auth/page';

describe('Auth Flow Component Tests - Fixed', () => {
  const testAddress = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset state
    mockAuthState = {
      isAuthenticated: false,
      isLoading: false,
      error: null,
    };
    
    mockAccount.isConnected = false;
    mockAccount.address = undefined;
    mockAccount.chainId = undefined;
    
    mockShowNetworkGuard = false;
    mockConnectButtonError = false;
    mockPush.mockClear();
  });

  /**
   * Test Requirement 2.2: Handle wallet connection failures gracefully
   */
  describe('Connect Failure Tests (Req 2.2)', () => {
    test('displays connection step when wallet is not connected', () => {
      render(<AuthPage />);

      // Should show connection step
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByTestId('connect-button')).toBeInTheDocument();

      // Should NOT show authentication step
      expect(screen.queryByText('Step 2: Sign Authentication Message')).not.toBeInTheDocument();
      
      // Should NOT show connected wallet info
      expect(screen.queryByText('Wallet Connected')).not.toBeInTheDocument();
    });

    test('handles wallet connection failure gracefully', () => {
      // Simulate connection error
      mockConnectButtonError = true;

      render(<AuthPage />);

      // Should still show the connection step
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      
      // ConnectButton should handle its own error state
      expect(screen.getByTestId('connect-button-error')).toBeInTheDocument();
      
      // Page should remain stable despite connection failure
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.queryByText('Step 2: Sign Authentication Message')).not.toBeInTheDocument();
    });

    test('recovers from wallet disconnection during flow', () => {
      // Start with connected wallet
      mockAccount.isConnected = true;
      mockAccount.address = testAddress;
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      const { rerender } = render(<AuthPage />);

      // Should show both steps when connected
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();

      // Simulate disconnection
      mockAccount.isConnected = false;
      mockAccount.address = undefined;
      mockAccount.chainId = undefined;

      rerender(<AuthPage />);

      // Should revert to connection-only state
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.queryByText('Step 2: Sign Authentication Message')).not.toBeInTheDocument();
      expect(screen.queryByText('Wallet Connected')).not.toBeInTheDocument();
    });

    test('shows inactive step indicators for connection failures', () => {
      render(<AuthPage />);

      // Connection step should show inactive indicator (gray)
      const stepText = screen.getByText('Step 1: Connect Your Wallet');
      const stepIndicator = stepText.parentElement?.querySelector('.h-2.w-2.rounded-full');
      
      expect(stepIndicator).toHaveClass('bg-gray-300');
      expect(stepIndicator).not.toHaveClass('bg-green-500');
    });

    test('maintains UI stability during connection attempts', () => {
      const { rerender } = render(<AuthPage />);

      // Basic UI should always be present
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();

      // Simulate various connection states
      mockConnectButtonError = true;
      rerender(<AuthPage />);
      
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();

      mockConnectButtonError = false;
      mockAccount.isConnected = true;
      rerender(<AuthPage />);
      
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
    });
  });

  /**
   * Test Requirement 2.3: Wrong network detection and Base Sepolia switch prompts
   */
  describe('Wrong Network Tests (Req 2.3)', () => {
    test('displays wrong network UI when connected to incorrect network', () => {
      // Simulate wrong network
      mockShowNetworkGuard = true;
      mockAccount.isConnected = true;
      mockAccount.address = testAddress;
      mockAccount.chainId = 1; // Ethereum mainnet

      render(<AuthPage />);

      // Should show wrong network UI instead of auth flow
      expect(screen.getByTestId('wrong-network-ui')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Wrong Network' })).toBeInTheDocument();
      expect(screen.getByText(/switch to Base Sepolia/i)).toBeInTheDocument();
      
      // Should NOT show normal auth flow
      expect(screen.queryByText('Welcome to BFN')).not.toBeInTheDocument();
      expect(screen.queryByText('Step 1: Connect Your Wallet')).not.toBeInTheDocument();
    });

    test('allows user to switch networks', async () => {
      const user = userEvent.setup();
      
      // Start with wrong network
      mockShowNetworkGuard = true;
      mockAccount.isConnected = true;
      mockAccount.address = testAddress;
      mockAccount.chainId = 1; // Wrong network

      const { rerender } = render(<AuthPage />);

      // Should show wrong network UI
      expect(screen.getByTestId('wrong-network-ui')).toBeInTheDocument();
      
      // Click switch network button
      const switchButton = screen.getByText('Switch to Base Sepolia');
      await user.click(switchButton);

      // Simulate successful switch (component will re-render)
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;
      rerender(<AuthPage />);

      // Should now show normal auth flow
      expect(screen.queryByTestId('wrong-network-ui')).not.toBeInTheDocument();
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
    });

    test('renders normal auth flow when on correct network', () => {
      // Simulate correct network
      mockShowNetworkGuard = false;
      mockAccount.isConnected = true;
      mockAccount.address = testAddress;
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      render(<AuthPage />);

      // Should show normal auth flow
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
      
      // Should NOT show wrong network UI
      expect(screen.queryByTestId('wrong-network-ui')).not.toBeInTheDocument();
    });

    test('blocks auth actions when on wrong network', () => {
      // Wrong network should block the entire auth flow
      mockShowNetworkGuard = true;
      mockAccount.isConnected = true;
      mockAccount.address = testAddress;
      mockAccount.chainId = 1;

      render(<AuthPage />);

      // Should show blocking network UI
      expect(screen.getByTestId('wrong-network-ui')).toBeInTheDocument();
      
      // Should not be able to access sign-in
      expect(screen.queryByRole('button', { name: /sign in with ethereum/i })).not.toBeInTheDocument();
      expect(screen.queryByText('Step 2: Sign Authentication Message')).not.toBeInTheDocument();
    });
  });

  /**
   * Test Requirement 2.5: Handle user declining to sign SIWE message
   */
  describe('Sign Decline Tests (Req 2.5)', () => {
    beforeEach(() => {
      // Set up connected wallet for signing tests
      mockAccount.isConnected = true;
      mockAccount.address = testAddress;
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;
    });

    test('displays error when user declines to sign SIWE message', () => {
      // Mock signing rejection
      mockAuthState.error = 'User rejected signing';

      render(<AuthPage />);

      // Should show both steps (wallet connected, but signing failed)
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
      
      // Should show wallet as connected
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      expect(screen.getByText(`${testAddress.slice(0, 6)}...${testAddress.slice(-4)}`)).toBeInTheDocument();

      // Should display the error message
      expect(screen.getByText('User rejected signing')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('User rejected signing');

      // Step 1 should show as completed (green)
      const step1Indicator = screen.getByText('Step 1: Connect Your Wallet')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(step1Indicator).toHaveClass('bg-green-500');
    });

    test('handles different types of user rejection gracefully', () => {
      const errorScenarios = [
        'User rejected signing',
        'MetaMask Tx Signature: User denied transaction signature.',
        'User rejected methods.', // WalletConnect
        'User denied transaction signature', // Generic
        'Signing cancelled by user',
      ];

      errorScenarios.forEach((errorMessage) => {
        mockAuthState.error = errorMessage;

        const { unmount } = render(<AuthPage />);

        // Should display the specific error
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);

        // Wallet should remain connected
        expect(screen.getByText('Wallet Connected')).toBeInTheDocument();

        // Sign-in should still be available
        expect(screen.getByRole('button', { name: /sign in with ethereum/i })).toBeEnabled();

        unmount();
      });
    });

    test('allows retry after user declines signing', async () => {
      const user = userEvent.setup();

      // Start with error state
      mockAuthState.error = 'User rejected signing';
      const { rerender } = render(<AuthPage />);

      // Should show error
      expect(screen.getByText('User rejected signing')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Clear error for retry scenario
      mockAuthState.error = null;
      rerender(<AuthPage />);

      // Error should be gone
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('User rejected signing')).not.toBeInTheDocument();

      // Should be able to retry
      const signInButton = screen.getByRole('button', { name: /sign in with ethereum/i });
      expect(signInButton).toBeEnabled();

      await user.click(signInButton);
      expect(mockSignIn).toHaveBeenCalled();
    });

    test('preserves wallet connection state despite signing errors', () => {
      mockAuthState.error = 'User rejected signing';

      render(<AuthPage />);

      // Wallet connection should be preserved
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      expect(screen.getByText(`${testAddress.slice(0, 6)}...${testAddress.slice(-4)}`)).toBeInTheDocument();

      // Step 1 should show as completed
      const step1Indicator = screen.getByText('Step 1: Connect Your Wallet')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(step1Indicator).toHaveClass('bg-green-500');

      // Step 2 should still be available despite error
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in with ethereum/i })).toBeInTheDocument();

      // Auth state should show not authenticated
      expect(mockAuthState.isAuthenticated).toBe(false);
    });

    test('shows loading state during signing process', () => {
      mockAuthState.isLoading = true;
      mockAuthState.error = null; // Clear any previous errors

      render(<AuthPage />);

      // Should show loading state
      const signButton = screen.getByRole('button', { name: /signing in.../i });
      expect(signButton).toBeInTheDocument();
      expect(signButton).toBeDisabled();

      // Should not show error during loading
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      // Wallet should remain connected
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
    });

    test('clears error when starting new sign attempt', () => {
      // Start with error
      mockAuthState.error = 'Previous error';
      mockAuthState.isLoading = false;

      const { rerender } = render(<AuthPage />);
      expect(screen.getByText('Previous error')).toBeInTheDocument();

      // Start new attempt (loading state)
      mockAuthState.error = null;
      mockAuthState.isLoading = true;

      rerender(<AuthPage />);

      // Error should be cleared
      expect(screen.queryByText('Previous error')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      // Should show loading state
      expect(screen.getByRole('button', { name: /signing in.../i })).toBeDisabled();
    });

    test('handles signing interruption gracefully', () => {
      mockAuthState.error = 'Wallet connection interrupted';

      render(<AuthPage />);

      // Should display the interruption error
      expect(screen.getByText('Wallet connection interrupted')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Wallet connection interrupted');

      // Should not leave app in broken state
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();

      // Sign-in should still be available for retry
      expect(screen.getByRole('button', { name: /sign in with ethereum/i })).toBeEnabled();
    });
  });

  /**
   * Test successful flow to ensure normal operation works
   */
  describe('Success Path Tests', () => {
    test('shows complete flow when wallet is connected', () => {
      mockAccount.isConnected = true;
      mockAccount.address = testAddress;
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      render(<AuthPage />);

      // Should show both steps
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();

      // Step 1 should show as completed
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      const step1Indicator = screen.getByText('Step 1: Connect Your Wallet')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(step1Indicator).toHaveClass('bg-green-500');

      // Sign-in should be available
      expect(screen.getByRole('button', { name: /sign in with ethereum/i })).toBeEnabled();
    });

    test('redirects to dashboard when authenticated', () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.address = testAddress;

      render(<AuthPage />);

      // Should show redirecting state
      expect(screen.getByText('Redirecting to dashboard...')).toBeInTheDocument();
      expect(mockPush).toHaveBeenCalledWith('/dashboard');

      // Should not show auth form
      expect(screen.queryByText('Welcome to BFN')).not.toBeInTheDocument();
    });

    test('calls signIn when user clicks sign-in button', async () => {
      const user = userEvent.setup();
      
      mockAccount.isConnected = true;
      mockAccount.address = testAddress;
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      render(<AuthPage />);

      const signInButton = screen.getByRole('button', { name: /sign in with ethereum/i });
      await user.click(signInButton);

      expect(mockSignIn).toHaveBeenCalled();
    });
  });

  /**
   * Test UI consistency and error recovery
   */
  describe('Error Recovery and UI Consistency', () => {
    test('maintains stable UI during rapid state changes', () => {
      const { rerender } = render(<AuthPage />);

      // Basic structure should always be present
      expect(screen.getByTestId('network-guard')).toBeInTheDocument();

      // Simulate rapid state changes
      mockAuthState.isLoading = true;
      rerender(<AuthPage />);
      expect(screen.getByTestId('network-guard')).toBeInTheDocument();

      mockAuthState.isLoading = false;
      mockAuthState.error = 'Test error';
      rerender(<AuthPage />);
      expect(screen.getByTestId('network-guard')).toBeInTheDocument();

      mockAuthState.error = null;
      mockAuthState.isAuthenticated = true;
      rerender(<AuthPage />);
      // Even during redirect, the structure should be stable
      expect(screen.getByText('Redirecting to dashboard...')).toBeInTheDocument();
    });

    test('shows helpful security information', () => {
      render(<AuthPage />);

      // Should show security help text
      expect(screen.getByText('Secure Wallet-Based Authentication')).toBeInTheDocument();
      expect(screen.getByText('No passwords or personal information required')).toBeInTheDocument();
      expect(screen.getByText('Your wallet signature proves ownership')).toBeInTheDocument();
      expect(screen.getByText('All financial data comes from the blockchain')).toBeInTheDocument();
      expect(screen.getByText('You maintain full control of your funds')).toBeInTheDocument();
    });

    test('handles edge case where wallet connects but to wrong network', () => {
      // Wallet connects but to wrong network
      mockShowNetworkGuard = true; // Network guard blocks due to wrong network
      mockAccount.isConnected = true;
      mockAccount.address = testAddress;
      mockAccount.chainId = 1; // Ethereum mainnet

      render(<AuthPage />);

      // Should show network guard UI, not auth flow
      expect(screen.getByTestId('wrong-network-ui')).toBeInTheDocument();
      expect(screen.queryByText('Step 2: Sign Authentication Message')).not.toBeInTheDocument();
    });

    test('handles auth state consistency during wallet connection changes', () => {
      // Start authenticated
      mockAuthState.isAuthenticated = true;
      mockAuthState.address = testAddress;
      mockAccount.isConnected = true;
      mockAccount.address = testAddress;

      const { rerender } = render(<AuthPage />);
      expect(screen.getByText('Redirecting to dashboard...')).toBeInTheDocument();

      // Wallet disconnects but auth state not yet cleared
      mockAccount.isConnected = false;
      mockAccount.address = undefined;
      // Auth state should eventually be cleared by useSiweAuth hook
      mockAuthState.isAuthenticated = false;
      mockAuthState.address = undefined;

      rerender(<AuthPage />);

      // Should revert to initial state
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.queryByText('Redirecting to dashboard...')).not.toBeInTheDocument();
    });
  });
});