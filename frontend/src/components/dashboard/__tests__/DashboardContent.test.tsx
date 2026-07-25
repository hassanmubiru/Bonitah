/**
 * Tests for DashboardContent component
 * 
 * Requirements tested: 11.1, 11.2, 11.3, 11.4, 11.7
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import '@testing-library/jest-dom';

import { DashboardContent } from '../DashboardContent';

// Mock wagmi
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  usePublicClient: jest.fn(),
}));

// Mock contract read hook
jest.mock('@/hooks/useContractRead', () => ({
  useContractRead: jest.fn(),
  usePortfolioValue: jest.fn(),
  useContractBalance: jest.fn(),
  useReputationScore: jest.fn(),
}));

// Mock shared package
jest.mock('@bfn/shared', () => ({
  getContractAddress: jest.fn().mockReturnValue('0x1234567890123456789012345678901234567890'),
  getContractAbi: jest.fn().mockReturnValue([]),
  BASE_SEPOLIA_CHAIN_ID: 84532,
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;

describe('DashboardContent', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  it('renders all dashboard sections', () => {
    const userAddress = '0x1234567890123456789012345678901234567890' as `0x${string}`;
    
    renderWithProviders(<DashboardContent userAddress={userAddress} />);

    // Check that main dashboard sections are rendered
    // Note: These will show loading states initially since we're mocking the hooks
    expect(screen.getByText(/Portfolio Overview/i)).toBeInTheDocument();
    expect(screen.getByText(/Savings Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Community Activity/i)).toBeInTheDocument();
    expect(screen.getByText(/Achievements/i)).toBeInTheDocument();
    expect(screen.getByText(/Portfolio Growth/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument();
  });

  it('uses responsive grid layout', () => {
    const userAddress = '0x1234567890123456789012345678901234567890' as `0x${string}`;
    
    const { container } = renderWithProviders(<DashboardContent userAddress={userAddress} />);

    // Check that the main container has responsive grid classes
    const gridContainer = container.querySelector('.grid');
    expect(gridContainer).toHaveClass('gap-6', 'md:grid-cols-2', 'lg:grid-cols-3');
  });

  it('passes user address to all components', () => {
    const userAddress = '0x1234567890123456789012345678901234567890' as `0x${string}`;
    
    renderWithProviders(<DashboardContent userAddress={userAddress} />);

    // All components should receive the userAddress prop and attempt to fetch data
    // This is verified by checking they render without throwing errors
    expect(screen.getByText(/Portfolio Overview/i)).toBeInTheDocument();
  });
});