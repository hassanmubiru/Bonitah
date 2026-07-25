'use client';

import { type Address } from 'viem';

import { PortfolioOverview } from './PortfolioOverview';
import { RecentTransactions } from './RecentTransactions';  
import { SavingsSummary } from './SavingsSummary';
import { CommunityStats } from './CommunityStats';
import { AchievementsPanel } from './AchievementsPanel';
import { PortfolioChart } from './PortfolioChart';

interface DashboardContentProps {
  userAddress: Address;
}

/**
 * Main dashboard content component that orchestrates all dashboard sections.
 * 
 * Each section handles its own data fetching, loading states, and error handling
 * according to Requirements 11.4, 11.5, 11.6 (proper loading/error/retry states).
 * 
 * All financial data comes from on-chain reads via useContractRead hooks (Req 1.2, 1.6, 1.7).
 * Transaction data comes from backend APIs with proper authentication (Req 12.3, 12.4).
 */
export function DashboardContent({ userAddress }: DashboardContentProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Top row - key financial metrics */}
      <div className="col-span-full">
        <PortfolioOverview userAddress={userAddress} />
      </div>
      
      {/* Second row - savings and community */}
      <div className="md:col-span-1 lg:col-span-1">
        <SavingsSummary userAddress={userAddress} />
      </div>
      
      <div className="md:col-span-1 lg:col-span-1">
        <CommunityStats userAddress={userAddress} />
      </div>
      
      <div className="md:col-span-2 lg:col-span-1">
        <AchievementsPanel userAddress={userAddress} />
      </div>
      
      {/* Third row - charts and activity */}
      <div className="col-span-full lg:col-span-2">
        <PortfolioChart userAddress={userAddress} />
      </div>
      
      <div className="col-span-full lg:col-span-1">
        <RecentTransactions userAddress={userAddress} />
      </div>
    </div>
  );
}