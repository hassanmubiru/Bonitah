/**
 * Contract Addresses
 * Auto-generated contract address mappings
 *
 * Provides type-safe contract address resolution for all networks
 */
import type { Address } from 'viem';
import { type SupportedChainId } from '../../networks.js';
/** Sentinel used for not-yet-deployed contracts */
export declare const ZERO_ADDRESS: Address;
/** All available BFN contract names */
export declare enum ContractName {
    'SavingsVault' = "SavingsVault",
    'CommunityTreasury' = "CommunityTreasury",
    'Education' = "Education",
    'Registry' = "Registry",
    'Governance' = "Governance"
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
export declare const DEPLOYMENTS: Readonly<Record<SupportedChainId, NetworkDeployment>>;
/** Check if address is deployed (non-zero) */
export declare function isDeployed(address: Address): boolean;
/** Get deployment for a specific chain */
export declare function getDeployment(chainId: SupportedChainId): NetworkDeployment;
/** Get contract address for a specific chain and contract */
export declare function getContractAddress(chainId: SupportedChainId, contract: ContractName): Address;
//# sourceMappingURL=index.d.ts.map