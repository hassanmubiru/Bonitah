'use client';

import { useQuery } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useContractRead, useReputationScore } from './useContractRead';
import { type ProfileData } from '@/components/profile/ProfileInfo';
import { type ReputationData, type Achievement } from '@/components/profile/ReputationDisplay';

// Mock Registry ABI for profile data
const REGISTRY_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'isRegistered',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'isVerified',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getProfileHash',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getReputationScore',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Mock contract address - in real implementation this would come from deployment config
const REGISTRY_ADDRESS = '0x1234567890123456789012345678901234567890' as Address;

export interface UseProfileDataResult {
  profileData: ProfileData | null;
  reputation: ReputationData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for fetching complete profile data from Registry contract.
 * Combines profile info, verification status, and reputation data.
 */
export function useProfileData(userAddress: Address): UseProfileDataResult {
  // Read registration status
  const {
    data: isRegistered,
    isLoading: isRegisteredLoading,
    error: registeredError,
    refetch: refetchRegistered,
  } = useContractRead({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'isRegistered',
    args: [userAddress],
  });

  // Read verification status
  const {
    data: isVerified,
    isLoading: isVerifiedLoading,
    error: verifiedError,
    refetch: refetchVerified,
  } = useContractRead({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'isVerified',
    args: [userAddress],
    enabled: !!isRegistered,
  });

  // Read profile hash
  const {
    data: profileHash,
    isLoading: isProfileHashLoading,
    error: profileHashError,
    refetch: refetchProfileHash,
  } = useContractRead({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getProfileHash',
    args: [userAddress],
    enabled: !!isRegistered,
  });

  // Read reputation score
  const {
    data: reputationScore,
    isLoading: isReputationLoading,
    error: reputationError,
    refetch: refetchReputation,
  } = useReputationScore(REGISTRY_ADDRESS, REGISTRY_ABI, userAddress, !!isRegistered);

  // Query for achievement data (from backend analytics)
  const achievementsQuery = useQuery({
    queryKey: ['achievements', userAddress],
    queryFn: async () => {
      // In real implementation, this would call the backend analytics API
      // For now, return mock data
      const mockAchievements: Achievement[] = [
        {
          id: '1',
          name: 'First Deposit',
          description: 'Made your first savings deposit',
          earnedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'savings',
        },
        {
          id: '2',
          name: 'Course Complete',
          description: 'Completed "Basics of Personal Finance" course',
          earnedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'education',
        },
        {
          id: '3',
          name: 'Community Member',
          description: 'Joined your first savings circle',
          earnedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'community',
        },
      ];

      return mockAchievements;
    },
    enabled: !!isRegistered && !!reputationScore,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const isLoading =
    isRegisteredLoading ||
    isVerifiedLoading ||
    isProfileHashLoading ||
    isReputationLoading ||
    achievementsQuery.isLoading;

  const error =
    registeredError ||
    verifiedError ||
    profileHashError ||
    reputationError ||
    (achievementsQuery.error as Error | null);

  const refetch = () => {
    refetchRegistered();
    refetchVerified();
    refetchProfileHash();
    refetchReputation();
    achievementsQuery.refetch();
  };

  // Build profile data
  const profileData: ProfileData | null =
    isRegistered !== undefined
      ? {
          profileHash: typeof profileHash === 'string' ? profileHash : undefined,
          isRegistered: Boolean(isRegistered),
          isVerified: Boolean(isVerified),
          registrationDate: isRegistered
            ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
            : undefined,
        }
      : null;

  // Build reputation data
  const reputation: ReputationData | null =
    reputationScore !== undefined
      ? {
          score: reputationScore as bigint,
          level: getReputationLevel(Number(reputationScore)),
          nextLevelThreshold: getNextLevelThreshold(Number(reputationScore)),
          achievements: achievementsQuery.data || [],
        }
      : null;

  return {
    profileData,
    reputation,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Determine reputation level based on score.
 */
function getReputationLevel(score: number): string {
  if (score >= 2000) return 'Leader';
  if (score >= 1000) return 'Expert';
  if (score >= 500) return 'Trusted';
  if (score >= 100) return 'Member';
  return 'Newcomer';
}

/**
 * Get the threshold for the next reputation level.
 */
function getNextLevelThreshold(score: number): bigint {
  if (score < 100) return BigInt(100);
  if (score < 500) return BigInt(500);
  if (score < 1000) return BigInt(1000);
  if (score < 2000) return BigInt(2000);
  return BigInt(0); // Already at max level
}
