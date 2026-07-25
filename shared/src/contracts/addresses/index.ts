/**
 * Contract Addresses
 * Auto-generated contract address mappings
 * 
 * Provides type-safe contract address resolution for all networks
 */
import type { Address } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID, type SupportedChainId } from '../networks.js';

/** Sentinel used for not-yet-deployed contracts */
export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

/** All available BFN contract names */
export enum ContractName {
  'SavingsVault' = 'SavingsVault',
  'CommunityTreasury' = 'CommunityTreasury',
  'Education' = 'Education',
  'Registry' = 'Registry',
  'Governance' = 'Governance',
}

/** Map of every BFN contract to its deployed address on a single network */
export type ContractAddressMap = Readonly<Record<ContractName, Address>>;

/** Network deployment configuration */
export interface NetworkDeployment {
  readonly chainId: SupportedChainId;
  readonly contracts: ContractAddressMap;
  readonly token: Address;
  readonly deployedAtBlock: bigint;
}

/** Deployed contract addresses by chain ID */
export const DEPLOYMENTS: Readonly<Record<SupportedChainId, NetworkDeployment>> = {
  [BASE_SEPOLIA_CHAIN_ID]: {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    contracts: {
  SavingsVault: ZERO_ADDRESS,
  CommunityTreasury: ZERO_ADDRESS,
  Education: ZERO_ADDRESS,
  Registry: ZERO_ADDRESS,
  Governance: ZERO_ADDRESS,
    },
    token: ZERO_ADDRESS,
    deployedAtBlock: 0n,
  },
} as const;

/** Check if address is deployed (non-zero) */
export function isDeployed(address: Address): boolean {
  return address.toLowerCase() !== ZERO_ADDRESS;
}

/** Get deployment for a specific chain */
export function getDeployment(chainId: SupportedChainId): NetworkDeployment {
  return DEPLOYMENTS[chainId];
}

/** Get contract address for a specific chain and contract */
export function getContractAddress(chainId: SupportedChainId, contract: ContractName): Address {
  const address = DEPLOYMENTS[chainId].contracts[contract];
  if (!isDeployed(address)) {
    throw new Error(
      `BFN contract "${contract}" is not deployed on chain ${chainId}. ` +
      `Populate addresses from deployment pipeline before use.`
    );
  }
  return address;
}
