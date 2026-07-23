#!/usr/bin/env node

/**
 * Updates the shared package addresses.ts file with deployed contract addresses.
 * 
 * Usage:
 *   node scripts/update-addresses.js <chainId> <registry> <vault> <treasury> <education> <governance> <token> <blockNumber>
 * 
 * Example:
 *   node scripts/update-addresses.js 84532 0x123... 0x456... 0x789... 0xabc... 0xdef... 0x111... 12345678
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 8) {
    console.error('Usage: node scripts/update-addresses.js <chainId> <registry> <vault> <treasury> <education> <governance> <token> <blockNumber>');
    process.exit(1);
  }
  
  const [chainId, registry, vault, treasury, education, governance, token, blockNumber] = args;
  
  // Validate inputs
  if (!isValidChainId(chainId)) {
    console.error('Error: Invalid chain ID. Expected 84532 for Base Sepolia.');
    process.exit(1);
  }
  
  const addresses = [registry, vault, treasury, education, governance, token];
  for (const addr of addresses) {
    if (!isValidAddress(addr)) {
      console.error(`Error: Invalid address ${addr}`);
      process.exit(1);
    }
  }
  
  if (!isValidBlockNumber(blockNumber)) {
    console.error('Error: Invalid block number');
    process.exit(1);
  }
  
  console.log('Updating shared package addresses...');
  console.log(`Chain ID: ${chainId}`);
  console.log(`Registry: ${registry}`);
  console.log(`SavingsVault: ${vault}`);
  console.log(`CommunityTreasury: ${treasury}`);
  console.log(`Education: ${education}`);
  console.log(`Governance: ${governance}`);
  console.log(`Token: ${token}`);
  console.log(`Block: ${blockNumber}`);
  
  updateAddresses(chainId, {
    Registry: registry,
    SavingsVault: vault,
    CommunityTreasury: treasury,
    Education: education,
    Governance: governance,
  }, token, blockNumber);
  
  console.log('✓ Addresses updated successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('1. cd shared && pnpm build');
  console.log('2. Verify addresses in shared/src/addresses.ts');
  console.log('3. Commit the updated addresses');
}

function isValidChainId(chainId) {
  return chainId === '84532'; // Base Sepolia
}

function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address) && address !== '0x0000000000000000000000000000000000000000';
}

function isValidBlockNumber(blockNumber) {
  const num = parseInt(blockNumber);
  return !isNaN(num) && num > 0;
}

function updateAddresses(chainId, contracts, token, blockNumber) {
  const addressesPath = join(__dirname, '..', 'shared', 'src', 'addresses.ts');
  
  try {
    let content = readFileSync(addressesPath, 'utf8');
    
    // Update the deployment object for the specific chain
    const deploymentRegex = new RegExp(
      `(\\[${chainId}\\]:\\s*{[^}]*contracts:\\s*{)([^}]*)(}[^}]*token:\\s*)[^,]*([^}]*deployedAtBlock:\\s*)[^,}]*([^}]*})`
    );
    
    const contractsStr = Object.entries(contracts)
      .map(([name, addr]) => `      ${name}: '${addr}' as const,`)
      .join('\n');
    
    const replacement = `$1\n${contractsStr}\n    $3'${token}' as const,$4${blockNumber}n,$5`;
    
    content = content.replace(deploymentRegex, replacement);
    
    writeFileSync(addressesPath, content, 'utf8');
    
  } catch (error) {
    console.error('Error updating addresses file:', error.message);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}