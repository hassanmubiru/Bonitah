import { BASE_SEPOLIA_CHAIN_ID } from '../../networks.js';
/** Sentinel used for not-yet-deployed contracts */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
/** All available BFN contract names */
export var ContractName;
(function (ContractName) {
    ContractName["SavingsVault"] = "SavingsVault";
    ContractName["CommunityTreasury"] = "CommunityTreasury";
    ContractName["Education"] = "Education";
    ContractName["Registry"] = "Registry";
    ContractName["Governance"] = "Governance";
})(ContractName || (ContractName = {}));
/** Deployed contract addresses by chain ID */
export const DEPLOYMENTS = {
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
};
/** Check if address is deployed (non-zero) */
export function isDeployed(address) {
    return address.toLowerCase() !== ZERO_ADDRESS;
}
/** Get deployment for a specific chain */
export function getDeployment(chainId) {
    return DEPLOYMENTS[chainId];
}
/** Get contract address for a specific chain and contract */
export function getContractAddress(chainId, contract) {
    const address = DEPLOYMENTS[chainId].contracts[contract];
    if (!isDeployed(address)) {
        throw new Error(`BFN contract "${contract}" is not deployed on chain ${chainId}. ` +
            `Populate addresses from deployment pipeline before use.`);
    }
    return address;
}
//# sourceMappingURL=index.js.map