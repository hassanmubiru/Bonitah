'use client';

import React from 'react';
import { type Address } from 'viem';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { TransactionsResponse } from '@bfn/shared';

interface RecentTransactionsProps {
  userAddress: Address;
}

/**
 * Recent transactions component showing the user's recent activity.
 * Optimized with React.memo to prevent unnecessary re-renders.
 *
 * Requirements: 11.2, 11.4, 11.5, 11.6
 * - Recent transactions (≤50, most recent first) from backend API
 * - Proper loading/error/retry states
 * - Transaction details with proper formatting
 */
export const RecentTransactions = React.memo(function RecentTransactions({ userAddress }: RecentTransactionsProps) {
  // Fetch recent transactions from backend API
  const {
    data: transactions,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<TransactionsResponse>({
    queryKey: ['transactions', userAddress],
    queryFn: async () => {
      // Get JWT token from localStorage with correct key
      const token = localStorage.getItem('bfn-auth-token');

      if (!token) {
        throw new Error('Authentication required');
      }

      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/transactions?limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transactions fetch failed: ${response.status} ${errorText}`);
      }

      return response.json();
    },
    // Cache for 30 seconds to match dashboard performance expectations
    staleTime: 30_000,
    // Keep in cache for 5 minutes
    gcTime: 5 * 60 * 1000,
    // Don't refetch on window focus
    refetchOnWindowFocus: false,
    // Enable background refetch for better UX
    refetchOnReconnect: true,
  });

  // Format transaction event for display
  const formatTransactionEvent = (event: {
    eventName: string;
    payload: Record<string, unknown>;
  }) => {
    const eventName = event.eventName;
    const payload = event.payload;

    switch (eventName) {
      case 'DepositMade':
        return {
          type: 'Deposit',
          description: `Deposited ${formatAmount(payload['amount'] as string)}`,
          icon: '💰',
          color: 'text-green-600',
        };
      case 'WithdrawalMade':
        return {
          type: 'Withdrawal',
          description: `Withdrew ${formatAmount(payload['amount'] as string)}`,
          icon: '💸',
          color: 'text-red-600',
        };
      case 'GoalCreated':
        return {
          type: 'Goal',
          description: `Created goal ${payload['goalId']} for ${formatAmount(payload['targetAmount'] as string)}`,
          icon: '🎯',
          color: 'text-blue-600',
        };
      case 'GoalCompleted':
        return {
          type: 'Goal',
          description: `Completed goal ${payload['goalId']}`,
          icon: '🏆',
          color: 'text-purple-600',
        };
      case 'ContributionMade':
        return {
          type: 'Contribution',
          description: `Contributed ${formatAmount(payload['amount'] as string)} to pool ${payload['poolId']}`,
          icon: '🤝',
          color: 'text-orange-600',
        };
      case 'VoteCast':
        return {
          type: 'Vote',
          description: `Voted on ${payload['proposalId'] || payload['actionId']}`,
          icon: '🗳️',
          color: 'text-indigo-600',
        };
      case 'CertificateIssued':
        return {
          type: 'Certificate',
          description: `Earned certificate ${payload['certificateId']}`,
          icon: '🎓',
          color: 'text-emerald-600',
        };
      default:
        return {
          type: eventName,
          description: 'Transaction completed',
          icon: '📄',
          color: 'text-gray-600',
        };
    }
  };

  // Format amount values (assuming 18 decimals)
  const formatAmount = (amount: string | undefined) => {
    if (!amount) return '0.00';
    const numValue = parseFloat(amount) / Math.pow(10, 18);
    return numValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Format timestamp
  const formatTimestamp = (blockNumber: string) => {
    // Since we don't have exact timestamp, use block number as relative indicator
    const blockNum = parseInt(blockNumber);
    return `Block ${blockNum.toLocaleString()}`;
  };

  return (
    <Card className="p-6 h-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent Activity</h3>
          {isError && (
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              Retry
            </Button>
          )}
        </div>

        {isError && (
          <Alert variant="destructive">
            <p className="text-sm">
              {error instanceof Error ? error.message : 'Failed to load transaction history'}
            </p>
          </Alert>
        )}

        {isLoading && !isError && (
          <div className="space-y-3">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="animate-pulse flex items-center space-x-3">
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !isError && (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {transactions?.events && transactions.events.length > 0 ? (
              transactions.events.map((event, index) => {
                const formatted = formatTransactionEvent(event);
                return (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30"
                  >
                    <div className="text-lg">{formatted.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${formatted.color}`}>
                          {formatted.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(event.blockNumber)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {formatted.description}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <a
                        href={`https://sepolia.basescan.org/tx/${event.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 transition-colors"
                        title="View on BaseScan"
                      >
                        View →
                      </a>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-4xl mb-2">📊</div>
                <p>No recent transactions</p>
                <p className="text-xs">
                  Your activity will appear here once you start using the platform
                </p>
              </div>
            )}
          </div>
        )}

        {transactions?.events && transactions.events.length >= 50 && (
          <div className="text-center pt-4 border-t">
            <Button variant="outline" size="sm">
              View All Transactions
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
