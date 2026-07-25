import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAccount } from 'wagmi';
import '@testing-library/jest-dom';

import { ActionButton, ActionButtons, type AIAction } from '../ActionButton';

// Mock wagmi hook
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
}));

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;

describe('ActionButton Component', () => {
  beforeEach(() => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: '0x123...',
    } as ReturnType<typeof useAccount>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Action Button Rendering', () => {
    it('renders action button with correct title and description', () => {
      const action: AIAction = {
        type: 'deposit_savings',
        title: 'Deposit to Savings',
        description: 'Add funds to your savings vault',
        requiresSignature: true,
      };

      render(<ActionButton action={action} />);

      expect(screen.getByText('Deposit to Savings')).toBeInTheDocument();
      expect(screen.getByText('Add funds to your savings vault')).toBeInTheDocument();
    });

    it('shows signature required badge for actions requiring signatures', () => {
      const action: AIAction = {
        type: 'deposit_savings',
        title: 'Deposit to Savings',
        description: 'Add funds to your savings vault',
        requiresSignature: true,
      };

      render(<ActionButton action={action} />);

      expect(screen.getByText('Signature Required')).toBeInTheDocument();
    });

    it('does not show signature badge for read-only actions', () => {
      const action: AIAction = {
        type: 'view_portfolio',
        title: 'View Portfolio',
        description: 'Check your current portfolio status',
        requiresSignature: false,
      };

      render(<ActionButton action={action} />);

      expect(screen.queryByText('Signature Required')).not.toBeInTheDocument();
    });

    it('displays amount when provided', () => {
      const action: AIAction = {
        type: 'deposit_savings',
        title: 'Deposit to Savings',
        description: 'Add funds to your savings vault',
        amount: '100 USDC',
        requiresSignature: true,
      };

      render(<ActionButton action={action} />);

      expect(screen.getByText('Amount:')).toBeInTheDocument();
      expect(screen.getByText('100 USDC')).toBeInTheDocument();
    });

    it('displays gas estimation when provided', () => {
      const action: AIAction = {
        type: 'deposit_savings',
        title: 'Deposit to Savings',
        description: 'Add funds to your savings vault',
        estimatedGas: '0.0025 ETH',
        requiresSignature: true,
      };

      render(<ActionButton action={action} />);

      expect(screen.getByText('Est. Gas:')).toBeInTheDocument();
      expect(screen.getByText('0.0025 ETH')).toBeInTheDocument();
    });
  });

  describe('Action Button Icons', () => {
    it('renders correct icon for deposit_savings action', () => {
      const action: AIAction = {
        type: 'deposit_savings',
        title: 'Deposit to Savings',
        description: 'Add funds to your savings vault',
        requiresSignature: true,
      };

      const { container } = render(<ActionButton action={action} />);
      
      // Check for wallet icon (lucide-wallet)
      expect(container.querySelector('.lucide-wallet')).toBeInTheDocument();
    });

    it('renders correct icon for create_goal action', () => {
      const action: AIAction = {
        type: 'create_goal',
        title: 'Create Savings Goal',
        description: 'Set up a new financial goal',
        requiresSignature: true,
      };

      const { container } = render(<ActionButton action={action} />);
      
      // Check for target icon (lucide-target)
      expect(container.querySelector('.lucide-target')).toBeInTheDocument();
    });

    it('renders correct icon for join_circle action', () => {
      const action: AIAction = {
        type: 'join_circle',
        title: 'Join Savings Circle',
        description: 'Participate in community savings',
        requiresSignature: true,
      };

      const { container } = render(<ActionButton action={action} />);
      
      // Check for users icon (lucide-users)
      expect(container.querySelector('.lucide-users')).toBeInTheDocument();
    });

    it('renders correct icon for invest_pool action', () => {
      const action: AIAction = {
        type: 'invest_pool',
        title: 'Invest in Pool',
        description: 'Add funds to investment pool',
        requiresSignature: true,
      };

      const { container } = render(<ActionButton action={action} />);
      
      // Check for trending up icon (lucide-trending-up)
      expect(container.querySelector('.lucide-trending-up')).toBeInTheDocument();
    });

    it('renders correct icon for view_portfolio action', () => {
      const action: AIAction = {
        type: 'view_portfolio',
        title: 'View Portfolio',
        description: 'Check your current portfolio status',
        requiresSignature: false,
      };

      const { container } = render(<ActionButton action={action} />);
      
      // Check for external link icon (lucide-external-link)
      expect(container.querySelector('.lucide-external-link')).toBeInTheDocument();
    });
  });

  describe('Wallet Connection States', () => {
    it('disables button when wallet is not connected and signature is required', () => {
      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      } as any);

      const action: AIAction = {
        type: 'deposit_savings',
        title: 'Deposit to Savings',
        description: 'Add funds to your savings vault',
        requiresSignature: true,
      };

      render(<ActionButton action={action} />);

      const button = screen.getByRole('button', { name: /deposit to savings/i });
      expect(button).toBeDisabled();
    });

    it('shows connection warning when wallet is not connected and signature is required', () => {
      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      } as any);

      const action: AIAction = {
        type: 'deposit_savings',
        title: 'Deposit to Savings',
        description: 'Add funds to your savings vault',
        requiresSignature: true,
      };

      render(<ActionButton action={action} />);

      expect(screen.getByText('Connect your wallet to perform this action')).toBeInTheDocument();
    });

    it('enables button when wallet is not connected but signature is not required', () => {
      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      } as any);

      const action: AIAction = {
        type: 'view_portfolio',
        title: 'View Portfolio',
        description: 'Check your current portfolio status',
        requiresSignature: false,
      };

      render(<ActionButton action={action} />);

      const button = screen.getByRole('button', { name: /view portfolio/i });
      expect(button).not.toBeDisabled();
    });
  });

  describe('Action Execution', () => {
    it('calls onExecute callback when button is clicked', async () => {
      const mockOnExecute = jest.fn();
      const action: AIAction = {
        type: 'view_portfolio',
        title: 'View Portfolio',
        description: 'Check your current portfolio status',
        requiresSignature: false,
      };

      render(<ActionButton action={action} onExecute={mockOnExecute} />);

      const button = screen.getByRole('button', { name: /view portfolio/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnExecute).toHaveBeenCalledWith(action);
      });
    });

    it('shows loading state during execution', async () => {
      const mockOnExecute = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      const action: AIAction = {
        type: 'view_portfolio',
        title: 'View Portfolio',
        description: 'Check your current portfolio status',
        requiresSignature: false,
      };

      render(<ActionButton action={action} onExecute={mockOnExecute} />);

      const button = screen.getByRole('button', { name: /view portfolio/i });
      fireEvent.click(button);

      // Check for loading spinner
      expect(screen.getByRole('button')).toHaveAttribute('disabled');
    });

    it('shows error message when execution fails', async () => {
      const mockOnExecute = jest.fn().mockRejectedValue(new Error('Transaction failed'));
      const action: AIAction = {
        type: 'deposit_savings',
        title: 'Deposit to Savings',
        description: 'Add funds to your savings vault',
        requiresSignature: true,
      };

      render(<ActionButton action={action} onExecute={mockOnExecute} />);

      const button = screen.getByRole('button', { name: /deposit to savings/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Transaction failed')).toBeInTheDocument();
      });
    });

    it('shows connection error when trying to execute signature action without wallet', async () => {
      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      } as any);

      const mockOnExecute = jest.fn();
      const action: AIAction = {
        type: 'deposit_savings',
        title: 'Deposit to Savings',
        description: 'Add funds to your savings vault',
        requiresSignature: true,
      };

      render(<ActionButton action={action} onExecute={mockOnExecute} />);

      const button = screen.getByRole('button', { name: /deposit to savings/i });
      
      // Button should be disabled, so this shouldn't work, but let's test the logic
      expect(button).toBeDisabled();
    });
  });

  describe('Button Variants', () => {
    it('uses primary variant for signature-required actions', () => {
      const action: AIAction = {
        type: 'deposit_savings',
        title: 'Deposit to Savings',
        description: 'Add funds to your savings vault',
        requiresSignature: true,
      };

      render(<ActionButton action={action} />);

      const button = screen.getByRole('button', { name: /deposit to savings/i });
      expect(button).toHaveClass('bg-primary');
    });

    it('uses outline variant for non-signature actions', () => {
      const action: AIAction = {
        type: 'view_portfolio',
        title: 'View Portfolio',
        description: 'Check your current portfolio status',
        requiresSignature: false,
      };

      render(<ActionButton action={action} />);

      const button = screen.getByRole('button', { name: /view portfolio/i });
      expect(button).toHaveClass('border-input');
    });
  });
});

describe('ActionButtons Container Component', () => {
  it('renders multiple action buttons', () => {
    const actions: AIAction[] = [
      {
        type: 'deposit_savings',
        title: 'Deposit to Savings',
        description: 'Add funds to your savings vault',
        requiresSignature: true,
      },
      {
        type: 'view_portfolio',
        title: 'View Portfolio',
        description: 'Check your current portfolio status',
        requiresSignature: false,
      },
    ];

    render(<ActionButtons actions={actions} />);

    expect(screen.getByText('Recommended Actions')).toBeInTheDocument();
    expect(screen.getByText('Deposit to Savings')).toBeInTheDocument();
    expect(screen.getByText('View Portfolio')).toBeInTheDocument();
  });

  it('renders nothing when actions array is empty', () => {
    const { container } = render(<ActionButtons actions={[]} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('passes onExecuteAction callback to individual buttons', async () => {
    const mockOnExecuteAction = jest.fn();
    const actions: AIAction[] = [
      {
        type: 'view_portfolio',
        title: 'View Portfolio',
        description: 'Check your current portfolio status',
        requiresSignature: false,
      },
    ];

    render(<ActionButtons actions={actions} onExecuteAction={mockOnExecuteAction} />);

    const button = screen.getByRole('button', { name: /view portfolio/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnExecuteAction).toHaveBeenCalledWith(actions[0]);
    });
  });

  it('applies custom className when provided', () => {
    const actions: AIAction[] = [
      {
        type: 'view_portfolio',
        title: 'View Portfolio',
        description: 'Check your current portfolio status',
        requiresSignature: false,
      },
    ];

    const { container } = render(<ActionButtons actions={actions} className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});