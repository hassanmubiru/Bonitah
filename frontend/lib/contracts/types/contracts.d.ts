/**
 * Contract Type Definitions
 * Auto-generated type definitions for contract interactions
 */
import type { Address, Hash, Hex } from 'viem';
/** The five BFN smart contracts */
export type ContractName = 'Registry' | 'SavingsVault' | 'CommunityTreasury' | 'Education' | 'Governance';
/** All contract names as a runtime array */
export declare const CONTRACT_NAMES: readonly ["Registry", "SavingsVault", "CommunityTreasury", "Education", "Governance"];
/** Contract deployment information */
export interface ContractDeployment {
    readonly proxy: Address;
    readonly implementation: Address;
    readonly deployedAt: {
        readonly block: bigint;
        readonly timestamp: number;
    };
}
/** Network deployment record */
export interface NetworkDeployment {
    readonly chainId: number;
    readonly network: string;
    readonly deployer: Address;
    readonly contracts: Record<ContractName, ContractDeployment>;
    readonly token: Address;
    readonly gasUsed: {
        readonly total: bigint;
        readonly contracts: Record<ContractName, bigint>;
    };
}
/** Contract interaction configuration */
export interface ContractConfig {
    readonly address: Address;
    readonly abi: readonly unknown[];
    readonly chainId: number;
}
export type { Address, Hash, Hex };
//# sourceMappingURL=contracts.d.ts.map