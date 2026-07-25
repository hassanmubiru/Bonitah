/**
 * NetworkGuard Component Edge Cases Tests
 * Task 20.2: Write component tests for the auth flow - Network Guard Edge Cases
 * 
 * Tests for Requirement 2.3: Wrong network detection and Base Sepolia switch prompts
 * This focuses on edge cases and error scenarios for the NetworkGuard component
 * that protects the auth flow from wrong network issues.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NetworkGuard } from '@/components/NetworkGuard';
import { BASE_SEPOLIA_CHAIN_ID } from '@bfn/shared';

// Mock wagmi hooks with controlled state
interface MockAccount {
  isConnected: boolean;
  chainId?: number;
}

interface MockSwitchChain {
  switchChain: jest.MockedFunction<any>;
  isPending: boolean;
  error?: Error | null;
}

const mockAccount: MockAccount = {
  isConnected: false,
  chainId: undefined,
};

const mockSwitchChain: MockSwitchChain = {
  switchChain: jest.fn(),
  isPending: false,
  error: null,
};

jest.mock('wagmi', () => ({
  useAccount: () => mockAccount,
  useSwitchChain: () => mockSwitchChain,
}));

describe('NetworkGuard Component - Edge Cases', () => {
  const TestChild = () => <div data-testid="protected-content">Protected Content</div>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccount.isConnected = false;
    mockAccount.chainId = undefined;
    mockSwitchChain.switchChain.mockClear();
    mockSwitchChain.isPending = false;
    mockSwitchChain.error = null;
  });

  /**
   * Test Requirement 2.3: Wrong network detection and prompts
   */
  describe('Wrong Network Detection (Req 2.3)', () => {
    test('renders children when wallet not connected', () => {
      mockAccount.isConnected = false;

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(screen.queryByText('Wrong Network')).not.toBeInTheDocument();
    });

    test('renders children when on correct network', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(screen.queryByText('Wrong Network')).not.toBeInTheDocument();
    });

    test('blocks content when on Ethereum Mainnet', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 1; // Ethereum Mainnet

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText(/Ethereum Mainnet/)).toBeInTheDocument();
    });

    test('blocks content when on Ethereum Sepolia', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 11155111; // Ethereum Sepolia

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText(/Ethereum Sepolia/)).toBeInTheDocument();
    });

    test('blocks content when on Base Mainnet', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 8453; // Base Mainnet

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText('Switch to Base Sepolia')).toBeInTheDocument();
    });

    test('handles unknown network gracefully', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 99999; // Unknown network

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText('Chain ID 99999')).toBeInTheDocument();
    });

    test('handles missing chain ID gracefully', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = undefined;

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // NetworkGuard blocks when chainId is undefined but connected 
      // (this is the actual behavior - it treats undefined chainId as wrong network)
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText('Unknown Network')).toBeInTheDocument();
    });
  });

  /**
   * Test network switching functionality and error handling
   */
  describe('Network Switching', () => {
    test('calls switchChain when switch button is clicked', async () => {
      const user = userEvent.setup();
      mockAccount.isConnected = true;
      mockAccount.chainId = 1; // Ethereum Mainnet

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      const switchButton = screen.getByRole('button', { name: /switch to base sepolia/i });
      await user.click(switchButton);

      expect(mockSwitchChain.switchChain).toHaveBeenCalledWith({ 
        chainId: BASE_SEPOLIA_CHAIN_ID 
      });
    });

    test('shows loading state during network switch', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;
      mockSwitchChain.isPending = true;

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.getByRole('button', { name: /switching.../i })).toBeDisabled();
    });

    test('displays switch error when network switch fails', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;
      mockSwitchChain.error = new Error('User rejected network switch');

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.getByText('Failed to switch networks: User rejected network switch')).toBeInTheDocument();
      const alerts = screen.getAllByRole('alert');
      const errorAlert = alerts.find(alert => alert.textContent?.includes('User rejected network switch'));
      expect(errorAlert).toBeTruthy();
      expect(errorAlert).toHaveTextContent('User rejected network switch');
    });

    test('handles MetaMask network switch rejection', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;
      mockSwitchChain.error = new Error('MetaMask: User rejected the request');

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.getByText('Failed to switch networks: MetaMask: User rejected the request')).toBeInTheDocument();
    });

    test('handles network not added to wallet error', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;
      mockSwitchChain.error = new Error('Unrecognized chain ID. Try adding the chain first');

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.getByText(/Unrecognized chain ID/)).toBeInTheDocument();
    });

    test('allows retry after switch error', async () => {
      const user = userEvent.setup();
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;
      
      // Start with error
      mockSwitchChain.error = new Error('Network switch failed');
      const { rerender } = render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.getByText(/Network switch failed/)).toBeInTheDocument();

      // Clear error
      mockSwitchChain.error = null;
      rerender(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should be able to retry
      const switchButton = screen.getByRole('button', { name: /switch to base sepolia/i });
      expect(switchButton).toBeEnabled();
      
      await user.click(switchButton);
      expect(mockSwitchChain.switchChain).toHaveBeenCalledWith({ 
        chainId: BASE_SEPOLIA_CHAIN_ID 
      });
    });
  });

  /**
   * Test auto-switching behavior
   */
  describe('Auto-Switching Behavior', () => {
    test('attempts auto-switch when wallet connects on wrong network', () => {
      // Initial render - not connected
      const { rerender } = render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();

      // Wallet connects on wrong network
      mockAccount.isConnected = true;
      mockAccount.chainId = 1; // Ethereum Mainnet

      rerender(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should have attempted auto-switch
      expect(mockSwitchChain.switchChain).toHaveBeenCalledWith({ 
        chainId: BASE_SEPOLIA_CHAIN_ID 
      });
    });

    test('does not auto-switch if already on correct network', () => {
      // Initial render - not connected
      const { rerender } = render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Wallet connects on correct network
      mockAccount.isConnected = true;
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      rerender(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should not attempt switch
      expect(mockSwitchChain.switchChain).not.toHaveBeenCalled();
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    test('calls onNetworkSwitched callback when successfully switched', () => {
      const onNetworkSwitched = jest.fn();
      mockAccount.isConnected = true;
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;

      render(
        <NetworkGuard onNetworkSwitched={onNetworkSwitched}>
          <TestChild />
        </NetworkGuard>
      );

      expect(onNetworkSwitched).toHaveBeenCalled();
    });

    test('does not call onNetworkSwitched when on wrong network', () => {
      const onNetworkSwitched = jest.fn();
      mockAccount.isConnected = true;
      mockAccount.chainId = 1; // Wrong network

      render(
        <NetworkGuard onNetworkSwitched={onNetworkSwitched}>
          <TestChild />
        </NetworkGuard>
      );

      expect(onNetworkSwitched).not.toHaveBeenCalled();
    });
  });

  /**
   * Test UI components and accessibility
   */
  describe('UI and Accessibility', () => {
    test('has proper heading structure', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should have proper heading (this is the fixed version)
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
      expect(screen.getByText('Wrong Network').tagName).toBe('DIV'); // Card title, not h1
    });

    test('shows network details correctly', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should show chain ID and currency
      expect(screen.getByText(`Chain ID: ${BASE_SEPOLIA_CHAIN_ID}`)).toBeInTheDocument();
      expect(screen.getByText('Currency: ETH')).toBeInTheDocument();
    });

    test('has accessible alert for network mismatch', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Network Mismatch');
      expect(alert).toHaveTextContent('Ethereum Mainnet');
    });

    test('switch button has proper accessibility', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      const switchButton = screen.getByRole('button', { name: /switch to base sepolia/i });
      expect(switchButton).toBeEnabled();
      expect(switchButton).toHaveTextContent('Switch to Base Sepolia');
    });

    test('disabled button during loading has proper state', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;
      mockSwitchChain.isPending = true;

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      const switchButton = screen.getByRole('button', { name: /switching.../i });
      expect(switchButton).toBeDisabled();
    });

    test('shows correct network names for common networks', () => {
      const networkScenarios = [
        { chainId: 1, expectedName: 'Ethereum Mainnet' },
        { chainId: 11155111, expectedName: 'Ethereum Sepolia' },
        { chainId: 8453, expectedName: 'Base Mainnet' },
        { chainId: 84531, expectedName: 'Base Goerli' },
        { chainId: 84532, expectedName: 'Base Sepolia' },
      ];

      networkScenarios.forEach(({ chainId, expectedName }) => {
        mockAccount.isConnected = true;
        mockAccount.chainId = chainId;

        const { unmount } = render(
          <NetworkGuard>
            <TestChild />
          </NetworkGuard>
        );

        if (chainId === BASE_SEPOLIA_CHAIN_ID) {
          // Should show children, not wrong network UI
          expect(screen.getByTestId('protected-content')).toBeInTheDocument();
          expect(screen.queryByText('Wrong Network')).not.toBeInTheDocument();
        } else {
          // Should show wrong network UI with correct name
          expect(screen.getByText('Wrong Network')).toBeInTheDocument();
          expect(screen.getByText(expectedName)).toBeInTheDocument();
        }

        unmount();
      });
    });
  });

  /**
   * Test state transitions and edge cases
   */
  describe('State Transitions and Edge Cases', () => {
    test('handles rapid network changes gracefully', () => {
      const { rerender } = render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Rapid network changes
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;
      rerender(<NetworkGuard><TestChild /></NetworkGuard>);
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;
      rerender(<NetworkGuard><TestChild /></NetworkGuard>);
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();

      mockAccount.chainId = 8453; // Base Mainnet
      rerender(<NetworkGuard><TestChild /></NetworkGuard>);
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

      // Should handle each state correctly
      expect(screen.getByText('Wrong Network')).toBeInTheDocument();
    });

    test('handles wallet disconnection while on wrong network', () => {
      // Start on wrong network
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;

      const { rerender } = render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.getByText('Wrong Network')).toBeInTheDocument();

      // Wallet disconnects
      mockAccount.isConnected = false;
      mockAccount.chainId = undefined;

      rerender(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should now show children (disconnected state)
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(screen.queryByText('Wrong Network')).not.toBeInTheDocument();
    });

    test('maintains error state during network switch loading', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;
      mockSwitchChain.error = new Error('Previous error');
      mockSwitchChain.isPending = true;

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should show both error and loading state
      expect(screen.getByText('Failed to switch networks: Previous error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /switching.../i })).toBeDisabled();
    });

    test('clears error when switching to correct network', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;
      mockSwitchChain.error = new Error('Switch failed');

      const { rerender } = render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      expect(screen.getByText('Failed to switch networks: Switch failed')).toBeInTheDocument();

      // Simulate successful switch
      mockAccount.chainId = BASE_SEPOLIA_CHAIN_ID;
      mockSwitchChain.error = null;

      rerender(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should show children, no error
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(screen.queryByText('Switch failed')).not.toBeInTheDocument();
    });

    test('handles multiple network switch attempts', async () => {
      const user = userEvent.setup();
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;

      render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      const switchButton = screen.getByRole('button', { name: /switch to base sepolia/i });
      
      // Multiple clicks
      await user.click(switchButton);
      await user.click(switchButton);
      await user.click(switchButton);

      // Should have been called multiple times
      expect(mockSwitchChain.switchChain).toHaveBeenCalledTimes(3);
      expect(mockSwitchChain.switchChain).toHaveBeenCalledWith({ 
        chainId: BASE_SEPOLIA_CHAIN_ID 
      });
    });

    test('handles component unmount during network switch', () => {
      mockAccount.isConnected = true;
      mockAccount.chainId = 1;

      const { unmount } = render(
        <NetworkGuard>
          <TestChild />
        </NetworkGuard>
      );

      // Should not throw when unmounted
      expect(() => unmount()).not.toThrow();
    });
  });
});