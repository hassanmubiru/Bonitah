'use client';

import React from 'react';
import { type Address } from 'viem';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { TransactionsResponse } from '@/lib/shared';

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
export const RecentTransactions = React.memo(function RecentTransactions({
  userAddress,
}: RecentTransactionsProps) {
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

  // Format transaction for display - memoized for performance
  const formatTransaction = React.useCallback(
    (transaction: { type: string; amount: string; timestamp?: string }) => {
      const type = transaction.type;
      const amount = transaction.amount;

      switch (type.toLowerCase()) {
        case 'deposit':
          return {
            type: 'Deposit',
            description: `Deposited ${amount}`,
            icon: '💰',
            color: 'text-green-600',
          };
        case 'withdrawal':
          return {
            type: 'Withdrawal',
            description: `Withdrew ${amount}`,
            icon: '💸',
            color: 'text-red-600',
          };
        case 'goal':
          return {
            type: 'Goal',
            description: `Goal transaction: ${amount}`,
            icon: '🎯',
            color: 'text-blue-600',
          };
        case 'contribution':
          return {
            type: 'Contribution',
            description: `Contributed ${amount}`,
            icon: '🤝',
            color: 'text-orange-600',
          };
        case 'vote':
          return {
            type: 'Vote',
            description: `Voted on proposal`,
            icon: '🗳️',
            color: 'text-indigo-600',
          };
        default:
          return {
            type: type,
            description: `Transaction: ${amount}`,
            icon: '📄',
            color: 'text-gray-600',
          };
      }
    },
    [],
  ); // No dependencies needed for this formatter

  // Format timestamp - memoized for performance
  const formatTimestamp = React.useCallback((timestamp?: string) => {
    if (!timestamp) return 'Recent';
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recent';
    }
  }, []);

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
            {transactions?.data?.transactions && transactions?.data?.transactions.length > 0 ? (
              transactions.data.transactions.map((transaction, index) => {
                const formatted = formatTransaction(transaction);
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
                          {formatTimestamp(transaction.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {formatted.description}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="hover:text-blue-600 transition-colors" title="Transaction ID">
                        #{index + 1}
                      </span>
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

        {transactions?.events && transactions?.data?.transactions.length >= 50 && (
          <div className="text-center pt-4 border-t">
            <Button variant="outline" size="sm">
              View All Transactions
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
});
