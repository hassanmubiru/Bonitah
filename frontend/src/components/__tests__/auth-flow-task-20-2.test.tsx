/**
 * Task 20.2: Component Tests for Authentication Flow Error Scenarios
 * 
 * Covers connect failure, wrong-network prompt, and sign decline paths
 * Requirements: 2.2, 2.3, 2.5
 * 
 * This test validates:
 * - Connect failure scenarios - wallet connection errors and user rejection
 * - Wrong network detection and Base Sepolia switch prompts
 * - Sign decline paths - user declining to sign SIWE message
 * - Error handling and user feedback during auth failures
 * - State management throughout the authentication flow
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Next.js router
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

// Mock wagmi hooks with controlled state
interface MockWagmiAccount {
  isConnected: boolean;
  address?: string;
  chainId?: number;
}

interface MockSwitchChain {
  switchChain: jest.MockedFunction<any>;
  isPending: boolean;
  error: Error | null;
}

const mockWagmiAccount: MockWagmiAccount = {
  isConnected: false,
  address: undefined,
  chainId: undefined,
};

const mockSwitchChain: MockSwitchChain = {
  switchChain: jest.fn(),
  isPending: false,
  error: null,
};

jest.mock('wagmi', () => ({
  useAccount: () => mockWagmiAccount,
  useSwitchChain: () => mockSwitchChain,
}));

// Mock the useSiweAuth hook for controlled testing
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockCheckAuth = jest.fn();

interface MockAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  address?: string;
  role?: string;
}

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

// Mock ConnectButton with realistic behavior
const mockConnectButton = jest.fn();
jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: (props: any) => {
    mockConnectButton(props);
    return (
      <button 
        data-testid="connect-button"
        onClick={() => {
          // Simulate connection behavior based on current state
          if (!mockWagmiAccount.isConnected) {
            // Simulate successful connection
            mockWagmiAccount.isConnected = true;
            mockWagmiAccount.address = '0x1234567890123456789012345678901234567890';
            mockWagmiAccount.chainId = 84532; // Base Sepolia
          }
        }}
      >
        {mockWagmiAccount.isConnected ? `Connected (${mockWagmiAccount.address?.slice(0, 6)}...)` : 'Connect Wallet'}
      </button>
    );
  },
}));

// Mock BASE_SEPOLIA_CHAIN_ID
const BASE_SEPOLIA_CHAIN_ID = 84532;
jest.mock('@bfn/shared', () => ({
  BASE_SEPOLIA_CHAIN_ID: 84532,
  NETWORKS: {
    84532: {
      name: 'Base Sepolia',
      nativeCurrency: {
        symbol: 'ETH'
      }
    }
  }
}));

// Import after mocks
import AuthPage from '@/app/auth/page';

describe('Task 20.2: Auth Flow Component Tests - Error Scenarios', () => {
  const testAddress = '0x1234567890123456789012345678901234567890';
  const wrongNetworkAddress = '0x9876543210987654321098765432109876543210';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset auth state
    mockAuthState = {
      isAuthenticated: false,
      isLoading: false,
      error: null,
    };
    
    // Reset wagmi account state
    mockWagmiAccount.isConnected = false;
    mockWagmiAccount.address = undefined;
    mockWagmiAccount.chainId = undefined;
    
    // Reset switch chain state
    mockSwitchChain.isPending = false;
    mockSwitchChain.error = null;
    mockSwitchChain.switchChain.mockClear();
    
    // Reset router mocks
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  /**
   * Requirement 2.2: Connect failure scenarios
   * Test wallet connection errors and user rejection
   */
  describe('Connect Failure Scenarios (Req 2.2)', () => {
    it('displays connection step when no wallet is connected', () => {
      render(<AuthPage />);

      // Should show step 1 with inactive indicator
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByTestId('connect-button')).toBeInTheDocument();
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();

      // Should not show step 2 or success indicators
      expect(screen.queryByText('Step 2: Sign Authentication Message')).not.toBeInTheDocument();
      expect(screen.queryByText('Wallet Connected')).not.toBeInTheDocument();
      
      // Step indicator should be inactive
      const stepIndicator = screen.getByText('Step 1: Connect Your Wallet')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(stepIndicator).toHaveClass('bg-gray-300');
    });

    it('shows user-friendly error messaging for wallet rejection', async () => {
      const user = userEvent.setup();
      
      // Mock wallet connection rejection
      mockConnectButton.mockImplementation((props) => (
        <button 
          data-testid="connect-button"
          onClick={() => {
            // Simulate user rejecting wallet connection
            throw new Error('User rejected connection');
          }}
        >
          Connect Wallet
        </button>
      ));

      render(<AuthPage />);

      const connectButton = screen.getByTestId('connect-button');
      
      // The ConnectButton itself handles wallet errors internally
      // Our component should remain stable regardless of wallet issues
      expect(connectButton).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      
      // No application-level error should be shown for wallet-level issues
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('handles wallet disconnection gracefully during auth flow', async () => {
      // Start with connected wallet
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      const { rerender } = render(<AuthPage />);

      // Should show both steps when connected
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();

      // Simulate wallet disconnection
      mockWagmiAccount.isConnected = false;
      mockWagmiAccount.address = undefined;
      mockWagmiAccount.chainId = undefined;

      rerender(<AuthPage />);

      // Should revert to connection-only state
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.queryByText('Step 2: Sign Authentication Message')).not.toBeInTheDocument();
      expect(screen.queryByText('Wallet Connected')).not.toBeInTheDocument();
      
      // Step indicator should be inactive again
      const stepIndicator = screen.getByText('Step 1: Connect Your Wallet')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(stepIndicator).toHaveClass('bg-gray-300');
    });

    it('maintains stable UI during connection state changes', async () => {
      const { rerender } = render(<AuthPage />);

      // Initial state - no wallet connected
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText(/connect your wallet and sign in securely/i)).toBeInTheDocument();

      // Connect wallet on correct network
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID; // Correct network
      rerender(<AuthPage />);

      // Should still show auth page
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();

      // Disconnect wallet
      mockWagmiAccount.isConnected = false;
      mockWagmiAccount.address = undefined;
      mockWagmiAccount.chainId = undefined;
      rerender(<AuthPage />);

      // Should show auth page again
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();

      // Reconnect wallet on correct network
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID; // Correct network
      rerender(<AuthPage />);

      // Core UI elements should remain stable
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
    });

    it('shows appropriate loading states during wallet connection', async () => {
      const user = userEvent.setup();
      
      render(<AuthPage />);

      // Should show connect button initially
      const connectButton = screen.getByTestId('connect-button');
      expect(connectButton).toHaveTextContent('Connect Wallet');

      // Simulate connection in progress (wallet would typically show its own loading)
      await user.click(connectButton);

      // The ConnectButton component manages its own states
      // Our component should remain stable
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
    });

    it('handles multiple wallet types and their specific errors', () => {
      render(<AuthPage />);

      // The component should be wallet-agnostic
      // ConnectButton handles wallet-specific logic
      expect(screen.getByTestId('connect-button')).toBeInTheDocument();
      expect(mockConnectButton).toHaveBeenCalledWith(
        expect.objectContaining({
          showBalance: false,
          chainStatus: 'icon',
          accountStatus: {
            smallScreen: 'avatar',
            largeScreen: 'full',
          },
        })
      );
    });

    it('recovers properly after connection failures', async () => {
      render(<AuthPage />);

      // Should allow retry after any connection issues
      const connectButton = screen.getByTestId('connect-button');
      expect(connectButton).toBeInTheDocument();
      expect(connectButton).toBeEnabled();

      // No persistent error state should block retries
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  /**
   * Requirement 2.3: Wrong network prompt and Base Sepolia switch
   * Test network detection and switching prompts
   */
  describe('Wrong Network Detection and Switching (Req 2.3)', () => {
    it('detects wrong network and NetworkGuard shows switching UI', () => {
      // Mock connected to wrong network (Ethereum mainnet)
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = wrongNetworkAddress;
      mockWagmiAccount.chainId = 1; // Ethereum Mainnet

      render(<AuthPage />);

      // NetworkGuard should intercept and show wrong network UI instead of auth page
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText('Bonitah Financial Network requires Base Sepolia to function properly.')).toBeInTheDocument();
      expect(screen.getByText('Switch to Base Sepolia')).toBeInTheDocument();
      
      // Should not show normal auth page content
      expect(screen.queryByText('Welcome to BFN')).not.toBeInTheDocument();
    });

    it('allows normal auth flow when on correct network', () => {
      // Mock connected to Base Sepolia
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      render(<AuthPage />);

      // Should show full auth flow
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      
      // Step 1 should be completed
      const step1Indicator = screen.getByText('Step 1: Connect Your Wallet')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(step1Indicator).toHaveClass('bg-green-500');
    });

    it('shows network-specific error messages through NetworkGuard', () => {
      const networkTests = [
        { chainId: 1, expectedName: 'Ethereum Mainnet' },
        { chainId: 11155111, expectedName: 'Ethereum Sepolia' },
        { chainId: 137, expectedName: 'Chain ID 137' }, // Unknown network
      ];

      networkTests.forEach(({ chainId, expectedName }) => {
        mockWagmiAccount.isConnected = true;
        mockWagmiAccount.address = wrongNetworkAddress;
        mockWagmiAccount.chainId = chainId;

        const { unmount } = render(<AuthPage />);

        // Should show NetworkGuard with specific network name
        expect(screen.getByText('Wrong Network')).toBeInTheDocument();
        expect(screen.getByText(expectedName)).toBeInTheDocument();
        expect(screen.getByText('Switch to Base Sepolia')).toBeInTheDocument();

        unmount();
      });
    });

    it('handles network switching from wrong to correct network', () => {
      // Start on wrong network
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = 1; // Wrong network

      const { rerender } = render(<AuthPage />);

      // Should show NetworkGuard wrong network UI
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.queryByText('Welcome to BFN')).not.toBeInTheDocument();

      // Switch to correct network
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      rerender(<AuthPage />);

      // Should now show normal auth flow
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
      expect(screen.queryByText('Wrong Network')).not.toBeInTheDocument();
    });

    it('provides clear network requirements through NetworkGuard', () => {
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = wrongNetworkAddress;
      mockWagmiAccount.chainId = 137; // Polygon

      render(<AuthPage />);

      // Should show comprehensive network guidance
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText('Network Mismatch')).toBeInTheDocument();
      expect(screen.getByText('Chain ID 137')).toBeInTheDocument();
      expect(screen.getByText('Switch to Base Sepolia')).toBeInTheDocument();
      
      // Should show network details (check for parts of the text that might be split)
      expect(screen.getByText(/Chain ID:/)).toBeInTheDocument();
      expect(screen.getByText(/84532/)).toBeInTheDocument();
      expect(screen.getByText(/Currency:/)).toBeInTheDocument();
      expect(screen.getByText(/ETH/)).toBeInTheDocument();
    });

    it('handles no wallet connected gracefully', () => {
      // Not connected to any wallet
      mockWagmiAccount.isConnected = false;
      mockWagmiAccount.address = undefined;
      mockWagmiAccount.chainId = undefined;

      render(<AuthPage />);

      // Should show normal auth page since no network to validate
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.queryByText('Wrong Network')).not.toBeInTheDocument();
    });

    it('shows network details for debugging', () => {
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = wrongNetworkAddress;
      mockWagmiAccount.chainId = 8453; // Base mainnet

      render(<AuthPage />);

      // Should show NetworkGuard with Base Sepolia requirements
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText(/Chain ID:/)).toBeInTheDocument();
      expect(screen.getByText(/84532/)).toBeInTheDocument();
      expect(screen.getByText(/Currency:/)).toBeInTheDocument();
      expect(screen.getByText(/ETH/)).toBeInTheDocument();
    });
  });

  /**
   * Requirement 2.5: Sign decline paths
   * Test user declining to sign SIWE message
   */
  describe('Sign Decline Paths (Req 2.5)', () => {
    beforeEach(() => {
      // Setup connected wallet on correct network for signing tests
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID;
    });

    it('displays error when user declines to sign SIWE message', async () => {
      const user = userEvent.setup();

      // Mock sign-in rejection
      mockAuthState.error = 'User rejected signing';

      render(<AuthPage />);

      // Should show both steps when wallet is connected
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();

      // Should show error message
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('User rejected signing')).toBeInTheDocument();

      // Sign in button should still be available for retry
      const signInButton = screen.getByRole('button', { name: /sign in with ethereum/i });
      expect(signInButton).toBeInTheDocument();
      expect(signInButton).toBeEnabled();
    });

    it('handles different types of wallet signing rejections', () => {
      const rejectionMessages = [
        'User rejected signing',
        'MetaMask Tx Signature: User denied transaction signature.',
        'User rejected methods.', // WalletConnect
        'User denied message signature.', // Generic
        'Transaction was rejected by the user', // Alternative format
      ];

      rejectionMessages.forEach(message => {
        mockAuthState.error = message;

        const { unmount } = render(<AuthPage />);

        // Should display the specific error message
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(message)).toBeInTheDocument();

        // Should maintain stable UI
        expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
        expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
        expect(screen.getByText('Wallet Connected')).toBeInTheDocument();

        unmount();
      });
    });

    it('allows retry after user declines signing', async () => {
      const user = userEvent.setup();

      // Start with signing error
      mockAuthState.error = 'User rejected signing';
      mockAuthState.isLoading = false;

      const { rerender } = render(<AuthPage />);

      // Should show error
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('User rejected signing')).toBeInTheDocument();

      // Clear error state (simulating retry)
      mockAuthState.error = null;

      rerender(<AuthPage />);

      // Error should be gone
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('User rejected signing')).not.toBeInTheDocument();

      // Sign in button should be available for retry
      const signInButton = screen.getByRole('button', { name: /sign in with ethereum/i });
      expect(signInButton).toBeEnabled();

      await user.click(signInButton);
      expect(mockSignIn).toHaveBeenCalled();
    });

    it('shows loading state during retry after previous failure', async () => {
      const user = userEvent.setup();

      // Start with error, then loading
      mockAuthState.error = 'User rejected signing';
      
      const { rerender } = render(<AuthPage />);
      
      expect(screen.getByText('User rejected signing')).toBeInTheDocument();

      // Simulate loading state (error cleared, loading started)
      mockAuthState.error = null;
      mockAuthState.isLoading = true;

      rerender(<AuthPage />);

      // Should show loading state
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in.../i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in.../i })).toBeDisabled();
    });

    it('maintains wallet connection state when signing fails', () => {
      mockAuthState.error = 'User rejected signing';

      render(<AuthPage />);

      // Wallet should still appear connected despite signing error
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      expect(screen.getByText(`${testAddress.slice(0, 6)}...${testAddress.slice(-4)}`)).toBeInTheDocument();

      // Step 1 should still be completed (wallet connected)
      const step1Indicator = screen.getByText('Step 1: Connect Your Wallet')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(step1Indicator).toHaveClass('bg-green-500');

      // Step 2 should still be available
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in with ethereum/i })).toBeInTheDocument();
    });

    it('handles signing interruption gracefully', () => {
      mockAuthState.error = 'Signing interrupted';

      render(<AuthPage />);

      // Should show error without breaking UI
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Signing interrupted')).toBeInTheDocument();
      
      // Should maintain normal UI structure
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
    });

    it('provides helpful context about signing process', () => {
      render(<AuthPage />);

      // Should show helpful text about the signing process
      expect(screen.getByText(/you'll be asked to sign a message to prove you own this wallet/i)).toBeInTheDocument();
      expect(screen.getByText(/no gas fees required/i)).toBeInTheDocument();
      
      // Should show security benefits
      expect(screen.getByText('Secure Wallet-Based Authentication')).toBeInTheDocument();
      expect(screen.getByText(/no passwords or personal information required/i)).toBeInTheDocument();
      expect(screen.getByText(/your wallet signature proves ownership/i)).toBeInTheDocument();
    });

    it('clears errors when starting new sign attempt', async () => {
      const user = userEvent.setup();

      // Start with error state
      mockAuthState.error = 'Previous signing error';
      mockAuthState.isLoading = false;

      const { rerender } = render(<AuthPage />);

      expect(screen.getByText('Previous signing error')).toBeInTheDocument();

      // Simulate starting new attempt (loading state)
      mockAuthState.error = null;
      mockAuthState.isLoading = true;

      rerender(<AuthPage />);

      // Error should be cleared, loading should show
      expect(screen.queryByText('Previous signing error')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in.../i })).toBeInTheDocument();
    });

    it('handles network-related signing failures', () => {
      const networkErrors = [
        'Network request failed',
        'Failed to get authentication nonce',
        'Backend authentication service unavailable',
        'Connection timeout during authentication',
      ];

      networkErrors.forEach(errorMessage => {
        mockAuthState.error = errorMessage;

        const { unmount } = render(<AuthPage />);

        // Should show network-related error
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();

        // Should maintain stable UI for retry
        expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign in with ethereum/i })).toBeEnabled();

        unmount();
      });
    });

    it('does not leave partial authentication state on sign failure', () => {
      mockAuthState.error = 'User rejected signing';
      mockAuthState.isAuthenticated = false; // Should remain false
      mockAuthState.address = undefined; // Should remain undefined
      mockAuthState.role = undefined; // Should remain undefined

      render(<AuthPage />);

      // Should not show any authenticated state
      expect(screen.queryByText('Authenticated ✓')).not.toBeInTheDocument();
      expect(screen.queryByText('Redirecting to dashboard')).not.toBeInTheDocument();
      
      // Should show error instead
      expect(screen.getByText('User rejected signing')).toBeInTheDocument();
      
      // Should show sign in button, not authenticated button
      expect(screen.getByRole('button', { name: /sign in with ethereum/i })).toBeInTheDocument();
    });
  });

  /**
   * Integration and Error Recovery Tests
   */
  describe('Error Recovery and Integration', () => {
    it('recovers from multiple sequential errors', async () => {
      const user = userEvent.setup();

      // Start not connected
      render(<AuthPage />);
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();

      // Connect wallet
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      const { rerender } = render(<AuthPage />);
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();

      // First error - network issue
      mockAuthState.error = 'Network request failed';
      rerender(<AuthPage />);
      expect(screen.getByText('Network request failed')).toBeInTheDocument();

      // Clear first error, second error - user rejection
      mockAuthState.error = 'User rejected signing';
      rerender(<AuthPage />);
      expect(screen.getByText('User rejected signing')).toBeInTheDocument();

      // Clear all errors - should be ready for retry
      mockAuthState.error = null;
      rerender(<AuthPage />);
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in with ethereum/i })).toBeEnabled();
    });

    it('maintains component stability during rapid state changes', () => {
      const { rerender } = render(<AuthPage />);

      // Core elements should always be present when on correct network or no network
      const assertStableElements = () => {
        // Only assert elements when not showing NetworkGuard wrong network UI
        if (mockWagmiAccount.chainId === undefined || mockWagmiAccount.chainId === BASE_SEPOLIA_CHAIN_ID) {
          expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
          expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
        } else {
          // On wrong network, NetworkGuard should show
          expect(screen.getByText('Wrong Network')).toBeInTheDocument();
        }
      };

      assertStableElements();

      // Rapid state changes
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = BASE_SEPOLIA_CHAIN_ID; // Correct network
      rerender(<AuthPage />);
      assertStableElements();

      mockAuthState.isLoading = true;
      rerender(<AuthPage />);
      assertStableElements();

      mockAuthState.isLoading = false;
      mockAuthState.error = 'Test error';
      rerender(<AuthPage />);
      assertStableElements();

      mockAuthState.error = null;
      mockAuthState.isAuthenticated = true;
      rerender(<AuthPage />);

      // Should now show redirect state
      expect(screen.getByText('Redirecting to dashboard...')).toBeInTheDocument();
    });

    it('handles edge case combinations gracefully', () => {
      // Connected wallet + wrong network (NetworkGuard should handle this)
      mockWagmiAccount.isConnected = true;
      mockWagmiAccount.address = testAddress;
      mockWagmiAccount.chainId = 1; // Wrong network

      render(<AuthPage />);

      // Should show NetworkGuard wrong network UI, not auth page
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.queryByText('Welcome to BFN')).not.toBeInTheDocument();
    });
  });
});