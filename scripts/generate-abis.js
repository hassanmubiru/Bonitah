#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CONTRACTS_OUT_DIR = path.join(__dirname, '../contracts/out');
const SHARED_SRC_DIR = path.join(__dirname, '../shared/src');
const CONTRACTS_DIR = path.join(SHARED_SRC_DIR, 'contracts');

// Contract names to process
const CONTRACTS = [
  'SavingsVault',
  'CommunityTreasury', 
  'Education',
  'Registry',
  'Governance'
];

// Network configurations
const NETWORKS = {
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532
  },
  'localhost': {
    name: 'Local',
    chainId: 31337
  }
};

/**
 * Ensure directory exists
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Extract ABI from Foundry build artifact
 */
function extractABI(contractName) {
  const artifactPath = path.join(CONTRACTS_OUT_DIR, `${contractName}.sol`, `${contractName}.json`);
  
  if (!fs.existsSync(artifactPath)) {
    console.warn(`⚠️  Artifact not found: ${artifactPath}`);
    return null;
  }

  try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    return artifact.abi;
  } catch (error) {
    console.error(`❌ Failed to parse ${contractName} artifact:`, error.message);
    return null;
  }
}

/**
 * Generate TypeScript ABI file
 */
function generateABIFile(contractName, abi) {
  const content = `// Auto-generated ABI for ${contractName}
// Do not edit manually

export const ${contractName}ABI = ${JSON.stringify(abi, null, 2)} as const;

export type ${contractName}ABI = typeof ${contractName}ABI;
`;

  const filePath = path.join(CONTRACTS_DIR, 'abis', `${contractName}.ts`);
  fs.writeFileSync(filePath, content);
  console.log(`✅ Generated ABI: ${filePath}`);
}

/**
 * Generate addresses configuration file for a network
 */
function generateAddressesFile(networkName) {
  const addressesPath = path.join(__dirname, '../deployment', networkName, 'addresses.json');
  
  // Create default addresses structure if deployment file doesn't exist
  const defaultAddresses = CONTRACTS.reduce((acc, contractName) => {
    acc[contractName] = '0x0000000000000000000000000000000000000000'; // Placeholder
    return acc;
  }, {});

  let addresses = defaultAddresses;
  
  if (fs.existsSync(addressesPath)) {
    try {
      addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
    } catch (error) {
      console.warn(`⚠️  Failed to parse addresses for ${networkName}, using defaults`);
    }
  }

  const content = `// Auto-generated addresses for ${NETWORKS[networkName].name}
// Do not edit manually - updated by deployment scripts

export const ${networkName.replace('-', '')}Addresses = ${JSON.stringify(addresses, null, 2)} as const;

export type ContractAddresses = typeof ${networkName.replace('-', '')}Addresses;
`;

  const filePath = path.join(CONTRACTS_DIR, 'addresses', `${networkName}.ts`);
  fs.writeFileSync(filePath, content);
  console.log(`✅ Generated addresses: ${filePath}`);
}

/**
 * Generate main contracts index file
 */
function generateContractsIndex() {
  const abiExports = CONTRACTS.map(name => 
    `export { ${name}ABI } from './abis/${name}';`
  ).join('\n');

  const addressExports = Object.keys(NETWORKS).map(network =>
    `export { ${network.replace('-', '')}Addresses } from './addresses/${network}';`
  ).join('\n');

  const content = `// Auto-generated contracts exports
// Do not edit manually

// Contract ABIs
${abiExports}

// Contract addresses by network
${addressExports}

// Re-export types
export type { ContractAddresses } from './addresses/base-sepolia';
`;

  const filePath = path.join(CONTRACTS_DIR, 'index.ts');
  fs.writeFileSync(filePath, content);
  console.log(`✅ Generated contracts index: ${filePath}`);
}

/**
 * Update shared package main index
 */
function updateSharedIndex() {
  const indexPath = path.join(SHARED_SRC_DIR, 'index.ts');
  
  // Read existing index or create new one
  let existingContent = '';
  if (fs.existsSync(indexPath)) {
    existingContent = fs.readFileSync(indexPath, 'utf8');
  }

  // Add contracts export if not present
  const contractsExport = "export * from './contracts';";
  if (!existingContent.includes(contractsExport)) {
    const content = existingContent ? 
      `${existingContent}\n\n// Contract ABIs and addresses\n${contractsExport}\n` :
      `// Shared package exports\n\n// Contract ABIs and addresses\n${contractsExport}\n`;
    
    fs.writeFileSync(indexPath, content);
    console.log(`✅ Updated shared index: ${indexPath}`);
  }
}

/**
 * Create address update script for deployment
 */
function createAddressUpdater() {
  const content = `#!/usr/bin/env node

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
  console.log(\`✅ Updated \${contractName} address to \${address} on \${network}\`);
  
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
`;

  const filePath = path.join(__dirname, 'update-addresses.js');
  fs.writeFileSync(filePath, content);
  fs.chmodSync(filePath, 0o755);
  console.log(`✅ Created address updater: ${filePath}`);
}

/**
 * Main generation function
 */
function generateABIs() {
  console.log('🏗️  Generating contract ABIs and addresses...\n');

  // Ensure directories exist
  ensureDir(CONTRACTS_DIR);
  ensureDir(path.join(CONTRACTS_DIR, 'abis'));
  ensureDir(path.join(CONTRACTS_DIR, 'addresses'));

  // Generate ABI files
  console.log('📋 Generating ABIs...');
  CONTRACTS.forEach(contractName => {
    const abi = extractABI(contractName);
    if (abi) {
      generateABIFile(contractName, abi);
    }
  });

  // Generate address files
  console.log('\n📍 Generating addresses...');
  Object.keys(NETWORKS).forEach(networkName => {
    generateAddressesFile(networkName);
  });

  // Generate index files
  console.log('\n📦 Generating exports...');
  generateContractsIndex();
  updateSharedIndex();
  
  // Create utility scripts
  console.log('\n🔧 Creating utilities...');
  createAddressUpdater();

  console.log('\n✅ ABI and address generation complete!');
}

// Run if called directly
if (require.main === module) {
  generateABIs();
}

module.exports = { generateABIs };