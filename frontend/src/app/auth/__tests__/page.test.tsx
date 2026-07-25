import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import AuthPage from '../page';
import { useSiweAuth } from '@/hooks/useSiweAuth';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
}));

// Mock RainbowKit ConnectButton
jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: jest.fn((props) => (
    <button data-testid="connect-button" {...props}>
      Connect Wallet
    </button>
  )),
}));

// Mock SIWE auth hook
jest.mock('@/hooks/useSiweAuth', () => ({
  useSiweAuth: jest.fn(),
}));

// Mock NetworkGuard component
jest.mock('@/components/NetworkGuard', () => ({
  NetworkGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;
const mockUseSiweAuth = useSiweAuth as jest.MockedFunction<typeof useSiweAuth>;
const mockConnectButton = ConnectButton as jest.MockedFunction<typeof ConnectButton>;

describe('Auth Page Component Tests (Task 21.12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Data Source Wiring', () => {
    it('displays wallet connection status from useAccount hook', () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: testAddress as any,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      expect(screen.getByText(`${testAddress.slice(0, 6)}...${testAddress.slice(-4)}`)).toBeInTheDocument();
    });

    it('displays authentication status from useSiweAuth hook', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      expect(screen.getByText('Authenticated ✓')).toBeInTheDocument();
    });

    it('calls signIn function when Sign In button is clicked', async () => {
      const mockSignIn = jest.fn();
      
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        signIn: mockSignIn,
      });

      render(<AuthPage />);

      const signInButton = screen.getByRole('button', { name: /sign in with ethereum/i });
      fireEvent.click(signInButton);

      expect(mockSignIn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading/Error/Retry Rendering', () => {
    it('displays loading state during SIWE signing', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true, // Loading state
        error: null,
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      expect(screen.getByText('Signing In...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    });

    it('displays error state when authentication fails', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        error: 'Authentication failed: Invalid signature',
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      expect(screen.getByText('Authentication failed: Invalid signature')).toBeInTheDocument();
      
      // Error alert should be visible
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('shows redirecting state when authenticated', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      expect(screen.getByText('Redirecting to dashboard...')).toBeInTheDocument();
    });

    it('allows retry after authentication error', async () => {
      const mockSignIn = jest.fn();
      
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        error: 'Network error',
        signIn: mockSignIn,
      });

      render(<AuthPage />);

      // Error should be displayed
      expect(screen.getByText('Network error')).toBeInTheDocument();

      // Sign In button should still be clickable for retry
      const signInButton = screen.getByRole('button', { name: /sign in with ethereum/i });
      expect(signInButton).toBeEnabled();
      
      fireEvent.click(signInButton);
      expect(mockSignIn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Authentication Flow States', () => {
    it('shows step 1 incomplete when wallet not connected', () => {
      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      const stepIndicators = screen.getAllByText(/step \d:/i);
      expect(stepIndicators[0]).toHaveTextContent('Step 1: Connect Your Wallet');
      
      // Step 2 should not be visible
      expect(screen.queryByText('Step 2: Sign Authentication Message')).not.toBeInTheDocument();
    });

    it('shows step 2 when wallet is connected', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      expect(screen.getByText('Step 1: Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Sign Authentication Message')).toBeInTheDocument();
    });

    it('shows correct step completion status', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      const { container } = render(<AuthPage />);

      // Both steps should show green completion indicators
      const completionIndicators = container.querySelectorAll('.bg-green-500');
      expect(completionIndicators).toHaveLength(2);
    });
  });

  describe('Navigation and Redirection', () => {
    it('redirects to dashboard when authenticated', async () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('does not redirect when not authenticated', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      expect(mockPush).not.toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('UI Components and Integration', () => {
    it('renders ConnectButton with correct props', () => {
      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      expect(mockConnectButton).toHaveBeenCalledWith(
        expect.objectContaining({
          showBalance: false,
          chainStatus: 'icon',
          accountStatus: {
            smallScreen: 'avatar',
            largeScreen: 'full',
          },
        }),
        expect.anything()
      );
    });

    it('displays proper card structure and content', () => {
      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      expect(screen.getByRole('heading', { level: 1, name: 'Welcome to BFN' })).toBeInTheDocument();
      expect(screen.getByText('Connect your wallet and sign in securely to access Bonitah Financial Network')).toBeInTheDocument();
    });

    it('includes security information and help text', () => {
      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      expect(screen.getByText('Secure Wallet-Based Authentication')).toBeInTheDocument();
      expect(screen.getByText('• No passwords or personal information required')).toBeInTheDocument();
      expect(screen.getByText('• Your wallet signature proves ownership')).toBeInTheDocument();
      expect(screen.getByText('• All financial data comes from the blockchain')).toBeInTheDocument();
      expect(screen.getByText('• You maintain full control of your funds')).toBeInTheDocument();
    });

    it('disables sign-in button when not connected', () => {
      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      // Sign-in button should not be present when wallet not connected
      expect(screen.queryByRole('button', { name: /sign in with ethereum/i })).not.toBeInTheDocument();
    });

    it('disables sign-in button when already authenticated', () => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      render(<AuthPage />);

      const signInButton = screen.getByRole('button', { name: /authenticated/i });
      expect(signInButton).toBeDisabled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles rapid state changes without breaking', () => {
      // Start disconnected
      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      const { rerender } = render(<AuthPage />);

      // Connect wallet
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);

      rerender(<AuthPage />);

      // Start authentication
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        error: null,
        signIn: jest.fn(),
      });

      rerender(<AuthPage />);

      expect(screen.getByText('Signing In...')).toBeInTheDocument();

      // Complete authentication
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        signIn: jest.fn(),
      });

      rerender(<AuthPage />);

      expect(screen.getByText('Redirecting to dashboard...')).toBeInTheDocument();
    });

    it('clears previous error states on successful retry', () => {
      const mockSignIn = jest.fn();
      
      // Start with error
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as any,
      } as any);
      
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        error: 'Previous error',
        signIn: mockSignIn,
      });

      const { rerender } = render(<AuthPage />);
      
      expect(screen.getByText('Previous error')).toBeInTheDocument();

      // Clear error on retry
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        error: null, // Error cleared
        signIn: mockSignIn,
      });

      rerender(<AuthPage />);

      expect(screen.queryByText('Previous error')).not.toBeInTheDocument();
      expect(screen.getByText('Signing In...')).toBeInTheDocument();
    });
  });
});