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
import { BASE_SEPOLIA_CHAIN_ID } from './networks.js';
/** Sentinel used for not-yet-deployed contracts. */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const DEPLOYMENTS = {
    [BASE_SEPOLIA_CHAIN_ID]: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        contracts: {
            Registry: '0xBd81a62b21eaE93D74daB2B2D93e040D51f75db1',
            SavingsVault: '0x16E88B4a717B082f8d29C4EeA0796F488C0da7B6',
            CommunityTreasury: '0xa0D284d9080cb7F6676e62116E0A659BB4Ed9b04',
            Education: '0x5A63Da81A04BE39d5469B8BD9281CbD3332b51ac',
            Governance: '0x13B14D148E3369dCC448006494810A95928eEEB4',
        },
        // REAL Circle USDC on Base Sepolia - 6 decimals, official deployment
        token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        deployedAtBlock: 44662012n,
    },
};
/** True if the address has been populated with a real (non-zero) deployment. */
export function isDeployed(address) {
    return address.toLowerCase() !== ZERO_ADDRESS;
}
/** Resolve the deployment record for a supported chain. */
export function getDeployment(chainId) {
    return DEPLOYMENTS[chainId];
}
/**
 * Resolve a single contract address for a chain.
 *
 * @throws if the contract has not yet been deployed (address is the zero address)
 * so callers never read financial state from an unconfigured contract (Req 1.1).
 */
export function getContractAddress(chainId, contract) {
    const address = DEPLOYMENTS[chainId].contracts[contract];
    if (!isDeployed(address)) {
        throw new Error(`BFN contract "${contract}" is not deployed on chain ${chainId}. ` +
            `Populate shared/src/addresses.ts from the deployment pipeline before use.`);
    }
    return address;
}
//# sourceMappingURL=addresses.js.map