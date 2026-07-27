'use client';

import { type Address } from 'viem';
import { formatUnits } from 'viem';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

// Define types for contract return values
interface Circle {
  id: bigint;
  creator: Address;
  maxMembers: bigint;
  memberCount: bigint;
  open: boolean;
}

interface PoolContribution {
  poolId: bigint;
  amount: bigint;
  timestamp: bigint;
}

interface CommunityStatsProps {
  userAddress: Address;
}

/**
 * Community stats showing circle memberships, pool contributions, and voting activity.
 *
 * Requirements: 11.1, 11.3, 11.4, 11.5, 11.6
 * - Circle memberships from CommunityTreasury contract
 * - Pool contributions and ownership shares
 * - Voting activity from recent proposals
 * - Proper loading/error/retry states
 */
export function CommunityStats({ userAddress: _userAddress }: CommunityStatsProps) {
  let contractsDeployed = true;

  try {
    // Contract references removed for now - placeholder implementation
    contractsDeployed = true;
  } catch {
    contractsDeployed = false;
  }

  // For now, these functions don't exist in the current ABI, so we'll show placeholders
  // TODO: Implement proper data reading from contract mappings when available
  const circleMemberships = null;
  const circlesLoading = false;
  const circlesError = false;
  const refetchCircles = () => {};

  const poolContributions = null;
  const poolsLoading = false;
  const poolsError = false;
  const poolsErrorMessage = null;
  const refetchPools = () => {};

  // Contract reads disabled for now - placeholder implementation
  const votingPower = BigInt(0);
  const votingLoading = false;
  const votingError = false;
  const refetchVoting = () => {};

  /*
  // Fetch user's voting power in governance (this function exists in the ABI)
  const {
    data: votingPower,
    isLoading: votingLoading,
    isError: votingError,
    error: votingErrorMessage,
    refetch: refetchVoting,
  } = useContractRead({
    address: governanceAddress,
    abi: governanceAbi,
    functionName: 'votingPowerOf',
    args: [userAddress],
    enabled: contractsDeployed,
  });
  */

  // Handle case where contracts aren't deployed yet
  if (!contractsDeployed) {
    return (
      <Card className="p-6 h-full">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Community Activity</h3>
          <Alert>
            <p className="text-sm">
              Contracts are not yet deployed. Please wait for deployment to complete.
            </p>
          </Alert>
        </div>
      </Card>
    );
  }

  const isLoading = circlesLoading || poolsLoading || votingLoading;
  const hasError = circlesError || poolsError || votingError;
  const errorMessage = hasError ? 'Failed to load community data' : null;

  const handleRetry = () => {
    if (circlesError) refetchCircles();
    if (poolsError) refetchPools();
    if (votingError) refetchVoting();
  };

  // Format currency values
  const formatValue = (value: bigint | undefined) => {
    if (value === undefined) return '0.00';
    return parseFloat(formatUnits(value, 18)).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <Card className="p-6 h-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Community Activity</h3>
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
          <div className="space-y-3">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-6 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        )}

        {!isLoading && !hasError && (
          <div className="space-y-6">
            {/* Circle Memberships */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Savings Circles</h4>
                <span className="text-sm text-muted-foreground">
                  {circleMemberships && Array.isArray(circleMemberships)
                    ? (circleMemberships as Circle[]).length
                    : 0}{' '}
                  joined
                </span>
              </div>
              {circleMemberships &&
              Array.isArray(circleMemberships) &&
              circleMemberships.length > 0 ? (
                <div className="space-y-2">
                  {(circleMemberships as Circle[])
                    .slice(0, 2)
                    .map((circle: Circle, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>Circle #{Number(circle.id)}</span>
                        <span className="text-muted-foreground">
                          {Number(circle.memberCount)}/{Number(circle.maxMembers)} members
                        </span>
                      </div>
                    ))}
                  {(circleMemberships as Circle[]).length > 2 && (
                    <p className="text-xs text-muted-foreground">
                      +{(circleMemberships as Circle[]).length - 2} more circles
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No circle memberships</p>
              )}
            </div>

            {/* Pool Contributions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Pool Contributions</h4>
                <span className="text-sm text-muted-foreground">
                  {poolContributions && Array.isArray(poolContributions)
                    ? (poolContributions as PoolContribution[])
                        .reduce(
                          (total: number, pool: PoolContribution) =>
                            total + parseFloat(formatValue(pool.amount)),
                          0,
                        )
                        .toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                    : '0.00'}{' '}
                  total
                </span>
              </div>
              {poolContributions &&
              Array.isArray(poolContributions) &&
              poolContributions.length > 0 ? (
                <div className="space-y-2">
                  {(poolContributions as PoolContribution[])
                    .slice(0, 2)
                    .map((pool: PoolContribution, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>Pool #{Number(pool.poolId)}</span>
                        <span>${formatValue(pool.amount)}</span>
                      </div>
                    ))}
                  {(poolContributions as PoolContribution[]).length > 2 && (
                    <p className="text-xs text-muted-foreground">
                      +{(poolContributions as PoolContribution[]).length - 2} more pools
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No pool contributions</p>
              )}
            </div>

            {/* Voting Power */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Governance Power</h4>
              </div>
              <div className="text-2xl font-semibold text-purple-600">
                {votingPower ? Number(votingPower).toLocaleString() : '0'}
              </div>
              <p className="text-xs text-muted-foreground">Voting power</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
