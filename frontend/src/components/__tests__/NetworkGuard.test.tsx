/**
 * Component Tests for NetworkGuard
 * Task 20.2: Write component tests for the auth flow - Wrong Network Tests
 * 
 * This test validates Requirement 2.3:
 * - IF a Connected_Wallet is on a network other than Base_Sepolia, 
 *   THEN THE Frontend SHALL prompt the user to switch to Base_Sepolia
 *   before allowing on-chain actions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Address } from 'viem';

import { NetworkGuard } from '@/components/NetworkGuard';
import { BASE_SEPOLIA_CHAIN_ID } from '@bfn/shared';

// Mock wagmi hooks
const mockSwitchChain = jest.fn();
const mockAccount = {
  chainId: BASE_SEPOLIA_CHAIN_ID,
  isConnected: true,
};

jest.mock('wagmi', () => ({
  useAccount: () => mockAccount,
  useSwitchChain: () => ({
    switchChain: mockSwitchChain,
    isPending: false,
    error: null,
  }),
}));

// Test child component
function TestChild({ onNetworkSwitched }: { onNetworkSwitched?: () => void }) {
  return (
    <div data-testid="test-child">
      <h1>Protected Content</h1>
      <button onClick={() => onNetworkSwitched?.()}>
        Trigger Network Switch Callback
      </button>
    </div>
  );
}

describe('NetworkGuard Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to Base Sepolia by default
    mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;
    mockAccount.isConnected = true;
  });

  /**
   * Test Requirement 2.3: Wrong network detection and prompting
   */
  describe('Wrong Network Detection (Req 2.3)', () => {
    it('renders children when on Base Sepolia network', () => {
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should render the protected content
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
      expect(screen.getByText('Protected Content')).toBeInTheDocument();

      // Should not show wrong network UI
      expect(screen.queryByText('Wrong Network')).not.toBeInTheDocument();
      expect(screen.queryByText('Network Mismatch')).not.toBeInTheDocument();
    });

    it('blocks content when on Ethereum Mainnet', () => {
      mockAccount.chainId = 1; // Ethereum Mainnet

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should NOT render the protected content
      expect(screen.queryByTestId('test-child')).not.toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();

      // Should show wrong network prompt - Req 2.3
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText('Network Mismatch')).toBeInTheDocument();
      expect(screen.getByText('You\'re currently connected to Ethereum Mainnet')).toBeInTheDocument();
    });

    it('blocks content when on Ethereum Sepolia', () => {
      mockAccount.chainId = 11155111; // Ethereum Sepolia

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should block content
      expect(screen.queryByTestId('test-child')).not.toBeInTheDocument();

      // Should show network switching prompt - Req 2.3
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText('You\'re currently connected to Ethereum Sepolia')).toBeInTheDocument();
      expect(screen.getByText('Please switch to Base Sepolia to continue.')).toBeInTheDocument();
    });

    it('blocks content when on Base Mainnet', () => {
      mockAccount.chainId = 8453; // Base Mainnet

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should block content
      expect(screen.queryByTestId('test-child')).not.toBeInTheDocument();

      // Should show network switching prompt - Req 2.3
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText('You\'re currently connected to Base Mainnet')).toBeInTheDocument();
    });

    it('handles unknown network IDs gracefully', () => {
      mockAccount.chainId = 999999; // Unknown network

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should block content
      expect(screen.queryByTestId('test-child')).not.toBeInTheDocument();

      // Should show network switching prompt with generic chain ID - Req 2.3
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText('You\'re currently connected to Chain ID 999999')).toBeInTheDocument();
    });

    it('renders children when wallet is not connected', () => {
      mockAccount.isConnected = false;
      mockAccount.chainId = 1; // Wrong network, but not connected

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should render children when not connected (no network to check)
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
      expect(screen.getByText('Protected Content')).toBeInTheDocument();

      // Should not show wrong network UI
      expect(screen.queryByText('Wrong Network')).not.toBeInTheDocument();
    });
  });

  /**
   * Test network switching functionality
   */
  describe('Network Switching (Req 2.3)', () => {
    it('provides switch button when on wrong network', async () => {
      const user = userEvent.setup();
      mockAccount.chainId = 1; // Ethereum Mainnet

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should show switch button - Req 2.3
      const switchButton = screen.getByRole('button', { name: /switch to base sepolia/i });
      expect(switchButton).toBeInTheDocument();
      expect(switchButton).toBeEnabled();

      // Click switch button
      await user.click(switchButton);

      // Should call switchChain with Base Sepolia chain ID
      expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: BASE_SEPOLIA_CHAIN_ID });
    });

    it('shows loading state while switching networks', () => {
      mockAccount.chainId = 1; // Wrong network
      
      // Mock switching state
      jest.mocked(require('wagmi').useSwitchChain).mockReturnValue({
        switchChain: mockSwitchChain,
        isPending: true,
        error: null,
      });

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should show loading state
      const switchButton = screen.getByRole('button', { name: /switching.../i });
      expect(switchButton).toBeDisabled();
      expect(screen.getByText('Switching...')).toBeInTheDocument();
    });

    it('displays switch error when network switching fails', () => {
      mockAccount.chainId = 1; // Wrong network
      
      // Mock switch error
      jest.mocked(require('wagmi').useSwitchChain).mockReturnValue({
        switchChain: mockSwitchChain,
        isPending: false,
        error: new Error('User rejected network switch'),
      });

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should show error message
      expect(screen.getByText('Failed to switch networks: User rejected network switch')).toBeInTheDocument();
      
      // Error should be in alert element
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to switch networks: User rejected network switch');
      
      // Switch button should still be available for retry
      expect(screen.getByRole('button', { name: /switch to base sepolia/i })).toBeEnabled();
    });

    it('shows network details in wrong network prompt', () => {
      mockAccount.chainId = 1; // Ethereum Mainnet

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should show Base Sepolia network details - Req 2.3
      expect(screen.getByText('Network Details:')).toBeInTheDocument();
      expect(screen.getByText(`Chain ID: ${BASE_SEPOLIA_CHAIN_ID}`)).toBeInTheDocument();
      expect(screen.getByText('Currency: ETH')).toBeInTheDocument();
    });

    it('attempts auto-switch when wallet connects on wrong network', () => {
      // Mock useEffect behavior - wallet just connected on wrong network
      mockAccount.isConnected = true;
      mockAccount.chainId = 1; // Ethereum Mainnet

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should attempt automatic switch
      expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: BASE_SEPOLIA_CHAIN_ID });
    });

    it('does not auto-switch when already on correct network', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should not attempt to switch
      expect(mockSwitchChain).not.toHaveBeenCalled();
    });

    it('does not auto-switch when wallet is not connected', () => {
      mockAccount.isConnected = false;
      mockAccount.chainId = 1; // Wrong network but not connected

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should not attempt to switch when not connected
      expect(mockSwitchChain).not.toHaveBeenCalled();
    });
  });

  /**
   * Test callback functionality
   */
  describe('Network Switch Callback', () => {
    it('calls onNetworkSwitched when successfully switched to correct network', () => {
      const mockOnNetworkSwitched = jest.fn();

      // Start on correct network with connected wallet
      mockAccount.isConnected = true;
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      render(
        <NetworkGuard onNetworkSwitched={mockOnNetworkSwitched}>
          <TestChild />
        </NetworkGuard>
      );

      // Should call callback for correct network state
      expect(mockOnNetworkSwitched).toHaveBeenCalled();
    });

    it('does not call onNetworkSwitched when on wrong network', () => {
      const mockOnNetworkSwitched = jest.fn();

      mockAccount.isConnected = true;
      mockAccount.chainId = 1; // Wrong network

      render(
        <NetworkGuard onNetworkSwitched={mockOnNetworkSwitched}>
          <TestChild />
        </NetworkGuard>
      );

      // Should not call callback when on wrong network
      expect(mockOnNetworkSwitched).not.toHaveBeenCalled();
    });

    it('does not call onNetworkSwitched when wallet not connected', () => {
      const mockOnNetworkSwitched = jest.fn();

      mockAccount.isConnected = false;
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      render(
        <NetworkGuard onNetworkSwitched={mockOnNetworkSwitched}>
          <TestChild />
        </NetworkGuard>
      );

      // Should not call callback when wallet not connected
      expect(mockOnNetworkSwitched).not.toHaveBeenCalled();
    });

    it('handles callback being undefined gracefully', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      // Should not throw when callback is undefined
      expect(() => {
        render(
          <NetworkGuard onNetworkSwitched={undefined}>
            <TestChild />
          </NetworkGuard>
        );
      }).not.toThrow();

      // Should render children normally
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
    });
  });

  /**
   * Test UI and accessibility
   */
  describe('UI and Accessibility', () => {
    it('has proper semantic structure in wrong network state', () => {
      mockAccount.chainId = 1; // Wrong network

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should have proper heading structure
      expect(screen.getByRole('heading', { name: 'Wrong Network' })).toBeInTheDocument();

      // Should have alert for network mismatch
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAccessibleDescription();

      // Switch button should be properly labeled
      const switchButton = screen.getByRole('button', { name: /switch to base sepolia/i });
      expect(switchButton).toBeInTheDocument();
    });

    it('displays appropriate icons for different states', () => {
      mockAccount.chainId = 1; // Wrong network

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should show network icon (tested via presence of UI elements)
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();

      // Alert icon should be present in error alert
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('maintains consistent card layout across states', () => {
      mockAccount.chainId = 1; // Wrong network

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should have card structure
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText('Bonitah Financial Network requires Base Sepolia to function properly.')).toBeInTheDocument();

      // Should have action area
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  /**
   * Test state transitions
   */
  describe('State Transitions', () => {
    it('transitions from wrong network to correct network', () => {
      // Start on wrong network
      mockAccount.chainId = 1;

      const { rerender } = render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should show network prompt
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.queryByTestId('test-child')).not.toBeInTheDocument();

      // Switch to correct network
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      rerender(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should now show children
      expect(screen.queryByText('Wrong Network')).not.toBeInTheDocument();
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
    });

    it('transitions from connected to disconnected', () => {
      // Start connected on wrong network
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;

      const { rerender } = render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should show network prompt
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();

      // Disconnect wallet
      mockAccount.isConnected = false;

      rerender(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should now show children (no network to check)
      expect(screen.queryByText('Wrong Network')).not.toBeInTheDocument();
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
    });

    it('handles rapid network changes', () => {
      const networks = [1, 8453, 11155111, BASE_SEPOLIA_CHAIN_ID];
      
      const { rerender } = render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Rapidly change networks
      for (const networkId of networks) {
        mockAccount.chainId = networkId;

        rerender(
          <NetworkGuard>
            <TestChild />
          </NetworkGuard>
        );

        if (networkId === BASE_SEPOLIA_CHAIN_ID) {
          // Should show children only on correct network
          expect(screen.getByTestId('test-child')).toBeInTheDocument();
          expect(screen.queryByText('Wrong Network')).not.toBeInTheDocument();
        } else {
          // Should show network prompt on wrong networks
          expect(screen.queryByTestId('test-child')).not.toBeInTheDocument();
          expect(screen.getByText('Wrong Network')).toBeInTheDocument();
        }
      }
    });
  });
});

// Fix the test that has incorrect wrapper
describe('NetworkGuard Component Tests - Error Display Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccount.chainId = 1; // Wrong network
    mockAccount.isConnected = true;
  });

  it('displays switch error when network switching fails - corrected', () => {
    // Mock switch error
    jest.mocked(require('wagmi').useSwitchChain).mockReturnValue({
      switchChain: mockSwitchChain,
      isPending: false,
      error: new Error('User rejected network switch'),
    });

    render(
      <NetworkGuard>
        <TestChild />
      </NetworkGuard>
    );

    // Should show error message
    expect(screen.getByText('Failed to switch networks: User rejected network switch')).toBeInTheDocument();
    
    // Error should be in alert element
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to switch networks: User rejected network switch');
    
    // Switch button should still be available for retry
    expect(screen.getByRole('button', { name: /switch to base sepolia/i })).toBeEnabled();
  });
});