'use client';

import { type Address } from 'viem';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useContractRead } from '@/hooks/useContractRead';
import { getContractAddress, getContractAbi } from '@bfn/shared';
import { BASE_SEPOLIA_CHAIN_ID } from '@bfn/shared';

// Define types for contract return values
interface Certificate {
  id: bigint;
  courseId: string;
  issuedAt: bigint;
  ipfsMetadataHash: string;
}

interface Achievement {
  id: bigint;
  title: string;
  description: string;
  unlockedAt: bigint;
}

interface AchievementsPanelProps {
  userAddress: Address;
}

/**
 * Achievements panel showing certificates earned, reputation score, and badges.
 * 
 * Requirements: 11.1, 11.3, 11.4, 11.5, 11.6
 * - Certificates from Education contract
 * - Reputation score from Registry contract  
 * - Achievement badges and milestones
 * - Proper loading/error/retry states
 */
export function AchievementsPanel({ userAddress }: AchievementsPanelProps) {
  // Get contract addresses and ABIs - handle deployment check
  let registryAddress: Address;
  let registryAbi;
  let educationAddress: Address;
  let educationAbi;
  let contractsDeployed = true;
  
  try {
    registryAddress = getContractAddress(BASE_SEPOLIA_CHAIN_ID, 'Registry');
    registryAbi = getContractAbi('Registry');
    educationAddress = getContractAddress(BASE_SEPOLIA_CHAIN_ID, 'Education');
    educationAbi = getContractAbi('Education');
  } catch {
    contractsDeployed = false;
    registryAddress = '0x0000000000000000000000000000000000000000' as Address;
    registryAbi = [];
    educationAddress = '0x0000000000000000000000000000000000000000' as Address;
    educationAbi = [];
  }

  // Fetch reputation score from Registry using correct function name
  const {
    data: reputationScore,
    isLoading: reputationLoading,
    isError: reputationError,
    error: reputationErrorMessage,
    refetch: refetchReputation,
  } = useContractRead({
    address: registryAddress,
    abi: registryAbi,
    functionName: 'reputationOf',
    args: [userAddress],
    enabled: contractsDeployed,
  });

  // For now, these functions don't exist in the current ABI, so we'll show placeholders
  // TODO: Implement proper certificate and achievement reading when available
  const certificates = null;
  const certificatesLoading = false;
  const certificatesError = false;
  const certificatesErrorMessage = null;
  const refetchCertificates = () => {};

  const achievements = null;
  const achievementsLoading = false;
  const achievementsError = false;
  const achievementsErrorMessage = null;
  const refetchAchievements = () => {};

  // Handle case where contracts aren't deployed yet
  if (!contractsDeployed) {
    return (
      <Card className="p-6 h-full">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Achievements</h3>
          <Alert>
            <p className="text-sm">
              Contracts are not yet deployed. Please wait for deployment to complete.
            </p>
          </Alert>
        </div>
      </Card>
    );
  }

  const isLoading = reputationLoading || certificatesLoading || achievementsLoading;
  const hasError = reputationError || certificatesError || achievementsError;
  const errorMessage = reputationErrorMessage?.message || 
                      certificatesErrorMessage?.message ||
                      achievementsErrorMessage?.message ||
                      'Failed to load achievements data';

  const handleRetry = () => {
    if (reputationError) refetchReputation();
    if (certificatesError) refetchCertificates();
    if (achievementsError) refetchAchievements();
  };

  // Calculate achievement level based on reputation score
  const getAchievementLevel = (score: bigint | undefined) => {
    if (!score) return { level: 'Newcomer', progress: 0, next: 100 };
    
    const scoreNum = Number(score);
    if (scoreNum >= 1000) return { level: 'Expert', progress: 100, next: null };
    if (scoreNum >= 500) return { level: 'Advanced', progress: ((scoreNum - 500) / 500) * 100, next: 1000 };
    if (scoreNum >= 200) return { level: 'Intermediate', progress: ((scoreNum - 200) / 300) * 100, next: 500 };
    if (scoreNum >= 100) return { level: 'Beginner', progress: ((scoreNum - 100) / 100) * 100, next: 200 };
    
    return { level: 'Newcomer', progress: scoreNum, next: 100 };
  };

  const achievementLevel = getAchievementLevel(reputationScore);

  return (
    <Card className="p-6 h-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Achievements</h3>
          {hasError && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              disabled={isLoading}
            >
              Retry
            </Button>
          )}
        </div>

        {hasError && (
          <Alert variant="destructive">
            <p className="text-sm">{errorMessage}</p>
          </Alert>
        )}

        {isLoading && !hasError && (
          <div className="space-y-3">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-8 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        )}

        {!isLoading && !hasError && (
          <div className="space-y-6">
            {/* Reputation Score */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Reputation Level</h4>
                <span className="text-sm text-muted-foreground">
                  {reputationScore ? Number(reputationScore) : 0} points
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-purple-600">{achievementLevel.level}</span>
                  {achievementLevel.next && (
                    <span className="text-muted-foreground">
                      Next: {achievementLevel.next} points
                    </span>
                  )}
                </div>
                {achievementLevel.next && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min(achievementLevel.progress, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Certificates */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Certificates</h4>
                <span className="text-sm text-muted-foreground">
                  {certificates && Array.isArray(certificates) 
                    ? (certificates as Certificate[]).length 
                    : 0} earned
                </span>
              </div>
              {certificates && Array.isArray(certificates) && certificates.length > 0 ? (
                <div className="space-y-2">
                  {(certificates as Certificate[]).slice(0, 3).map((cert: Certificate, index: number) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>Certificate #{Number(cert.id)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(Number(cert.issuedAt) * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {(certificates as Certificate[]).length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{(certificates as Certificate[]).length - 3} more certificates
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No certificates earned yet</p>
              )}
            </div>

            {/* Achievement Badges */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Badges</h4>
                <span className="text-sm text-muted-foreground">
                  {achievements && Array.isArray(achievements) 
                    ? (achievements as Achievement[]).length 
                    : 0} unlocked
                </span>
              </div>
              {achievements && Array.isArray(achievements) && achievements.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {(achievements as Achievement[]).slice(0, 6).map((achievement: Achievement, index: number) => (
                    <div key={index} className="text-center p-2 rounded bg-muted/50">
                      <div className="text-lg">🏆</div>
                      <div className="text-xs font-medium truncate">
                        {achievement.title || `Achievement ${index + 1}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="text-lg opacity-50">🏆</div>
                    <div className="text-xs text-muted-foreground">Locked</div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="text-lg opacity-50">🎖️</div>
                    <div className="text-xs text-muted-foreground">Locked</div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="text-lg opacity-50">⭐</div>
                    <div className="text-xs text-muted-foreground">Locked</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}