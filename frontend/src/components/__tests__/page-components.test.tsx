/**
 * Task 21.12: Write component tests for pages
 * 
 * Component tests covering data-source wiring, loading/error/retry rendering,
 * and role gating across pages.
 * 
 * Requirements Coverage:
 * - 11.1: Dashboard displays real data from on-chain reads
 * - 11.3: Interactive charts populated from real contract data (no mocks)
 * - 11.4: Loading states without placeholder financial values
 * - 14.9: Admin role gating with unauthorized access blocked
 * - 15.5: Component testing (fixtures, mocks, assertions)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
}));

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
}));

jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: jest.fn(),
}));

jest.mock('@/hooks/useSavingsVault', () => ({
  useSavingsVaultBalances: jest.fn(),
  useSavingsVaultDeposit: jest.fn(),
  useSavingsVaultWithdraw: jest.fn(),
  useTokenBalance: jest.fn(),
  formatTokenAmount: jest.fn(),
  validateAmount: jest.fn(),
}));

jest.mock('@/hooks/useAdminData', () => ({
  useAdminData: jest.fn(),
}));

// Test wrapper for React Query
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}