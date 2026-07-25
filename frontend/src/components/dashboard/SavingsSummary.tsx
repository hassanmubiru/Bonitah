'use client';

import { type Address } from 'viem';
import { formatUnits } from 'viem';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useContractRead } from '@/hooks/useContractRead';
import { getContractAddress, getContractAbi } from '@bfn/shared';
import { BASE_SEPOLIA_CHAIN_ID } from '@bfn/shared';

// Define types for contract return values
interface Goal {
  id: bigint;
  targetAmount: bigint;
  targetDate: bigint;
  savedAmount: bigint;
  completed: boolean;
}

interface Lock {
  amount: bigint;
  expiry: bigint;
  released: boolean;
}

interface SavingsSummaryProps {
  userAddress: Address;
}

/**
 * Savings summary showing goal progress and locked savings status.
 * 
 * Requirements: 11.1, 11.3, 11.4, 11.5, 11.6
 * - Goal progress from on-chain reads
 * - Locked savings details with time remaining
 * - Proper loading/error/retry states
 */
export function SavingsSummary({ userAddress }: SavingsSummaryProps) {
  let savingsVaultAddress: Address;
  let savingsVaultAbi;
  let contractsDeployed = true;
  
  try {
    savingsVaultAddress = getContractAddress(BASE_SEPOLIA_CHAIN_ID, 'SavingsVault');
    savingsVaultAbi = getContractAbi('SavingsVault');
  } catch {
    contractsDeployed = false;
    savingsVaultAddress = '0x0000000000000000000000000000000000000000' as Address;
    savingsVaultAbi = [];
  }

  // Fetch user's active goals - always call hooks
  const {
    data: activeGoals,
    isLoading: goalsLoading,
    isError: goalsError,
    error: goalsErrorMessage,
    refetch: refetchGoals,
  } = useContractRead({
    address: savingsVaultAddress,
    abi: savingsVaultAbi,
    functionName: 'getActiveGoals',
    args: [userAddress],
    enabled: contractsDeployed,
  });

  // Fetch user's active locks
  const {
    data: activeLocks,
    isLoading: locksLoading,
    isError: locksError,
    error: locksErrorMessage,
    refetch: refetchLocks,
  } = useContractRead({
    address: savingsVaultAddress,
    abi: savingsVaultAbi,
    functionName: 'getActiveLocks',
    args: [userAddress],
    enabled: contractsDeployed,
  });

  // Handle case where contracts aren't deployed yet
  if (!contractsDeployed) {
    return (
      <Card className="p-6 h-full">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Savings Summary</h3>
          <Alert>
            <p className="text-sm">
              Contracts are not yet deployed. Please wait for deployment to complete.
            </p>
          </Alert>
        </div>
      </Card>
    );
  }

  const isLoading = goalsLoading || locksLoading;
  const hasError = goalsError || locksError;
  const errorMessage = goalsErrorMessage?.message || 
                      locksErrorMessage?.message ||
                      'Failed to load savings data';

  const handleRetry = () => {
    if (goalsError) refetchGoals();
    if (locksError) refetchLocks();
  };

  // Format currency values
  const formatValue = (value: bigint | undefined) => {
    if (value === undefined) return '0.00';
    return parseFloat(formatUnits(value, 18)).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Format time remaining for locks
  const formatTimeRemaining = (expiry: bigint) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = Number(expiry) - now;
    
    if (remaining <= 0) return 'Expired';
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <Card className="p-6 h-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Savings Summary</h3>
          {hasError && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              disabled={isLoading}
            >
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
          <div className="space-y-3">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-8 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        )}

        {!isLoading && !hasError && (
          <div className="space-y-6">
            {/* Active Goals */}
            <div>
              <h4 className="font-medium mb-3">Active Goals</h4>
              {activeGoals && Array.isArray(activeGoals) && activeGoals.length > 0 ? (
                <div className="space-y-3">
                  {(activeGoals as Goal[]).slice(0, 3).map((goal: Goal, index: number) => {
                    const progress = goal.targetAmount > 0n 
                      ? Number((goal.savedAmount * 100n) / goal.targetAmount) 
                      : 0;
                    
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Goal #{Number(goal.id)}</span>
                          <span>${formatValue(goal.savedAmount)} / ${formatValue(goal.targetAmount)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {progress.toFixed(1)}% complete
                        </div>
                      </div>
                    );
                  })}
                  {(activeGoals as Goal[]).length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{(activeGoals as Goal[]).length - 3} more goals
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active goals</p>
              )}
            </div>

            {/* Active Locks */}
            <div>
              <h4 className="font-medium mb-3">Locked Savings</h4>
              {activeLocks && Array.isArray(activeLocks) && activeLocks.length > 0 ? (
                <div className="space-y-3">
                  {(activeLocks as Lock[]).slice(0, 3).map((lock: Lock, index: number) => (
                    <div key={index} className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">${formatValue(lock.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimeRemaining(lock.expiry)} remaining
                        </div>
                      </div>
                      <div className="text-xs text-orange-600">
                        {lock.released ? 'Released' : 'Locked'}
                      </div>
                    </div>
                  ))}
                  {(activeLocks as Lock[]).length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{(activeLocks as Lock[]).length - 3} more locks
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No locked funds</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}