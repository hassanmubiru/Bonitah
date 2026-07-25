'use client';

import { useState } from 'react';
import { type Address } from 'viem';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProfileInfo } from './ProfileInfo';
import { ProfileDocuments } from './ProfileDocuments';
import { ReputationDisplay } from './ReputationDisplay';
import { VerificationStatus } from './VerificationStatus';
import { ProfileEditor } from './ProfileEditor';
import { useProfileData } from '@/hooks/useProfileData';

export interface ProfileViewProps {
  userAddress: Address;
}

/**
 * Main profile view component displaying all profile information.
 * Implements complete profile management system from Task 21.9.
 */
export function ProfileView({ userAddress }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { profileData, reputation, isLoading, error, refetch } = useProfileData(userAddress);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">Loading profile data...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-destructive mb-4">
                Failed to load profile data: {error.message}
              </p>
              <Button onClick={refetch} variant="outline">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">Profile</CardTitle>
              <CardDescription>
                Manage your profile, verification status, and reputation
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <VerificationStatus 
                isVerified={profileData?.isVerified || false}
                userAddress={userAddress}
              />
              <Button
                onClick={() => setIsEditing(!isEditing)}
                variant={isEditing ? "secondary" : "default"}
              >
                {isEditing ? "Cancel" : "Edit Profile"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Profile Editor or Display */}
      {isEditing ? (
        <ProfileEditor
          userAddress={userAddress}
          profileData={profileData}
          onSave={() => {
            setIsEditing(false);
            refetch();
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <>
          {/* Profile Information */}
          <ProfileInfo 
            profileData={profileData}
            userAddress={userAddress}
          />

          {/* Reputation and Achievements */}
          <ReputationDisplay
            reputation={reputation}
            userAddress={userAddress}
          />

          {/* Document Management */}
          <ProfileDocuments
            userAddress={userAddress}
            profileHash={profileData?.profileHash}
          />

          {/* Wallet Information */}
          <Card>
            <CardHeader>
              <CardTitle>Wallet Information</CardTitle>
              <CardDescription>
                Your connected wallet details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Wallet Address
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {userAddress}
                    </code>
                    <Badge variant="outline" className="text-xs">
                      Base Sepolia
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Registration Status
                  </label>
                  <div>
                    <Badge variant={profileData?.isRegistered ? "default" : "secondary"}>
                      {profileData?.isRegistered ? "Registered" : "Not Registered"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}