'use client';

import { useAccount } from 'wagmi';
import { Suspense } from 'react';

import { ProfileView } from '@/components/profile/ProfileView';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Profile page implementing Task 21.9.
 * 
 * Displays user profile data from Registry contract with IPFS content,
 * verification status, reputation scores, and document management.
 * Requirements: 3.3, 3.5, 3.7, 11.7
 */
export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) {
    return (
      <main id="main-content" className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to view your profile.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main id="main-content" className="container mx-auto px-4 py-8">
      <Suspense
        fallback={
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">
                Loading profile...
              </p>
            </CardContent>
          </Card>
        }
      >
        <ProfileView userAddress={address} />
      </Suspense>
    </main>
  );
}