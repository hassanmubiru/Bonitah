/**
 * Base Sepolia Contract Addresses
 * Auto-generated and updated by deployment scripts
 * DO NOT EDIT MANUALLY
 */

import type { Address } from 'viem';
import type { ContractName } from '../types/contracts.js';

export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;

/** Contract addresses on Base Sepolia - updated by deployment */
export const BASE_SEPOLIA_ADDRESSES: Record<ContractName, Address> = {
  Registry: '0x0000000000000000000000000000000000000000' as Address,
  SavingsVault: '0x0000000000000000000000000000000000000000' as Address,
  CommunityTreasury: '0x0000000000000000000000000000000000000000' as Address,
  Education: '0x0000000000000000000000000000000000000000' as Address,
  Governance: '0x0000000000000000000000000000000000000000' as Address,
} as const;

/** ERC20 token address used by the contracts */
export const BASE_SEPOLIA_TOKEN_ADDRESS: Address = '0x0000000000000000000000000000000000000000' as Address;

/** Block number when contracts were deployed */
export const BASE_SEPOLIA_DEPLOYED_BLOCK = 0n;

export default BASE_SEPOLIA_ADDRESSES;
