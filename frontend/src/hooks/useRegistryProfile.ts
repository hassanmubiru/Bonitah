'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useContractRead, useContractWrite } from 'wagmi';
import { getContractAbi } from '@bfn/shared';

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
  });

  // Read reputation from Registry contract
  const { data: reputation } = useContractRead({
    address: process.env['NEXT_PUBLIC_REGISTRY_ADDRESS'] as `0x${string}`,
    abi: registryABI,
    functionName: 'getReputation',
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
  const { writeAsync: updateProfileContract } = useContractWrite({
    address: process.env['NEXT_PUBLIC_REGISTRY_ADDRESS'] as `0x${string}`,
    abi: registryABI,
    functionName: 'updateProfile',
  });

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
      const response = await fetch(`/api/ipfs/${metadataHash}`);
      if (!response.ok) {
        throw new Error('Failed to fetch metadata');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch profile metadata:', error);
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
        // Upload metadata to IPFS
        const response = await fetch('/api/ipfs/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('bfn-auth-token')}`,
          },
          body: JSON.stringify({
            documents: [
              {
                name: 'profile-metadata.json',
                content: JSON.stringify(profileData),
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to upload metadata to IPFS');
        }

        const { cids } = await response.json();
        const metadataHash = cids[0];

        // Update Registry contract
        await updateProfileContract({
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
      } catch (error) {
        console.error('Failed to process profile data:', error);
        setError('Failed to process profile data');
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
