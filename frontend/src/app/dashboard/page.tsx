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
  const { address, isConnected } = useAccount();
  
  // Redirect to auth if not connected
  useEffect(() => {
    if (!isConnected || !address) {
      router.push('/auth');
    }
  }, [isConnected, address, router]);

  // Use auth guard to ensure JWT auth
  const { isAuthenticated, isLoading: authLoading } = useAuthGuard();

  // Show loading while checking auth
  if (authLoading || !isConnected || !address) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!isAuthenticated) {
    router.push('/auth');
    return null;
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