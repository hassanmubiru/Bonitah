'use client';

import { type Address } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { PortfolioSeriesResponse } from '@bfn/shared';

interface PortfolioChartProps {
  userAddress: Address;
}

/**
 * Portfolio chart component showing portfolio growth over time using real data only.
 *
 * Requirements: 11.1, 11.4, 11.5, 11.6
 * - Charts from real data only (no mock data)
 * - Portfolio growth analytics from backend API
 * - Proper loading/error/retry states
 * - Responsive design
 */
export function PortfolioChart({ userAddress }: PortfolioChartProps) {
  // Fetch portfolio series data from backend analytics API
  const {
    data: portfolioSeries,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<PortfolioSeriesResponse>({
    queryKey: ['portfolio-series', userAddress],
    queryFn: async () => {
      // Get JWT token from localStorage or session storage
      const token = localStorage.getItem('bfn_jwt') || sessionStorage.getItem('bfn_jwt');

      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/analytics/portfolio', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Portfolio series fetch failed: ${response.status} ${errorText}`);
      }

      return response.json();
    },
    // Cache for 30 seconds to match financial data staleness policy
    staleTime: 30_000,
    // Keep in cache for 5 minutes
    gcTime: 5 * 60 * 1000,
    // Don't refetch on window focus
    refetchOnWindowFocus: false,
  });

  // Format portfolio values for display
  const formatPortfolioValue = (value: string) => {
    const numValue = parseFloat(formatUnits(BigInt(value), 18));
    return numValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Simple line chart using CSS and divs (since we don't have a charting library)
  const renderSimpleChart = () => {
    if (!portfolioSeries?.series || portfolioSeries.series.length === 0) {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          No portfolio data available yet
        </div>
      );
    }

    const series = portfolioSeries.series;
    const values = series.map((point) => parseFloat(formatUnits(BigInt(point.value), 18)));
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;

    return (
      <div className="space-y-4">
        {/* Chart area */}
        <div className="relative h-32 bg-muted/20 rounded-lg p-4">
          <div className="flex h-full items-end space-x-1">
            {values.map((value, index) => {
              const height = range === 0 ? 50 : ((value - minValue) / range) * 80 + 10;
              return (
                <div
                  key={index}
                  className="flex-1 bg-blue-600 rounded-sm opacity-80 hover:opacity-100 transition-opacity"
                  style={{ height: `${height}%` }}
                  title={`$${value.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
                />
              );
            })}
          </div>
        </div>

        {/* Chart summary */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-sm text-muted-foreground">Current</div>
            <div className="font-semibold">
              ${formatPortfolioValue(series[series.length - 1]?.value || 0)}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Peak</div>
            <div className="font-semibold">
              $
              {maxValue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Data Points</div>
            <div className="font-semibold">{series.length}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Portfolio Growth</h3>
          {isError && (
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              Retry
            </Button>
          )}
        </div>

        {isError && (
          <Alert variant="destructive">
            <p className="text-sm">
              {error instanceof Error ? error.message : 'Failed to load portfolio chart data'}
            </p>
          </Alert>
        )}

        {isLoading && !isError && (
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-32 bg-muted rounded-lg"></div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="h-8 bg-muted rounded"></div>
                <div className="h-8 bg-muted rounded"></div>
                <div className="h-8 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !isError && renderSimpleChart()}
      </div>
    </Card>
  );
}
