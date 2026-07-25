/**
 * BFN Contracts - Complete Export
 * Auto-generated exports for contract ABIs, addresses, and types
 */

// Individual contract ABIs for tree-shaking
export { default as RegistryAbi } from './abis/Registry.js';
export { default as SavingsVaultAbi } from './abis/SavingsVault.js';
export { default as CommunityTreasuryAbi } from './abis/CommunityTreasury.js';
export { default as EducationAbi } from './abis/Education.js';
export { default as GovernanceAbi } from './abis/Governance.js';

// Namespace exports to avoid conflicts
export * as ABIs from './abis/index.js';
export * as Addresses from './addresses/index.js';
export * as Types from './types/index.js';

// Convenience re-exports with prefixes
export {
  BASE_SEPOLIA_ADDRESSES,
  BASE_SEPOLIA_TOKEN_ADDRESS,
  BASE_SEPOLIA_DEPLOYED_BLOCK
} from './addresses/base-sepolia.js';

export {
  CONTRACT_NAMES as BONITAH_CONTRACT_NAMES
} from './types/contracts.js';

export type {
  ContractName as BonitahContractName,
  ContractDeployment as BonitahContractDeployment,
  NetworkDeployment as BonitahNetworkDeployment,
  ContractConfig as BonitahContractConfig
} from './types/contracts.js';
