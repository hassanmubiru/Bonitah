'use client';

import { type Address } from 'viem';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useIPFSContent } from '@/hooks/useIPFSContent';

export interface ProfileData {
  profileHash?: string;
  isRegistered: boolean;
  isVerified: boolean;
  registrationDate?: string;
}

export interface ProfileInfoProps {
  profileData: ProfileData | null;
  userAddress: Address;
}

export interface IPFSProfileContent {
  name?: string;
  bio?: string;
  location?: string;
  website?: string;
  twitter?: string;
  github?: string;
  profession?: string;
  skills?: string[];
}

/**
 * Displays user profile information from IPFS and Registry contract.
 */
export function ProfileInfo({ profileData, userAddress: _userAddress }: ProfileInfoProps) {
  const { content: ipfsContent, isLoading: ipfsLoading, error: ipfsError } = useIPFSContent<IPFSProfileContent>(
    profileData?.profileHash
  );

  const hasProfileData = profileData?.profileHash && (ipfsContent || (!ipfsLoading && !ipfsError));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Your public profile stored on IPFS
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!profileData?.isRegistered ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              You need to register first to create a profile.
            </p>
            <Badge variant="secondary">Not Registered</Badge>
          </div>
        ) : !hasProfileData ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              No profile information available. Click "Edit Profile" to add your details.
            </p>
            {ipfsLoading && (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                <span className="text-sm text-muted-foreground">Loading profile data...</span>
              </div>
            )}
            {ipfsError && (
              <p className="text-sm text-destructive">
                Error loading profile: {ipfsError.message}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {ipfsContent?.name && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-lg font-medium">{ipfsContent.name}</p>
              </div>
            )}

            {ipfsContent?.profession && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Profession</label>
                <p>{ipfsContent.profession}</p>
              </div>
            )}

            {ipfsContent?.bio && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Bio</label>
                <p className="text-muted-foreground">{ipfsContent.bio}</p>
              </div>
            )}

            {ipfsContent?.location && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Location</label>
                <p>{ipfsContent.location}</p>
              </div>
            )}

            {ipfsContent?.skills && ipfsContent.skills.length > 0 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Skills</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ipfsContent.skills.map((skill, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Links</label>
              <div className="space-y-1">
                {ipfsContent?.website && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-16">Website:</span>
                    <a
                      href={ipfsContent.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {ipfsContent.website}
                    </a>
                  </div>
                )}
                {ipfsContent?.twitter && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-16">Twitter:</span>
                    <a
                      href={`https://twitter.com/${ipfsContent.twitter.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      @{ipfsContent.twitter.replace('@', '')}
                    </a>
                  </div>
                )}
                {ipfsContent?.github && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-16">GitHub:</span>
                    <a
                      href={`https://github.com/${ipfsContent.github.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      @{ipfsContent.github.replace('@', '')}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {profileData.registrationDate && (
              <div className="pt-4 border-t">
                <label className="text-sm font-medium text-muted-foreground">
                  Member since
                </label>
                <p className="text-sm">
                  {new Date(profileData.registrationDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}