'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useContractWrite } from 'wagmi';
import { getContractAbi } from '@/lib/shared';
import { useContractRead } from './useContractRead';

/**
 * Profile data structure from Registry contract
 */
export interface RegistryProfile {
  walletAddress: string;
  displayName: string;
  bio: string;
  website: string;
  twitter: string;
  github: string;
  location: string;
  documents: Array<{
    id: string;
    name: string;
    url: string;
    size: string;
    uploadedAt: string;
  }>;
  metadataHash: string;
  isRegistered: boolean;
}

/**
 * Registry profile management hook
 *
 * Implements Task 21.9 requirements for Registry contract integration
 */
export function useRegistryProfile() {
  const { address, isConnected } = useAccount();
  const [profile, setProfile] = useState<RegistryProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get Registry ABI
  const registryABI = getContractAbi('Registry');

  // Read profile from Registry contract (only when connected)
  const shouldReadProfile = !!address && isConnected;
  const {
    data: profileData,
    isLoading: contractLoading,
    refetch,
  } = useContractRead({
    address: process.env['NEXT_PUBLIC_REGISTRY_ADDRESS'] as `0x${string}`,
    abi: registryABI,
    functionName: 'getProfile',
    args: shouldReadProfile ? [address] : [],
    enabled: shouldReadProfile,
  });

  // Read reputation from Registry contract
  const { data: reputation } = useContractRead({
    address: process.env['NEXT_PUBLIC_REGISTRY_ADDRESS'] as `0x${string}`,
    abi: registryABI,
    functionName: 'reputationOf',
    args: address ? [address] : [],
    enabled: !!address && isConnected,
  });

  // Read verification status from Registry contract
  const { data: isVerified } = useContractRead({
    address: process.env['NEXT_PUBLIC_REGISTRY_ADDRESS'] as `0x${string}`,
    abi: registryABI,
    functionName: 'isVerified',
    args: address ? [address] : [],
    enabled: !!address && isConnected,
  });

  // Contract write for updating profile
  const { writeContractAsync: updateProfileContract } = useContractWrite();

  /**
   * Fetch and parse profile metadata from IPFS
   */
  const fetchProfileMetadata = useCallback(async (metadataHash: string) => {
    if (
      !metadataHash ||
      metadataHash === '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      return null;
    }

    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/ipfs/${metadataHash}`);
      if (!response.ok) {
        // Profile metadata not found is not a critical error
        return null;
      }
      return await response.json();
    } catch {
      // Silently fail - profile can still display without IPFS metadata
      return null;
    }
  }, []);

  /**
   * Update profile information
   */
  const updateProfile = useCallback(
    async (profileData: Partial<RegistryProfile>) => {
      if (!address || !isConnected) {
        throw new Error('Wallet not connected');
      }

      setIsLoading(true);
      setError(null);

      try {
        // Upload metadata to IPFS directly via Supabase backend
        const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/ipfs/profile-metadata`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('bfn-auth-token')}`,
          },
          body: JSON.stringify(profileData),
        });

        if (!response.ok) {
          throw new Error('Failed to upload metadata to IPFS');
        }

        const data = await response.json();
        const metadataHash = data.ipfsHash;

        // Update Registry contract
        await updateProfileContract({
          address: process.env['NEXT_PUBLIC_REGISTRY_ADDRESS'] as `0x${string}`,
          abi: registryABI,
          functionName: 'updateProfile',
          args: [metadataHash],
        });

        // Refresh profile data
        await refetch();
      } catch (error) {
        console.error('Profile update failed:', error);
        setError(error instanceof Error ? error.message : 'Profile update failed');
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [address, isConnected, updateProfileContract, refetch],
  );

  /**
   * Process profile data from contract and IPFS
   */
  useEffect(() => {
    const processProfileData = async () => {
      if (!address || contractLoading) return;

      setIsLoading(true);
      setError(null);

      try {
        let processedProfile: RegistryProfile = {
          walletAddress: address,
          displayName: '',
          bio: '',
          website: '',
          twitter: '',
          github: '',
          location: '',
          documents: [],
          metadataHash: '',
          isRegistered: false,
        };

        if (profileData && Array.isArray(profileData) && profileData.length >= 2) {
          processedProfile.isRegistered = profileData[0] as boolean;
          processedProfile.metadataHash = profileData[1] as string;

          // Fetch metadata from IPFS if available
          if (
            processedProfile.metadataHash &&
            processedProfile.metadataHash !==
              '0x0000000000000000000000000000000000000000000000000000000000000000'
          ) {
            const metadata = await fetchProfileMetadata(processedProfile.metadataHash);
            if (metadata) {
              processedProfile = {
                ...processedProfile,
                ...metadata,
              };
            }
          }
        }

        setProfile(processedProfile);
      } catch {
        // Non-critical: show profile with defaults rather than error state
        setProfile({
          walletAddress: address,
          displayName: '',
          bio: '',
          website: '',
          twitter: '',
          github: '',
          location: '',
          documents: [],
          metadataHash: '',
          isRegistered: false,
        });
      } finally {
        setIsLoading(false);
      }
    };

    processProfileData();
  }, [address, profileData, contractLoading, fetchProfileMetadata]);

  return {
    profile,
    reputation: reputation as number | undefined,
    isVerified: isVerified as boolean | undefined,
    isLoading: isLoading || contractLoading,
    error,
    updateProfile,
    refetch,
  };
}
