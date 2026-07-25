#!/usr/bin/env node

/**
 * Address Update Script for BFN Contracts
 * 
 * Updates deployed contract addresses in the shared package from deployment records.
 * This script is called automatically by deployment scripts to keep addresses in sync.
 * 
 * Usage:
 *   node scripts/update-addresses.js <deployment-file>
 *   node scripts/update-addresses.js deployment/base-sepolia.json
 * 
 * Features:
 * - Validates deployment record format
 * - Updates both legacy addresses.ts and new structure
 * - Preserves type safety with Address types
 * - Creates deployment metadata files
 * - Validates address formats
 */

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

const projectRoot = join(__dirname, '..');

/**
 * Validate Ethereum address format
 */
function isValidAddress(address) {
  return typeof address === 'string' && 
         /^0x[a-fA-F0-9]{40}$/.test(address) && 
         address !== '0x0000000000000000000000000000000000000000';
}

/**
 * Validate deployment record structure
 */
function validateDeploymentRecord(deployment) {
  const required = ['chainId', 'network', 'contracts', 'deployer'];
  
  for (const field of required) {
    if (!(field in deployment)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (deployment.chainId !== 84532) {
    throw new Error(`Invalid chain ID: ${deployment.chainId}. Expected 84532 (Base Sepolia)`);
  }

  if (!isValidAddress(deployment.deployer)) {
    throw new Error(`Invalid deployer address: ${deployment.deployer}`);
  }

  const contracts = ['Registry', 'SavingsVault', 'CommunityTreasury', 'Education', 'Governance'];
  
  for (const contractName of contracts) {
    const contract = deployment.contracts[contractName];
    if (!contract) {
      throw new Error(`Missing contract: ${contractName}`);
    }
    
    if (!isValidAddress(contract.proxy)) {
      throw new Error(`Invalid proxy address for ${contractName}: ${contract.proxy}`);
    }

    if (!isValidAddress(contract.implementation)) {
      throw new Error(`Invalid implementation address for ${contractName}: ${contract.implementation}`);
    }
  }

  console.log('   ✅ Deployment record validation passed');
}

/**
 * Update legacy addresses.ts file
 */
function updateLegacyAddresses(deployment) {
  console.log('📄 Updating legacy addresses.ts...');
  
  const addressesPath = join(projectRoot, 'shared/src/addresses.ts');
  let content = readFileSync(addressesPath, 'utf8');

  // Update the DEPLOYMENTS constant
  const chainId = deployment.chainId;
  const contracts = {};
  
  for (const [name, contract] of Object.entries(deployment.contracts)) {
    contracts[name] = contract.proxy; // Use proxy address for legacy compatibility
  }

  const tokenAddress = deployment.token || '0x0000000000000000000000000000000000000000';
  const deployedAtBlock = deployment.deployedAt?.block || 0;

  // Replace the deployment entry
  const deploymentEntry = `  [${chainId}]: {
    chainId: ${chainId},
    contracts: {
      Registry: '${contracts.Registry}' as Address,
      SavingsVault: '${contracts.SavingsVault}' as Address,
      CommunityTreasury: '${contracts.CommunityTreasury}' as Address,
      Education: '${contracts.Education}' as Address,
      Governance: '${contracts.Governance}' as Address,
    },
    token: '${tokenAddress}' as Address,
    deployedAtBlock: ${deployedAtBlock}n,
  }`;

  // Replace the existing deployment entry
  const deploymentRegex = new RegExp(`\\[${chainId}\\]:\\s*{[^}]*(?:{[^}]*}[^}]*)*}`, 's');
  
  if (deploymentRegex.test(content)) {
    content = content.replace(deploymentRegex, deploymentEntry);
  } else {
    // If not found, replace the entire DEPLOYMENTS object
    const deploymentsRegex = /export const DEPLOYMENTS[^}]*}[^}]*}/s;
    const deploymentsReplacement = `export const DEPLOYMENTS: Readonly<Record<SupportedChainId, NetworkDeployment>> = {
${deploymentEntry},
} as const`;
    content = content.replace(deploymentsRegex, deploymentsReplacement);
  }

  writeFileSync(addressesPath, content, 'utf8');
  console.log('   ✅ Legacy addresses.ts updated');
}

/**
 * Update new structure addresses files
 */
function updateNewStructure(deployment) {
  console.log('🏗️ Updating new contract structure...');
  
  const baseSepolia = `/**
 * Base Sepolia Contract Addresses
 * Auto-generated and updated by deployment scripts
 * Last updated: ${new Date().toISOString()}
 */

import type { Address } from 'viem';
import type { ContractName } from '../types/contracts.js';

export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;

/** Contract addresses on Base Sepolia - updated by deployment */
export const BASE_SEPOLIA_ADDRESSES: Record<ContractName, Address> = {
  Registry: '${deployment.contracts.Registry.proxy}' as Address,
  SavingsVault: '${deployment.contracts.SavingsVault.proxy}' as Address,
  CommunityTreasury: '${deployment.contracts.CommunityTreasury.proxy}' as Address,
  Education: '${deployment.contracts.Education.proxy}' as Address,
  Governance: '${deployment.contracts.Governance.proxy}' as Address,
} as const;

/** Implementation addresses (for upgrades) */
export const BASE_SEPOLIA_IMPLEMENTATIONS: Record<ContractName, Address> = {
  Registry: '${deployment.contracts.Registry.implementation}' as Address,
  SavingsVault: '${deployment.contracts.SavingsVault.implementation}' as Address,
  CommunityTreasury: '${deployment.contracts.CommunityTreasury.implementation}' as Address,
  Education: '${deployment.contracts.Education.implementation}' as Address,
  Governance: '${deployment.contracts.Governance.implementation}' as Address,
} as const;

/** ERC20 token address used by the contracts */
export const BASE_SEPOLIA_TOKEN_ADDRESS: Address = '${deployment.token || '0x0000000000000000000000000000000000000000'}' as Address;

/** Block number when contracts were deployed */
export const BASE_SEPOLIA_DEPLOYED_BLOCK = ${deployment.deployedAt?.block || 0}n;

/** Deployment metadata */
export const BASE_SEPOLIA_DEPLOYMENT = {
  chainId: BASE_SEPOLIA_CHAIN_ID,
  network: '${deployment.network}',
  deployer: '${deployment.deployer}' as Address,
  deployedAt: {
    block: BASE_SEPOLIA_DEPLOYED_BLOCK,
    timestamp: ${deployment.deployedAt?.timestamp || 0},
  },
  gasUsed: {
    total: ${deployment.gasUsed?.total || 0}n,
    contracts: {
      Registry: ${deployment.gasUsed?.contracts?.Registry || 0}n,
      SavingsVault: ${deployment.gasUsed?.contracts?.SavingsVault || 0}n,
      CommunityTreasury: ${deployment.gasUsed?.contracts?.CommunityTreasury || 0}n,
      Education: ${deployment.gasUsed?.contracts?.Education || 0}n,
      Governance: ${deployment.gasUsed?.contracts?.Governance || 0}n,
    },
  },
} as const;

export default BASE_SEPOLIA_ADDRESSES;
`;

  const baseSepoliaPath = join(projectRoot, 'shared/src/contracts/addresses/base-sepolia.ts');
  writeFileSync(baseSepoliaPath, baseSepolia, 'utf8');
  console.log('   ✅ Updated base-sepolia.ts');
}

/**
 * Update shared package index files
 */
function updateIndexFiles() {
  console.log('📝 Updating shared package index...');
  
  // Update main shared index to include contracts
  const sharedIndexPath = join(projectRoot, 'shared/src/index.ts');
  let sharedIndex = '';
  
  if (existsSync(sharedIndexPath)) {
    sharedIndex = readFileSync(sharedIndexPath, 'utf8');
  }

  // Add contracts export if not present
  if (!sharedIndex.includes("export * from './contracts/index.js';")) {
    sharedIndex += "\n// Contract exports\nexport * from './contracts/index.js';\n";
  }

  writeFileSync(sharedIndexPath, sharedIndex, 'utf8');
  console.log('   ✅ Updated shared/src/index.ts');
}

/**
 * Rebuild shared package
 */
function rebuildSharedPackage() {
  console.log('🔨 Rebuilding shared package...');
  
  const { execSync } = require('child_process');
  
  try {
    // Change to shared directory and build
    process.chdir(join(projectRoot, 'shared'));
    execSync('npm run build', { stdio: 'pipe' });
    console.log('   ✅ Shared package rebuilt successfully');
  } catch (error) {
    console.warn('   ⚠️ Failed to rebuild shared package:', error.message);
    console.warn('   ℹ️ Run "cd shared && npm run build" manually');
  } finally {
    process.chdir(projectRoot);
  }
}

/**
 * Main execution function
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Usage: node scripts/update-addresses.js <deployment-file>');
    console.error('   Example: node scripts/update-addresses.js deployment/base-sepolia.json');
    process.exit(1);
  }

  const deploymentFile = args[0];
  const deploymentPath = join(projectRoot, deploymentFile);

  try {
    console.log('🚀 Starting Address Update\n');

    // Validate deployment file exists
    if (!existsSync(deploymentPath)) {
      throw new Error(`Deployment file not found: ${deploymentPath}`);
    }

    console.log(`📄 Reading deployment from: ${deploymentFile}`);
    const deployment = JSON.parse(readFileSync(deploymentPath, 'utf8'));

    // Validate deployment record
    console.log('🔍 Validating deployment record...');
    validateDeploymentRecord(deployment);

    // Update address files
    updateLegacyAddresses(deployment);
    updateNewStructure(deployment);
    updateIndexFiles();

    // Rebuild shared package
    rebuildSharedPackage();

    console.log('\n✅ Address Update Complete!');
    console.log('\n📦 Updated Files:');
    console.log('   📄 shared/src/addresses.ts - Legacy addresses');
    console.log('   📄 shared/src/contracts/addresses/base-sepolia.ts - New structure');
    console.log('   📄 shared/src/index.ts - Main exports');
    console.log('   🔨 shared/dist/ - Rebuilt package');
    
    console.log('\n🎯 Next Steps:');
    console.log('   • Frontend can now import contracts: import { getContractAddress } from "@bonitah/shared"');
    console.log('   • Backend can access addresses: import { BASE_SEPOLIA_ADDRESSES } from "@bonitah/shared/contracts"');
    console.log('   • All addresses are type-safe and validated');
    
  } catch (error) {
    console.error('\n❌ Address update failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();