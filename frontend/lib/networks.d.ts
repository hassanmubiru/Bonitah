/**
 * Network definitions for BFN.
 *
 * The blockchain is the single source of truth for all financial state and every
 * read/write is executed against Base Sepolia (chain ID 84532) per Requirement 1.1.
 * These constants are the canonical reference used by the frontend (viem/wagmi),
 * the backend (viem read/index), and the deployed-address registry.
 */
/** Base Sepolia chain ID — the only network BFN interacts with (Req 1.1). */
export declare const BASE_SEPOLIA_CHAIN_ID: 84532;
/**
 * The set of chain IDs BFN supports. Kept as a tuple so it can back both a
 * union type and runtime membership checks. Currently Base Sepolia only.
 */
export declare const SUPPORTED_CHAIN_IDS: readonly [84532];
/** Union of chain IDs BFN supports. */
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];
/** Static metadata describing a supported network. */
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
/** Per-chain network metadata keyed by chain ID. */
export declare const NETWORKS: Readonly<Record<SupportedChainId, NetworkConfig>>;
/** Runtime guard: is the given chain ID one BFN supports? */
export declare function isSupportedChainId(chainId: number): chainId is SupportedChainId;
/** Resolve network metadata for a supported chain ID. */
export declare function getNetworkConfig(chainId: SupportedChainId): NetworkConfig;
//# sourceMappingURL=networks.d.ts.map