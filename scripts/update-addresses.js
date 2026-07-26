#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Update contract addresses after deployment
 * Usage: 
 * - Single contract: node update-addresses.js <network> <contract> <address>
 * - Full deployment: node update-addresses.js <chainId> <registry> <vault> <treasury> <education> <governance> <token> <block>
 * Example: node update-addresses.js base-sepolia SavingsVault 0x123...
 * Example: node update-addresses.js 84532 0x123... 0x456... 0x789... 0xabc... 0xdef... 0x111... 12345
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
  
  // Note: generate-abis.js not found, skipping ABI generation
  console.log('📝 Consider running ABI generation if needed');
}

function updateFullDeployment(chainId, registryAddr, vaultAddr, treasuryAddr, educationAddr, governanceAddr, tokenAddr, blockNumber) {
  const network = chainId === '84532' ? 'base-sepolia' : `chain-${chainId}`;
  const deploymentPath = path.join(__dirname, '../deployment', `${network}.json`);
  const sharedAddressPath = path.join(__dirname, '../shared/src/addresses.ts');
  
  // Create deployment record
  const deployment = {
    chainId: parseInt(chainId),
    network: chainId === '84532' ? 'Base Sepolia' : `Chain ${chainId}`,
    deployedAt: {
      block: parseInt(blockNumber),
      timestamp: Math.floor(Date.now() / 1000)
    },
    contracts: {
      Registry: {
        proxy: registryAddr,
        implementation: "recorded separately"
      },
      SavingsVault: {
        proxy: vaultAddr,
        implementation: "recorded separately"
      },
      CommunityTreasury: {
        proxy: treasuryAddr,
        implementation: "recorded separately"
      },
      Education: {
        proxy: educationAddr,
        implementation: "recorded separately"
      },
      Governance: {
        proxy: governanceAddr,
        implementation: "recorded separately"
      }
    },
    token: tokenAddr
  };
  
  // Ensure deployment directory exists
  const deploymentDir = path.dirname(deploymentPath);
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  
  // Write deployment record
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`✅ Recorded deployment to ${deploymentPath}`);
  
  // Read existing shared addresses file to preserve the structure
  let addressesContent;
  try {
    addressesContent = fs.readFileSync(sharedAddressPath, 'utf8');
    
    // Update the DEPLOYMENTS section for BASE_SEPOLIA_CHAIN_ID
    const chainIdNum = parseInt(chainId);
    const updatedContent = addressesContent.replace(
      /(\[BASE_SEPOLIA_CHAIN_ID\]: \{[\s\S]*?contracts: \{[\s\S]*?\}),[\s\S]*?(token: )[^,\n]+,[\s\S]*?(deployedAtBlock: )[^,\n]+,/,
      `$1
    contracts: {
      Registry: '${registryAddr}',
      SavingsVault: '${vaultAddr}',
      CommunityTreasury: '${treasuryAddr}',
      Education: '${educationAddr}',
      Governance: '${governanceAddr}',
    },
    $2'${tokenAddr}',
    $3${blockNumber}n,`
    );
    
    fs.writeFileSync(sharedAddressPath, updatedContent);
    console.log(`✅ Updated shared package addresses at ${sharedAddressPath}`);
  } catch (error) {
    console.error(`❌ Failed to update shared addresses: ${error.message}`);
    console.log('Please manually update shared/src/addresses.ts with the following addresses:');
    console.log(`Registry: ${registryAddr}`);
    console.log(`SavingsVault: ${vaultAddr}`);
    console.log(`CommunityTreasury: ${treasuryAddr}`);
    console.log(`Education: ${educationAddr}`);
    console.log(`Governance: ${governanceAddr}`);
    console.log(`Token: ${tokenAddr}`);
    console.log(`Block: ${blockNumber}`);
  }
  
  // Note: generate-abis.js not found, skipping ABI generation
  console.log('📝 Consider running ABI generation if needed');
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 3) {
    // Single contract update
    const [network, contractName, address] = args;
    updateAddress(network, contractName, address);
  } else if (args.length === 8) {
    // Full deployment update
    const [chainId, registryAddr, vaultAddr, treasuryAddr, educationAddr, governanceAddr, tokenAddr, blockNumber] = args;
    updateFullDeployment(chainId, registryAddr, vaultAddr, treasuryAddr, educationAddr, governanceAddr, tokenAddr, blockNumber);
  } else {
    console.error('Usage:');
    console.error('  Single: node update-addresses.js <network> <contract> <address>');
    console.error('  Full:   node update-addresses.js <chainId> <registry> <vault> <treasury> <education> <governance> <token> <block>');
    process.exit(1);
  }
}

module.exports = { updateAddress, updateFullDeployment };
