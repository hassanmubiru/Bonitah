'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { useAuthGuard } from '@/hooks/useAuthGuard';

/**
 * Dashboard page - main financial overview for authenticated users.
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.7
 * 
 * Features:
 * - Portfolio overview (savings, locked, goals) from on-chain reads
 * - Recent transactions (≤50, most recent first) from backend API  
 * - Community contributions and achievements from contracts
 * - Portfolio growth charts using real data only
 * - Responsive design with proper loading/error/retry states
 */
export default function DashboardPage() {
  const router = useRouter();
  const { address } = useAccount();
  
  // Use auth guard to check authentication state
  const { isAuthenticated, isLoading, isOnCorrectNetwork, isConnected } = useAuthGuard();

  // Handle redirect only when we have definitive state
  useEffect(() => {
    // Only redirect if we're not loading and we're sure the user needs to authenticate
    if (!isLoading) {
      if (!isConnected || !isOnCorrectNetwork || !isAuthenticated) {
        router.push('/auth');
      }
    }
  }, [isLoading, isConnected, isOnCorrectNetwork, isAuthenticated, router]);

  // Show loading while checking auth or if we don't have required state
  if (isLoading || !isConnected || !isOnCorrectNetwork || !address) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Show loading if not authenticated (redirect is handled by useEffect)
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Redirecting...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Your financial overview and recent activity on Bonitah Financial Network
        </p>
      </div>
      
      <DashboardContent userAddress={address} />
    </div>
  );
}