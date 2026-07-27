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
import { type SupportedChainId } from './networks.js';
/** Sentinel used for not-yet-deployed contracts. */
export declare const ZERO_ADDRESS: Address;
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
export declare const DEPLOYMENTS: Readonly<Record<SupportedChainId, NetworkDeployment>>;
/** True if the address has been populated with a real (non-zero) deployment. */
export declare function isDeployed(address: Address): boolean;
/** Resolve the deployment record for a supported chain. */
export declare function getDeployment(chainId: SupportedChainId): NetworkDeployment;
/**
 * Resolve a single contract address for a chain.
 *
 * @throws if the contract has not yet been deployed (address is the zero address)
 * so callers never read financial state from an unconfigured contract (Req 1.1).
 */
export declare function getContractAddress(chainId: SupportedChainId, contract: ContractName): Address;
//# sourceMappingURL=addresses.d.ts.map