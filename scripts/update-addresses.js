#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Update contract addresses after deployment
 * Usage: node update-addresses.js <network> <contract> <address>
 * Example: node update-addresses.js base-sepolia SavingsVault 0x123...
 */
function updateAddress(network, contractName, address) {
  const addressesPath = path.join(__dirname, '../deployment', network, 'addresses.json');
  
  // Read existing addresses
  let addresses = {};
  if (fs.existsSync(addressesPath)) {
    addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  }
  
  // Update address
  addresses[contractName] = address;
  
  // Ensure deployment directory exists
  const deploymentDir = path.dirname(addressesPath);
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  
  // Write updated addresses
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log(`✅ Updated ${contractName} address to ${address} on ${network}`);
  
  // Regenerate TypeScript files
  require('./generate-abis.js');
}

// CLI usage
if (require.main === module) {
  const [network, contractName, address] = process.argv.slice(2);
  
  if (!network || !contractName || !address) {
    console.error('Usage: node update-addresses.js <network> <contract> <address>');
    process.exit(1);
  }
  
  updateAddress(network, contractName, address);
}

module.exports = { updateAddress };
