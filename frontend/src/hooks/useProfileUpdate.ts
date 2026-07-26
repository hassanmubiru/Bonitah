'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { type Address } from 'viem';
import { useSiweAuth } from './useSiweAuth';
import { type IPFSProfileContent } from '@/components/profile/ProfileInfo';

// Mock Registry ABI for profile updates
const REGISTRY_ABI = [
  {
    inputs: [{ name: 'profileHash', type: 'string' }],
    name: 'updateProfile',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Mock contract address
const REGISTRY_ADDRESS = '0x1234567890123456789012345678901234567890' as Address;

export interface UseProfileUpdateResult {
  updateProfile: (profileData: IPFSProfileContent) => Promise<void>;
  isUpdating: boolean;
  error: Error | null;
}

/**
 * Hook for updating user profile with IPFS storage and Registry contract update.
 */
export function useProfileUpdate(): UseProfileUpdateResult {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { address } = useAccount();
  const { isAuthenticated } = useSiweAuth();
  const { writeContract } = useWriteContract();

  const updateProfile = async (profileData: IPFSProfileContent): Promise<void> => {
    if (!address || !token) {
      throw new Error('Wallet connection and authentication required');
    }

    setIsUpdating(true);
    setError(null);

    try {
      // Step 1: Upload profile data to IPFS via backend
      const ipfsResponse = await fetch('/api/ipfs/profile-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      if (!ipfsResponse.ok) {
        const errorData = await ipfsResponse.json().catch(() => ({ message: 'IPFS upload failed' }));
        throw new Error(errorData.message || 'Failed to upload profile to IPFS');
      }

      const { cid } = await ipfsResponse.json();
      
      if (!cid) {
        throw new Error('No IPFS hash returned from upload');
      }

      // Step 2: Update Registry contract with new profile hash
      const hash = await new Promise<`0x${string}`>((resolve, reject) => {
        writeContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'updateProfile',
          args: [cid],
        }, {
          onSuccess: (hash) => resolve(hash),
          onError: (error) => reject(error),
        });
      });

      // Step 3: Wait for transaction confirmation
      // In a real implementation, you'd use useWaitForTransactionReceipt
      // For now, we'll simulate the wait
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('Profile updated successfully:', { cid, transactionHash: hash });
    } catch (err) {
      const updateError = err instanceof Error ? err : new Error('Profile update failed');
      setError(updateError);
      throw updateError;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    updateProfile,
    isUpdating,
    error,
  };
}