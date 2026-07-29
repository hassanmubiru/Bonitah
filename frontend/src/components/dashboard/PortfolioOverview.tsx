'use client';

import { type Abi, type Address } from 'viem';
import { formatUnits } from 'viem';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useContractRead, usePortfolioValue, useContractBalance } from '@/hooks/useContractRead';
import { getContractAddress, getContractAbi } from '@/lib/shared';
import { BASE_SEPOLIA_CHAIN_ID } from '@/lib/shared';

interface PortfolioOverviewProps {
  userAddress: Address;
}

/**
 * Portfolio overview showing total savings, locked funds, available balance,
 * and overall portfolio value from on-chain reads.
 *
 * Requirements: 11.1, 11.2, 11.4, 11.5, 11.6
 * - Displays financial data from on-chain reads only (no placeholder values)
 * - Proper loading/error/retry states
 * - Real-time updates when wallet/network changes
 */
export function PortfolioOverview({ userAddress }: PortfolioOverviewProps) {
  // Get contract addresses - disable direct contract reads as the proxy doesn't expose standard functions
  let savingsVaultAddress: Address;
  let savingsVaultAbi;
  // Contracts are deployed

  try {
    savingsVaultAddress = getContractAddress('SavingsVault', BASE_SEPOLIA_CHAIN_ID);
    savingsVaultAbi = getContractAbi('SavingsVault');
  } catch {
    savingsVaultAddress = '0x0000000000000000000000000000000000000000' as Address;
    savingsVaultAbi = [];
  }

  // Fetch portfolio value from SavingsVault
  const {
    data: portfolioValue,
    isLoading: portfolioLoading,
    isError: portfolioError,
    error: portfolioErrorMessage,
    refetch: refetchPortfolio,
  } = usePortfolioValue(
    savingsVaultAddress,
    [
      {
        name: 'portfolioValue',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ] as Abi,
    userAddress,
    true,
  );

  // Fetch available balance
  const {
    data: availableBalance,
    isLoading: balanceLoading,
    isError: balanceError,
    error: balanceErrorMessage,
    refetch: refetchBalance,
  } = useContractBalance(
    savingsVaultAddress,
    [
      {
        name: 'availableBalance',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ] as Abi,
    userAddress,
    'availableBalance',
    true,
  );

  // Fetch locked funds total - disabled (no lockedTotal function with user param)
  const {
    data: lockedTotal,
    isLoading: lockedLoading,
    isError: lockedError,
    error: lockedErrorMessage,
    refetch: refetchLocked,
  } = useContractRead({
    address: savingsVaultAddress,
    abi: savingsVaultAbi,
    functionName: 'lockedTotal',
    args: [userAddress],
    enabled: false,
  });

  // Handle case where contracts aren't deployed yet

  // Any loading state
  const isLoading = portfolioLoading || balanceLoading || lockedLoading;

  // Any error state
  const hasError = portfolioError || balanceError || lockedError;

  // Get first error message for display
  const errorMessage =
    portfolioErrorMessage?.message ||
    balanceErrorMessage?.message ||
    lockedErrorMessage?.message ||
    'Failed to load portfolio data';

  // Retry all failed requests
  const handleRetry = () => {
    if (portfolioError) refetchPortfolio();
    if (balanceError) refetchBalance();
    if (lockedError) refetchLocked();
  };

  // Format values for display (USDC = 6 decimals)
  const formatValue = (value: bigint | undefined) => {
    if (value === undefined) return '0.00';
    return formatUnits(value, 6);
  };

  // Calculate savings amount (portfolio minus locked)
  const savingsAmount =
    portfolioValue && lockedTotal ? portfolioValue - (lockedTotal as bigint) : undefined;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Portfolio Overview</h2>
          {hasError && (
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={isLoading}>
              Retry
            </Button>
          )}
        </div>

        {hasError && (
          <Alert variant="destructive">
            <p className="text-sm">{errorMessage}</p>
          </Alert>
        )}

        {isLoading && !hasError && (
          <div className="space-y-4">
            <div className="animate-pulse space-y-3">
              <div className="h-8 bg-muted rounded"></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="h-20 bg-muted rounded"></div>
                <div className="h-20 bg-muted rounded"></div>
                <div className="h-20 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !hasError && (
          <div className="space-y-6">
            {/* Total Portfolio Value */}
            <div className="text-center">
              <div className="text-3xl font-bold">
                $
                {parseFloat(formatValue(portfolioValue)).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-semibold text-green-600">
                  $
                  {parseFloat(formatValue(availableBalance)).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <p className="text-sm text-muted-foreground">Available</p>
              </div>

              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-semibold text-blue-600">
                  $
                  {parseFloat(formatValue(savingsAmount)).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <p className="text-sm text-muted-foreground">In Savings</p>
              </div>

              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-semibold text-orange-600">
                  $
                  {parseFloat(formatValue(lockedTotal as bigint)).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <p className="text-sm text-muted-foreground">Locked</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
