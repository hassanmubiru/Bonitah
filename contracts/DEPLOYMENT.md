# BFN Base Sepolia Deployment Guide

This guide covers deploying the Bonitah Financial Network contracts to Base Sepolia testnet.

## Task 9.1 Implementation

This implementation fulfills Task 9.1 requirements:
- ✅ Deploy all five contracts (Registry, SavingsVault, CommunityTreasury, Education, Governance)
- ✅ Deploy behind UUPS proxies for upgradeability
- ✅ Wire cross-contract dependencies and role assignments
- ✅ Record deployed addresses to `deployment/base-sepolia.json`
- ✅ Export addresses to `shared/` package for frontend/backend use
- ✅ All-or-nothing deployment with specific error reporting
- ✅ Non-zero exit code on any contract deployment failure

## Prerequisites

1. **Foundry installed**: https://getfoundry.sh/
2. **Node.js >= 20** for address update scripts
3. **Base Sepolia ETH** for deployment gas costs
4. **Environment variables** configured

## Environment Setup

1. Copy the environment template:
```bash
cp contracts/.env.example contracts/.env
```

2. Fill in the required values:
```bash
# Required: Deployer private key (with ETH for gas)
PRIVATE_KEY=0x1234567890abcdef...

# Required: Base Sepolia RPC URL
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Optional: Basescan API Key for contract verification
BASESCAN_API_KEY=your_api_key_here
```

## Deployment Process

### Option 1: Full Deployment (Recommended)

Use the comprehensive deployment script that includes all validation and setup:

```bash
# Run the full deployment pipeline
./scripts/deploy-base-sepolia.sh
```

This script will:
1. Check prerequisites and environment
2. Compile contracts and run tests
3. Deploy all contracts with UUPS proxies
4. Configure cross-contract roles
5. Record addresses to `deployment/base-sepolia.json`
6. Update `shared/src/addresses.ts` 
7. Build the shared package

### Option 2: Foundry Script Only

If you want to run just the Foundry deployment script:

```bash
cd contracts

# Deploy contracts
forge script script/DeployBaseSepolia.s.sol:DeployBaseSepolia \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# Then manually update shared addresses
cd ..
node scripts/update-addresses.js <args_from_deployment_output>
```

### Command Line Options

The deployment script supports several options:

```bash
# Skip running tests before deployment
./scripts/deploy-base-sepolia.sh --skip-tests

# Show help
./scripts/deploy-base-sepolia.sh --help
```

## Deployment Outputs

After successful deployment, you'll find:

### 1. Deployment Record (`deployment/base-sepolia.json`)
```json
{
  "chainId": 84532,
  "network": "Base Sepolia", 
  "deployedAt": {
    "block": 12345678,
    "timestamp": 1234567890
  },
  "deployer": "0x...",
  "contracts": {
    "Registry": {
      "proxy": "0x...",
      "implementation": "0x..."
    },
    // ... other contracts
  },
  "token": "0x..."
}
```

### 2. Updated Shared Package (`shared/src/addresses.ts`)
Contract addresses will be updated from zero addresses to deployed proxy addresses.

### 3. Built Shared Package (`shared/dist/`)
The shared package will be compiled with the new addresses for import by frontend/backend.

## Deployed Contracts

The deployment creates the following contracts on Base Sepolia:

| Contract | Purpose | UUPS Proxy | Roles Configured |
|----------|---------|------------|------------------|
| **Registry** | User profiles, verification, reputation | ✅ | VERIFIER_ROLE → deployer<br>REPUTATION_ROLE → Education |
| **SavingsVault** | Savings goals and time-locked deposits | ✅ | Admin roles → deployer |
| **CommunityTreasury** | Savings circles and shared pools | ✅ | Admin roles → deployer |
| **Education** | Certificates and learning credentials | ✅ | ISSUER_ROLE → deployer |
| **Governance** | Reputation-weighted voting | ✅ | Admin roles → deployer |
| **MockERC20** | Test token (bUSD) | ❌ | Token contract |

## Role Management

Initial roles are granted to the deployer address:
- `DEFAULT_ADMIN_ROLE`: Can grant/revoke other roles
- `UPGRADER_ROLE`: Can upgrade contract implementations  
- `VERIFIER_ROLE`: Can verify users (Registry)
- `ISSUER_ROLE`: Can issue certificates (Education)

Cross-contract roles:
- Education contract gets `REPUTATION_ROLE` on Registry

**Post-deployment**: Transfer roles to appropriate service accounts and multisigs for production use.

## Error Handling

The deployment implements all-or-nothing semantics:
- Any contract deployment failure stops the entire process
- No partial deployments are recorded
- Specific failed contract is identified in error messages
- Script exits with non-zero code on any failure

Common failure scenarios:
- Insufficient gas/ETH for deployment
- Invalid environment configuration
- RPC connection issues
- Contract compilation errors

## Verification

Contracts are automatically verified on Basescan if `BASESCAN_API_KEY` is provided.

Manual verification:
```bash
# Example for Registry
forge verify-contract <proxy_address> \
  --chain-id 84532 \
  --etherscan-api-key $BASESCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor()" ) \
  src/Registry.sol:Registry
```

## Integration

After deployment, the frontend and backend can import addresses:

```typescript
// Frontend/Backend
import { getContractAddress, BASE_SEPOLIA_CHAIN_ID } from '@bonitah/shared';

const registryAddress = getContractAddress(BASE_SEPOLIA_CHAIN_ID, 'Registry');
```

## Troubleshooting

### "Chain validation failed"
Ensure you're connected to Base Sepolia (chain ID 84532).

### "Insufficient gas"
Increase gas limit or ensure deployer has enough ETH.

### "Role configuration failed"  
Check that contracts deployed successfully before role setup.

### "Address update failed"
Ensure Node.js is installed and deployment JSON exists.

For more help, check the deployment logs and ensure all prerequisites are met.