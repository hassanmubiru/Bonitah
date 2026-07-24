/**
 * Mock for @bfn/shared package for testing
 */

// Network constants
export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;
export const SUPPORTED_CHAIN_IDS = [BASE_SEPOLIA_CHAIN_ID] as const;

export type SupportedChainId = typeof BASE_SEPOLIA_CHAIN_ID;

export interface NetworkConfig {
  readonly chainId: SupportedChainId;
  readonly name: string;
  readonly shortName: string;
  readonly nativeCurrency: {
    readonly name: string;
    readonly symbol: string;
    readonly decimals: number;
  };
  readonly blockExplorerUrl: string;
  readonly testnet: boolean;
}

export const NETWORKS: Readonly<Record<SupportedChainId, NetworkConfig>> = {
  [BASE_SEPOLIA_CHAIN_ID]: {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    name: 'Base Sepolia',
    shortName: 'base-sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrl: 'https://sepolia.basescan.org',
    testnet: true,
  },
} as const;

export function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

export function getNetworkConfig(chainId: SupportedChainId): NetworkConfig {
  return NETWORKS[chainId];
}