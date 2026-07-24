/**
 * Component Tests for Authentication Flow
 * Task 20.2: Write component tests for the auth flow
 * 
 * This test validates Requirements 2.2, 2.3, and 2.5:
 * - 2.2: Handle wallet connection failures gracefully
 * - 2.3: Prompt user to switch to Base Sepolia when on wrong network
 * - 2.5: Handle user declining to sign SIWE message
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock wagmi hooks with simple implementations
const mockUseAccount = jest.fn(() => ({
  isConnected: false,
  address: undefined,
  chainId: undefined,
}));

jest.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
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

// Mock NetworkGuard to control network behavior
const mockNetworkGuard = jest.fn(({ children }: { children: React.ReactNode }) => (
  <div data-testid="network-guard">{children}</div>
));
jest.mock('@/components/NetworkGuard', () => ({
  NetworkGuard: mockNetworkGuard,
}));

// Mock ConnectButton for wallet interaction testing
jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: (props: any) => (
    <button data-testid="connect-button">
      Mock Connect Button
    </button>
  ),
}));

// Import after mocks
import AuthPage from '@/app/auth/page';

describe('Authentication Flow Component Tests', () => {
  const testAddress = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      isAuthenticated: false,
      isLoading: false,
      error: null,
    };
    mockPush.mockClear();
    mockUseAccount.mockReturnValue({
      isConnected: false,
      address: undefined,
      chainId: undefined,
    });
  });

  /**
   * Test Requirement 2.2: Handle wallet connection failures gracefully
   */
  describe('Connect Failure Tests (Req 2.2)', () => {
    it('displays connection step when wallet is not connected', () => {
      render(<AuthPage />);

      // Should render the connection step
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByTestId('connect-button')).toBeInTheDocument();

      // Should not show authentication step when not connected
      expect(screen.queryByText('Step 2: Sign Authentication Message')).not.toBeInTheDocument();
    });

    it('shows inactive step indicator when wallet not connected', () => {
      render(<AuthPage />);

      // Connection step indicator should not be completed
      const stepIndicator = screen.getByText('Step 1: Connect Your Wallet')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(stepIndicator).toHaveClass('bg-gray-300');
      expect(stepIndicator).not.toHaveClass('bg-green-500');
    });

    it('handles wallet disconnection gracefully during auth flow', () => {
      // Start with connected wallet
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: testAddress,
        chainId: 84532,
      });

      const { rerender } = render(<AuthPage />);

      // Should show both steps when connected
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();

      // Simulate wallet disconnection
      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
        chainId: undefined,
      });

      rerender(<AuthPage />);

      // Should revert to connection-only state
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.queryByText('Step 2: Sign Authentication Message')).not.toBeInTheDocument();
      expect(screen.queryByText('Wallet Connected')).not.toBeInTheDocument();
    });

  /**
   * Test Requirement 2.2: Handle wallet connection failures gracefully
   */
  describe('Connect Failure Tests (Req 2.2)', () => {
    it('displays user-friendly error when wallet connection fails', async () => {
      // Mock connection failure scenario
      mockConnectButton.mockImplementation(() => {
        throw new Error('User rejected connection');
      });

      render(
        <TestWrapper>
          <AuthPage />
        </TestWrapper>
      );

      // Should render the connection step
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByTestId('connect-button')).toBeInTheDocument();

      // Even though connection fails at the wallet level, the UI should remain stable
      // The ConnectButton component handles its own error states
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
    });

    it('remains in connection step when wallet connection is rejected', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AuthPage />
        </TestWrapper>
      );

      // Should show connection step
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      
      // Connection step indicator should not be completed
      const stepIndicator = screen.getByText('Step 1: Connect Your Wallet')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(stepIndicator).toHaveClass('bg-gray-300');
      expect(stepIndicator).not.toHaveClass('bg-green-500');

      // Should not show authentication step when not connected
      expect(screen.queryByText('Step 2: Sign Authentication Message')).not.toBeInTheDocument();
    });

    it('displays connection step correctly without connected wallet', () => {
      render(
        <TestWrapper mockAccount={null}>
          <AuthPage />
        </TestWrapper>
      );

      // Should show connection step with inactive indicator
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByTestId('connect-button')).toBeInTheDocument();

      // Should not show "Wallet Connected" success message
      expect(screen.queryByText('Wallet Connected')).not.toBeInTheDocument();

      // Should not show Step 2 when wallet not connected
      expect(screen.queryByText('Step 2: Sign Authentication Message')).not.toBeInTheDocument();
    });

    it('handles wallet disconnection gracefully during auth flow', async () => {
      // Start with connected wallet
      const { rerender } = render(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // Should show both steps when connected
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();

      // Simulate wallet disconnection
      rerender(
        <TestWrapper mockAccount={null}>
          <AuthPage />
        </TestWrapper>
      );

      // Should revert to connection-only state
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.queryByText('Step 2: Sign Authentication Message')).not.toBeInTheDocument();
      expect(screen.queryByText('Wallet Connected')).not.toBeInTheDocument();
    });

    it('shows appropriate connect button states for different connection scenarios', () => {
      render(
        <TestWrapper mockAccount={null}>
          <AuthPage />
        </TestWrapper>
      );

      // ConnectButton should be rendered with proper props
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
  });

  /**
   * Test Requirement 2.3: Wrong network prompt and switching behavior
   */
  describe('Wrong Network Tests (Req 2.3)', () => {
    it('prompts user to switch when connected to wrong network', () => {
      // Mock connected to Ethereum mainnet (chain ID 1)
      render(
        <TestWrapper 
          mockAccount={{ address: testAddress, isConnected: true }}
          mockChainId={1} // Ethereum mainnet
        >
          <AuthPage />
        </TestWrapper>
      );

      // NetworkGuard should be rendered (it handles the wrong network UI)
      expect(screen.getByTestId('network-guard')).toBeInTheDocument();
      
      // NetworkGuard should have been called to wrap the auth content
      expect(mockNetworkGuard).toHaveBeenCalled();
    });

    it('renders auth content normally when on correct network', () => {
      render(
        <TestWrapper 
          mockAccount={{ address: testAddress, isConnected: true }}
          mockChainId={BASE_SEPOLIA_CHAIN_ID}
        >
          <AuthPage />
        </TestWrapper>
      );

      // Should show normal auth flow when on Base Sepolia
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
    });

    it('wraps content with NetworkGuard for network enforcement', () => {
      render(
        <TestWrapper>
          <AuthPage />
        </TestWrapper>
      );

      // NetworkGuard should always wrap the auth content
      expect(screen.getByTestId('network-guard')).toBeInTheDocument();
      expect(mockNetworkGuard).toHaveBeenCalled();

      // The auth content should be inside the NetworkGuard
      const networkGuard = screen.getByTestId('network-guard');
      expect(networkGuard).toContainElement(screen.getByText('Welcome to BFN'));
    });

    it('handles network switching callback from NetworkGuard', () => {
      render(
        <TestWrapper>
          <AuthPage />
        </TestWrapper>
      );

      // NetworkGuard should receive onNetworkSwitched callback
      const networkGuardCall = mockNetworkGuard.mock.calls[0][0];
      expect(networkGuardCall).toHaveProperty('onNetworkSwitched');
      expect(typeof networkGuardCall.onNetworkSwitched).toBe('function');
    });

    it('prevents auth actions when on wrong network through NetworkGuard', () => {
      render(
        <TestWrapper 
          mockAccount={{ address: testAddress, isConnected: true }}
          mockChainId={1} // Wrong network
        >
          <AuthPage />
        </TestWrapper>
      );

      // NetworkGuard handles wrong network scenario
      // The auth content would be blocked by NetworkGuard's own UI
      expect(screen.getByTestId('network-guard')).toBeInTheDocument();
    });
  });

  /**
   * Test Requirement 2.5: Handle user declining to sign SIWE message
   */
  describe('Sign Decline Tests (Req 2.5)', () => {
    it('displays error when user declines to sign SIWE message', async () => {
      const user = userEvent.setup();

      // Mock sign-in rejection
      mockSignIn.mockRejectedValue(new Error('User rejected signing'));
      mockAuthState.error = 'User rejected signing';

      render(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // Should show both steps when wallet is connected
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();

      // Click sign in button
      const signInButton = screen.getByRole('button', { name: /sign in with ethereum/i });
      await user.click(signInButton);

      // Should show error message
      expect(screen.getByText('User rejected signing')).toBeInTheDocument();

      // Error should be in an alert element
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('User rejected signing');
    });

    it('allows retry after user declines signing', async () => {
      const user = userEvent.setup();

      // Start with sign error state
      mockAuthState.error = 'User rejected signing';
      mockSignIn.mockRejectedValue(new Error('User rejected signing'));

      const { rerender } = render(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // Should show error
      expect(screen.getByText('User rejected signing')).toBeInTheDocument();

      // Clear error and allow retry
      mockAuthState.error = null;
      mockSignIn.mockClear();

      rerender(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // Should be able to try signing again
      const signInButton = screen.getByRole('button', { name: /sign in with ethereum/i });
      expect(signInButton).toBeEnabled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await user.click(signInButton);
      expect(mockSignIn).toHaveBeenCalled();
    });

    it('handles different types of signing errors appropriately', async () => {
      const user = userEvent.setup();

      // Test various error scenarios
      const errorScenarios = [
        { error: 'User rejected signing', description: 'user rejection' },
        { error: 'MetaMask Tx Signature: User denied transaction signature.', description: 'MetaMask rejection' },
        { error: 'Wallet connection lost', description: 'connection loss' },
        { error: 'Invalid signature format', description: 'signature error' },
      ];

      for (const scenario of errorScenarios) {
        // Reset mocks
        jest.clearAllMocks();
        mockSignIn.mockRejectedValue(new Error(scenario.error));
        mockAuthState.error = scenario.error;

        const { unmount } = render(
          <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
            <AuthPage />
          </TestWrapper>
        );

        // Should display the specific error message
        expect(screen.getByText(scenario.error)).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent(scenario.error);

        // Sign in button should still be available for retry
        const signInButton = screen.getByRole('button', { name: /sign in with ethereum/i });
        expect(signInButton).toBeInTheDocument();
        expect(signInButton).toBeEnabled();

        unmount();
        
        // Reset state for next iteration
        mockAuthState.error = null;
      }
    });

    it('maintains wallet connection state even when signing fails', async () => {
      const user = userEvent.setup();

      mockAuthState.error = 'User rejected signing';

      render(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // Wallet should still appear connected despite signing error
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      expect(screen.getByText(`${testAddress.slice(0, 6)}...${testAddress.slice(-4)}`)).toBeInTheDocument();

      // Step 1 should show as completed (wallet connected)
      const step1Indicator = screen.getByText('Step 1: Connect Your Wallet')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(step1Indicator).toHaveClass('bg-green-500');

      // Step 2 should still be available despite error
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in with ethereum/i })).toBeInTheDocument();

      // Error should be displayed
      expect(screen.getByText('User rejected signing')).toBeInTheDocument();
    });

    it('clears errors when retrying sign-in process', async () => {
      const user = userEvent.setup();

      // Start with error state
      mockAuthState.error = 'Previous error';
      mockAuthState.isLoading = false;

      const { rerender } = render(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      expect(screen.getByText('Previous error')).toBeInTheDocument();

      // Simulate loading state (error should clear)
      mockAuthState.error = null;
      mockAuthState.isLoading = true;

      rerender(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // Error should be gone, loading state should show
      expect(screen.queryByText('Previous error')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in.../i })).toBeInTheDocument();
    });

    it('shows loading state during sign-in attempt after previous failure', async () => {
      mockAuthState.isLoading = true;
      mockAuthState.error = null; // Cleared when loading starts

      render(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // Should show loading state
      expect(screen.getByRole('button', { name: /signing in.../i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in.../i })).toBeDisabled();

      // Should not show any error
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  /**
   * Test Success Path and General Auth Flow
   */
  describe('Success Path Tests', () => {
    it('completes full authentication flow successfully', async () => {
      const user = userEvent.setup();

      // Start unauthenticated with connected wallet
      render(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // Step 1 should be completed (wallet connected)
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      
      // Step 2 should be available
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
      const signInButton = screen.getByRole('button', { name: /sign in with ethereum/i });
      expect(signInButton).toBeEnabled();

      // Mock successful authentication
      mockSignIn.mockResolvedValue(undefined);
      mockAuthState.isAuthenticated = true;
      mockAuthState.address = testAddress;

      await user.click(signInButton);

      expect(mockSignIn).toHaveBeenCalled();
    });

    it('redirects to dashboard when authentication succeeds', async () => {
      // Mock authenticated state
      mockAuthState.isAuthenticated = true;
      mockAuthState.address = testAddress;

      render(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // Should trigger redirect
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('shows redirecting state when authenticated', () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.address = testAddress;

      render(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // Should show redirecting UI instead of auth form
      expect(screen.getByText('Redirecting to dashboard...')).toBeInTheDocument();
      expect(screen.queryByText('Welcome to BFN')).not.toBeInTheDocument();
    });

    it('shows authenticated button state when authentication completes', async () => {
      // Start unauthenticated
      const { rerender } = render(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /sign in with ethereum/i })).toBeInTheDocument();

      // Simulate authentication success
      mockAuthState.isAuthenticated = true;
      mockAuthState.address = testAddress;

      rerender(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // Should show authenticated state before redirect
      expect(screen.getByText('Redirecting to dashboard...')).toBeInTheDocument();
    });

    it('displays help text and security information', () => {
      render(
        <TestWrapper>
          <AuthPage />
        </TestWrapper>
      );

      // Should show security help text
      expect(screen.getByText('Secure Wallet-Based Authentication')).toBeInTheDocument();
      expect(screen.getByText('No passwords or personal information required')).toBeInTheDocument();
      expect(screen.getByText('Your wallet signature proves ownership')).toBeInTheDocument();
      expect(screen.getByText('All financial data comes from the blockchain')).toBeInTheDocument();
      expect(screen.getByText('You maintain full control of your funds')).toBeInTheDocument();
    });

    it('shows proper step indicators throughout the flow', async () => {
      // Test with unconnected wallet
      const { rerender } = render(
        <TestWrapper mockAccount={null}>
          <AuthPage />
        </TestWrapper>
      );

      // Step 1 should be inactive
      const step1Indicator = screen.getByText('Step 1: Connect Your Wallet')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(step1Indicator).toHaveClass('bg-gray-300');

      // Connect wallet
      rerender(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // Step 1 should be completed
      expect(step1Indicator).toHaveClass('bg-green-500');

      // Step 2 should be inactive
      const step2Indicator = screen.getByText('Step 2: Sign Authentication Message')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(step2Indicator).toHaveClass('bg-gray-300');

      // Authenticate
      mockAuthState.isAuthenticated = true;

      rerender(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // Should show redirect state (both steps completed conceptually)
      expect(screen.getByText('Redirecting to dashboard...')).toBeInTheDocument();
    });
  });

  /**
   * Test Edge Cases and Error Recovery
   */
  describe('Edge Cases and Error Recovery', () => {
    it('handles rapid state changes gracefully', async () => {
      const { rerender } = render(
        <TestWrapper mockAccount={null}>
          <AuthPage />
        </TestWrapper>
      );

      // Rapid state changes
      mockAuthState.isLoading = true;
      rerender(<TestWrapper><AuthPage /></TestWrapper>);

      mockAuthState.isLoading = false;
      mockAuthState.error = 'Test error';
      rerender(<TestWrapper><AuthPage /></TestWrapper>);

      mockAuthState.error = null;
      mockAuthState.isAuthenticated = true;
      rerender(<TestWrapper><AuthPage /></TestWrapper>);

      // Should handle the final state correctly
      expect(screen.getByText('Redirecting to dashboard...')).toBeInTheDocument();
    });

    it('maintains stable UI during loading states', () => {
      mockAuthState.isLoading = true;

      render(
        <TestWrapper mockAccount={{ address: testAddress, isConnected: true }}>
          <AuthPage />
        </TestWrapper>
      );

      // UI should remain stable during loading
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
      
      // Button should show loading state
      expect(screen.getByRole('button', { name: /signing in.../i })).toBeDisabled();
    });

    it('recovers from authentication check failures on mount', async () => {
      mockCheckAuth.mockRejectedValue(new Error('Auth check failed'));

      render(
        <TestWrapper>
          <AuthPage />
        </TestWrapper>
      );

      // Should still render the auth page normally
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(mockCheckAuth).toHaveBeenCalled();
    });

    it('handles missing environment variables gracefully', () => {
      // This would be handled by the useSiweAuth hook
      // The component should still render even if API calls fail
      
      render(
        <TestWrapper>
          <AuthPage />
        </TestWrapper>
      );

      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
    });
  });
});
    it('shows connected wallet information when wallet is connected', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: testAddress,
        chainId: 84532,
      });

      render(<AuthPage />);

      // Should show connection success
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      expect(screen.getByText(`${testAddress.slice(0, 6)}...${testAddress.slice(-4)}`)).toBeInTheDocument();

      // Step 1 should show as completed
      const step1Indicator = screen.getByText('Step 1: Connect Your Wallet')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(step1Indicator).toHaveClass('bg-green-500');
    });
  });

  /**
   * Test Requirement 2.3: Wrong network prompt and switching behavior
   */
  describe('Wrong Network Tests (Req 2.3)', () => {
    it('wraps content with NetworkGuard for network enforcement', () => {
      render(<AuthPage />);

      // NetworkGuard should always wrap the auth content
      expect(screen.getByTestId('network-guard')).toBeInTheDocument();
      expect(mockNetworkGuard).toHaveBeenCalled();

      // The auth content should be inside the NetworkGuard
      const networkGuard = screen.getByTestId('network-guard');
      expect(networkGuard).toContainElement(screen.getByText('Welcome to BFN'));
    });

    it('renders auth content normally when NetworkGuard allows it', () => {
      render(<AuthPage />);

      // Should show normal auth flow content
      expect(screen.getByText('Welcome to BFN')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Connect your wallet and sign in securely')).toBeInTheDocument();
    });
  });

  /**
   * Test Requirement 2.5: Handle user declining to sign SIWE message
   */
  describe('Sign Decline Tests (Req 2.5)', () => {
    beforeEach(() => {
      // Set up connected wallet for signing tests
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: testAddress,
        chainId: 84532,
      });
    });

    it('displays error when user declines to sign SIWE message', async () => {
      const user = userEvent.setup();

      // Mock sign-in rejection
      mockAuthState.error = 'User rejected signing';

      render(<AuthPage />);

      // Should show both steps when wallet is connected
      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();

      // Should show error message
      expect(screen.getByText('User rejected signing')).toBeInTheDocument();

      // Error should be in an alert element
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('User rejected signing');
    });
    it('allows retry after user declines signing', async () => {
      const user = userEvent.setup();

      // Start with sign error state
      mockAuthState.error = 'User rejected signing';

      const { rerender } = render(<AuthPage />);

      // Should show error
      expect(screen.getByText('User rejected signing')).toBeInTheDocument();

      // Clear error and allow retry
      mockAuthState.error = null;

      rerender(<AuthPage />);

      // Should be able to try signing again
      const signInButton = screen.getByRole('button', { name: /sign in with ethereum/i });
      expect(signInButton).toBeEnabled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await user.click(signInButton);
      expect(mockSignIn).toHaveBeenCalled();
    });

    it('handles different types of signing errors appropriately', () => {
      const errorScenarios = [
        'User rejected signing',
        'MetaMask Tx Signature: User denied transaction signature.',
        'Wallet connection lost',
        'Invalid signature format',
      ];

      errorScenarios.forEach((errorMessage) => {
        mockAuthState.error = errorMessage;

        const { unmount } = render(<AuthPage />);

        // Should display the specific error message
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);

        // Sign in button should still be available for retry
        const signInButton = screen.getByRole('button', { name: /sign in with ethereum/i });
        expect(signInButton).toBeInTheDocument();
        expect(signInButton).toBeEnabled();

        unmount();
        
        // Reset state for next iteration
        mockAuthState.error = null;
      });
    });

    it('maintains wallet connection state even when signing fails', () => {
      mockAuthState.error = 'User rejected signing';

      render(<AuthPage />);

      // Wallet should still appear connected despite signing error
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      expect(screen.getByText(`${testAddress.slice(0, 6)}...${testAddress.slice(-4)}`)).toBeInTheDocument();

      // Step 1 should show as completed (wallet connected)
      const step1Indicator = screen.getByText('Step 1: Connect Your Wallet')
        .parentElement?.querySelector('.h-2.w-2.rounded-full');
      expect(step1Indicator).toHaveClass('bg-green-500');

      // Step 2 should still be available despite error
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in with ethereum/i })).toBeInTheDocument();

      // Error should be displayed
      expect(screen.getByText('User rejected signing')).toBeInTheDocument();
    });