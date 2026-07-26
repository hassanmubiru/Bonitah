/**
 * Contract Addresses
 * Auto-generated contract address mappings
 * 
 * Provides type-safe contract address resolution for all networks
 */
import type { Address } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID, type SupportedChainId } from '../../networks.js';

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
      Registry: '0xC37319a9ca70AA581b96b96ddb79eb19C2B391C5',
      SavingsVault: '0x75517c778C77628a5c0D4BBA7398520Da8849eB0',
      CommunityTreasury: '0x07E19c706cf7e77AFd215A6FEf136B3b8a62EEbe',
      Education: '0x0806ebCbD047A9a264027C2a31693FF26a69b3ff',
      Governance: '0xAB48386f4306b1E356d02456E9Ecf6e74CAfA76B',
    },
    token: '0x4FD1403945341786DBa53e31156C2dEdee40Ef34',
    deployedAtBlock: 44629013n,
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
