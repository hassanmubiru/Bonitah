'use client';

import { useQuery } from '@tanstack/react-query';

export interface UseIPFSContentResult<T> {
  content: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for fetching content from IPFS using content hash.
 * Generic hook that can fetch any JSON content stored on IPFS.
 */
export function useIPFSContent<T = any>(hash?: string): UseIPFSContentResult<T> {
  const query = useQuery({
    queryKey: ['ipfs-content', hash],
    queryFn: async (): Promise<T> => {
      if (!hash) {
        throw new Error('No IPFS hash provided');
      }

      // Try multiple IPFS gateways for reliability
      const gateways = [
        `https://gateway.pinata.cloud/ipfs/${hash}`,
        `https://ipfs.io/ipfs/${hash}`,
        `https://cloudflare-ipfs.com/ipfs/${hash}`,
      ];

      let lastError: Error | null = null;

      for (const gateway of gateways) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

          const response = await fetch(gateway, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
            },
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type');
          if (!contentType?.includes('application/json')) {
            throw new Error('Content is not JSON');
          }

          const content = await response.json();
          return content as T;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          console.warn(`IPFS gateway ${gateway} failed:`, error);
          // Continue to next gateway
        }
      }

      throw lastError || new Error('All IPFS gateways failed');
    },
    enabled: !!hash,
    retry: 2,
    staleTime: 10 * 60 * 1000, // 10 minutes - IPFS content is immutable
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    content: query.data || null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}