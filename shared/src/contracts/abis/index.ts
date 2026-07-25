/**
 * Contract ABIs - All exports
 * Auto-generated from Foundry compilation artifacts
 */

export { registryAbi } from './Registry.js';
export { savingsVaultAbi } from './SavingsVault.js';
export { communityTreasuryAbi } from './CommunityTreasury.js';
export { educationAbi } from './Education.js';
export { governanceAbi } from './Governance.js';

// Re-export individual ABIs as default exports for compatibility
export { default as RegistryAbi } from './Registry.js';
export { default as SavingsVaultAbi } from './SavingsVault.js';
export { default as CommunityTreasuryAbi } from './CommunityTreasury.js';
export { default as EducationAbi } from './Education.js';
export { default as GovernanceAbi } from './Governance.js';

// Aggregate ABI registry
import { registryAbi } from './Registry.js';
import { savingsVaultAbi } from './SavingsVault.js';
import { communityTreasuryAbi } from './CommunityTreasury.js';
import { educationAbi } from './Education.js';
import { governanceAbi } from './Governance.js';
import type { ContractName } from '../types/contracts.js';
import type { Abi } from 'abitype';

export const CONTRACT_ABIS = {
  Registry: registryAbi,
  SavingsVault: savingsVaultAbi,
  CommunityTreasury: communityTreasuryAbi,
  Education: educationAbi,
  Governance: governanceAbi,
} as const satisfies Record<ContractName, Abi>;

/** Resolve the ABI for a given contract name. */
export function getContractAbi(name: ContractName): Abi {
  return CONTRACT_ABIS[name];
}