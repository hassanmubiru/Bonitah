/**
 * Per-network deployed-address registry.
 *
 * Keyed by chain ID (Base Sepolia 84532 per Req 1.1). After each deployment the
 * Foundry deploy scripts (task 9) overwrite these placeholders with the real proxy
 * addresses and emit them here so the frontend and backend consume a single typed
 * source of contract addresses (Req 17.1, 1.1).
 *
 * Until deployment the addresses are the zero address. `getContractAddress` throws
 * on an unconfigured (zero) address so no layer ever silently reads from address(0).
 */

import type { Address } from 'viem';

import type { ContractName } from './types.js';
import { BASE_SEPOLIA_CHAIN_ID, type SupportedChainId } from './networks.js';

/** Sentinel used for not-yet-deployed contracts. */
export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

/** Map of every BFN contract to its deployed address on a single network. */
export type ContractAddressMap = Readonly<Record<ContractName, Address>>;

/**
 * Deployed-address registry keyed by chain ID.
 *
 * Placeholder values (ZERO_ADDRESS) are replaced by the deployment pipeline. Also
 * accepts an optional ERC20 test-stablecoin address wired at contract initialization.
 */
export interface NetworkDeployment {
  readonly chainId: SupportedChainId;
  readonly contracts: ContractAddressMap;
  /** Configurable ERC20 stablecoin used by the vault/treasury (design: token wiring). */
  readonly token: Address;
  /** Block at which the deployment was recorded; 0n until populated. */
  readonly deployedAtBlock: bigint;
}

export const DEPLOYMENTS: Readonly<Record<SupportedChainId, NetworkDeployment>> = {
  [BASE_SEPOLIA_CHAIN_ID]: {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    contracts: {
      Registry: '0xc37319a9ca70aa581b96b96ddb79eb19c2b391c5',
      SavingsVault: '0x75517c778c77628a5c0d4bba7398520da8849eb0',
      CommunityTreasury: '0x07e19c706cf7e77afd215a6fef136b3b8a62eebe',
      Education: '0x0806ebcbd047a9a264027c2a31693ff26a69b3ff',
      Governance: '0xab48386f4306b1e356d02456e9ecf6e74cafa76b',
    },
    token: '0x4fd1403945341786dba53e31156c2dedee40ef34',
    deployedAtBlock: 44629468n,
  },
} as const;

/** True if the address has been populated with a real (non-zero) deployment. */
export function isDeployed(address: Address): boolean {
  return address.toLowerCase() !== ZERO_ADDRESS;
}

/** Resolve the deployment record for a supported chain. */
export function getDeployment(chainId: SupportedChainId): NetworkDeployment {
  return DEPLOYMENTS[chainId];
}

/**
 * Resolve a single contract address for a chain.
 *
 * @throws if the contract has not yet been deployed (address is the zero address)
 * so callers never read financial state from an unconfigured contract (Req 1.1).
 */
export function getContractAddress(chainId: SupportedChainId, contract: ContractName): Address {
  const address = DEPLOYMENTS[chainId].contracts[contract];
  if (!isDeployed(address)) {
    throw new Error(
      `BFN contract "${contract}" is not deployed on chain ${chainId}. ` +
        `Populate shared/src/addresses.ts from the deployment pipeline before use.`,
    );
  }
  return address;
}
