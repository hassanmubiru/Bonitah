/**
 * Contract Addresses Registry
 * Exports addresses for all supported networks
 */

export { BASE_SEPOLIA_ADDRESSES, BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_TOKEN_ADDRESS, BASE_SEPOLIA_DEPLOYED_BLOCK } from './base-sepolia.js';

import { BASE_SEPOLIA_ADDRESSES, BASE_SEPOLIA_CHAIN_ID } from './base-sepolia.js';
import type { ContractName } from '../types/contracts.js';
import type { Address } from 'viem';

/** All supported chain IDs */
export const SUPPORTED_CHAIN_IDS = [BASE_SEPOLIA_CHAIN_ID] as const;
export type SupportedChainId = typeof SUPPORTED_CHAIN_IDS[number];

/** Network addresses registry */
export const NETWORK_ADDRESSES = {
  [BASE_SEPOLIA_CHAIN_ID]: BASE_SEPOLIA_ADDRESSES,
} as const;

/** Get contract address for a specific network and contract */
export function getContractAddress(chainId: SupportedChainId, contractName: ContractName): Address {
  const networkAddresses = NETWORK_ADDRESSES[chainId];
  if (!networkAddresses) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  
  const address = networkAddresses[contractName];
  if (address === '0x0000000000000000000000000000000000000000') {
    throw new Error(`Contract ${contractName} not deployed on chain ${chainId}`);
  }
  
  return address;
}

/** Check if a contract is deployed (non-zero address) */
export function isContractDeployed(chainId: SupportedChainId, contractName: ContractName): boolean {
  try {
    const address = NETWORK_ADDRESSES[chainId]?.[contractName];
    return address !== '0x0000000000000000000000000000000000000000';
  } catch {
    return false;
  }
}
