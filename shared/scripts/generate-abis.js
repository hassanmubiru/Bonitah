#!/usr/bin/env node

/**
 * ABI Generator Script
 * 
 * Extracts contract ABIs from Foundry build artifacts and generates
 * TypeScript files with proper type safety for viem/wagmi usage.
 * 
 * This script:
 * 1. Reads contract JSON files from contracts/out/
 * 2. Extracts ABI arrays from each contract
 * 3. Generates TypeScript with proper `as const satisfies Abi` declarations
 * 4. Creates both individual contract files and a unified export
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONTRACTS_OUT_DIR = path.resolve(__dirname, '../../contracts/out');
const SHARED_SRC_DIR = path.resolve(__dirname, '../src');
const CONTRACTS_DIR = path.join(SHARED_SRC_DIR, 'contracts');

// Main contracts to extract (corresponds to ContractName type)
const MAIN_CONTRACTS = [
  'SavingsVault',
  'CommunityTreasury', 
  'Education',
  'Registry',
  'Governance'
];

/**
 * Reads a Foundry contract artifact and extracts the ABI
 */
function extractAbiFromArtifact(contractPath) {
  try {
    const artifactContent = fs.readFileSync(contractPath, 'utf-8');
    const artifact = JSON.parse(artifactContent);
    
    if (!artifact.abi) {
      throw new Error(`No ABI found in artifact: ${contractPath}`);
    }
    
    return artifact.abi;
  } catch (error) {
    console.error(`Error reading artifact ${contractPath}:`, error.message);
    return null;
  }
}

/**
 * Generates TypeScript ABI export with proper type safety
 */
function generateAbiTypeScript(contractName, abi) {
  const camelCaseName = contractName.charAt(0).toLowerCase() + contractName.slice(1);
  
  return `/**
 * ${contractName} Contract ABI
 * Auto-generated from Foundry build artifacts
 * 
 * Type-safe ABI for ${contractName} contract interactions with viem/wagmi
 */
import type { Abi } from 'abitype';

export const ${camelCaseName}Abi = ${JSON.stringify(abi, null, 2)} as const satisfies Abi;

export default ${camelCaseName}Abi;
`;
}

/**
 * Generates the main abis/index.ts file with all exports
 */
function generateAbisIndex(contracts) {
  const imports = contracts.map(name => {
    const camelCase = name.charAt(0).toLowerCase() + name.slice(1);
    return `export { ${camelCase}Abi } from './${name}.js';`;
  }).join('\n');

  const reExports = contracts.map(name => {
    const camelCase = name.charAt(0).toLowerCase() + name.slice(1);
    return `  ${camelCase}Abi,`;
  }).join('\n');

  return `/**
 * Contract ABIs Index
 * Auto-generated from Foundry build artifacts
 * 
 * Provides type-safe contract ABIs for all BFN contracts
 */

${imports}

export {
${reExports}
};

// For convenience, also provide default export with all ABIs
export default {
${reExports}
};
`;
}

/**
 * Generates addresses/index.ts with proper contract address mappings
 */
function generateAddressesIndex(contracts) {
  const contractsEnum = contracts.map(name => `  '${name}' = '${name}',`).join('\n');
  const addressMapping = contracts.map(name => `  ${name}: ZERO_ADDRESS,`).join('\n');

  return `/**
 * Contract Addresses
 * Auto-generated contract address mappings
 * 
 * Provides type-safe contract address resolution for all networks
 */
import type { Address } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID, type SupportedChainId } from '../networks.js';

/** Sentinel used for not-yet-deployed contracts */
export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

/** All available BFN contract names */
export enum ContractName {
${contractsEnum}
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
export const DEPLOYMENTS: Readonly<Record<SupportedChainId, NetworkDeployment>> = {
  [BASE_SEPOLIA_CHAIN_ID]: {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    contracts: {
${addressMapping}
    },
    token: ZERO_ADDRESS,
    deployedAtBlock: 0n,
  },
} as const;

/** Check if address is deployed (non-zero) */
export function isDeployed(address: Address): boolean {
  return address.toLowerCase() !== ZERO_ADDRESS;
}

/** Get deployment for a specific chain */
export function getDeployment(chainId: SupportedChainId): NetworkDeployment {
  return DEPLOYMENTS[chainId];
}

/** Get contract address for a specific chain and contract */
export function getContractAddress(chainId: SupportedChainId, contract: ContractName): Address {
  const address = DEPLOYMENTS[chainId].contracts[contract];
  if (!isDeployed(address)) {
    throw new Error(
      \`BFN contract "\${contract}" is not deployed on chain \${chainId}. \` +
      \`Populate addresses from deployment pipeline before use.\`
    );
  }
  return address;
}
`;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔄 Generating contract ABIs and addresses...');
  
  // Ensure output directories exist
  const abisDir = path.join(CONTRACTS_DIR, 'abis');
  const addressesDir = path.join(CONTRACTS_DIR, 'addresses');
  
  fs.mkdirSync(abisDir, { recursive: true });
  fs.mkdirSync(addressesDir, { recursive: true });
  
  const processedContracts = [];
  
  // Process each main contract
  for (const contractName of MAIN_CONTRACTS) {
    const artifactPath = path.join(CONTRACTS_OUT_DIR, `${contractName}.sol`, `${contractName}.json`);
    
    console.log(`📖 Processing ${contractName}...`);
    
    if (!fs.existsSync(artifactPath)) {
      console.warn(`⚠️  Artifact not found: ${artifactPath}`);
      continue;
    }
    
    const abi = extractAbiFromArtifact(artifactPath);
    if (!abi) {
      console.warn(`⚠️  Could not extract ABI for ${contractName}`);
      continue;
    }
    
    // Generate individual ABI file
    const abiTypeScript = generateAbiTypeScript(contractName, abi);
    const abiOutputPath = path.join(abisDir, `${contractName}.ts`);
    fs.writeFileSync(abiOutputPath, abiTypeScript);
    
    processedContracts.push(contractName);
    console.log(`✅ Generated ABI: ${abiOutputPath}`);
  }
  
  // Generate index files
  console.log('📝 Generating index files...');
  
  // ABIs index
  const abisIndex = generateAbisIndex(processedContracts);
  fs.writeFileSync(path.join(abisDir, 'index.ts'), abisIndex);
  
  // Addresses index  
  const addressesIndex = generateAddressesIndex(processedContracts);
  fs.writeFileSync(path.join(addressesDir, 'index.ts'), addressesIndex);
  
  // Update main contracts index
  const contractsIndex = `/**
 * Contracts Package
 * Auto-generated contract exports
 */

export * from './abis/index.js';
export * from './addresses/index.js';
`;
  fs.writeFileSync(path.join(CONTRACTS_DIR, 'index.ts'), contractsIndex);
  
  console.log(`🎉 Successfully generated ${processedContracts.length} contract ABIs and addresses`);
  console.log('📁 Generated files:');
  console.log(`   - ${abisDir}/index.ts`);
  console.log(`   - ${addressesDir}/index.ts`);
  processedContracts.forEach(name => {
    console.log(`   - ${abisDir}/${name}.ts`);
  });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ ABI generation failed:', error);
    process.exit(1);
  });
}