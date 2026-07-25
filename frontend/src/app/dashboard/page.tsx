'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

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
  const redirectedRef = useRef(false);
  
  // Use auth guard to check authentication state
  const { isAuthenticated, isLoading, isOnCorrectNetwork, isConnected } = useAuthGuard();

  // Handle redirects carefully to prevent loops
  useEffect(() => {
    // Only redirect after loading is complete, we're sure about the state, and haven't already redirected
    if (!isLoading && !redirectedRef.current) {
      if (!isConnected) {
        redirectedRef.current = true;
        router.push('/auth');
      } else if (isConnected && !isOnCorrectNetwork) {
        // User is connected but on wrong network - stay on page to show network switch prompt
        return;
      } else if (isConnected && isOnCorrectNetwork && !isAuthenticated) {
        redirectedRef.current = true;
        router.push('/auth');
      }
    }
  }, [isLoading, isConnected, isOnCorrectNetwork, isAuthenticated, router]);

  // Reset redirect flag when loading starts or conditions change
  useEffect(() => {
    if (isLoading) {
      redirectedRef.current = false;
    }
  }, [isLoading]);

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

  // Show loading if not authenticated (redirect will happen via useEffect)
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