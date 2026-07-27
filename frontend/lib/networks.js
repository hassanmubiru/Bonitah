/**
 * Network definitions for BFN.
 *
 * The blockchain is the single source of truth for all financial state and every
 * read/write is executed against Base Sepolia (chain ID 84532) per Requirement 1.1.
 * These constants are the canonical reference used by the frontend (viem/wagmi),
 * the backend (viem read/index), and the deployed-address registry.
 */
/** Base Sepolia chain ID — the only network BFN interacts with (Req 1.1). */
export const BASE_SEPOLIA_CHAIN_ID = 84532;
/**
 * The set of chain IDs BFN supports. Kept as a tuple so it can back both a
 * union type and runtime membership checks. Currently Base Sepolia only.
 */
export const SUPPORTED_CHAIN_IDS = [BASE_SEPOLIA_CHAIN_ID];
/** Per-chain network metadata keyed by chain ID. */
export const NETWORKS = {
    [BASE_SEPOLIA_CHAIN_ID]: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        name: 'Base Sepolia',
        shortName: 'base-sepolia',
        nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
        blockExplorerUrl: 'https://sepolia.basescan.org',
        testnet: true,
    },
};
/** Runtime guard: is the given chain ID one BFN supports? */
export function isSupportedChainId(chainId) {
    return SUPPORTED_CHAIN_IDS.includes(chainId);
}
/** Resolve network metadata for a supported chain ID. */
export function getNetworkConfig(chainId) {
    return NETWORKS[chainId];
}
//# sourceMappingURL=networks.js.map