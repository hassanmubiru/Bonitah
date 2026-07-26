# Real Assets Integration Guide

## Overview

Bonitah Financial Network (BFN) operates with **REAL financial assets and smart contracts** - there are no mock tokens, placeholder data, or simulated values anywhere in the production system.

## Real Asset Details

### Token Integration

- **Token**: Circle's official USDC on Base Sepolia
- **Contract Address**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Decimals**: 6 (standard USDC format)
- **Issuer**: Circle (official USDC issuer)
- **Network**: Base Sepolia (Chain ID: 84532)

### Data Sources

- **All financial balances**: Read directly from deployed smart contracts
- **No cached financial state**: Values always come from blockchain
- **No placeholder values**: Loading states never show `$0`, `0.00`, or similar placeholders
- **Real transaction signing**: All state changes require wallet signature

### Smart Contract Integration

All BFN contracts are deployed on Base Sepolia and integrated with real USDC:

```typescript
// Real deployed addresses (Base Sepolia)
const CONTRACTS = {
  Registry: '0xc37319a9ca70aa581b96b96ddb79eb19c2b391c5',
  SavingsVault: '0x75517c778c77628a5c0d4bba7398520da8849eb0',
  CommunityTreasury: '0x07e19c706cf7e77afd215a6fef136b3b8a62eebe',
  Education: '0x0806ebcbd047a9a264027c2a31693ff26a69b3ff',
  Governance: '0xab48386f4306b1e356d02456e9ecf6e74cafa76b',
};

// Real USDC token
const USDC_TOKEN = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
```

## What Makes This "Real"

### ✅ Real Financial Operations

1. **Deposits**: Transfer real USDC from user wallet to SavingsVault contract
2. **Withdrawals**: Transfer real USDC from contract back to user wallet
3. **Goals**: Lock real USDC in time-based goal contracts
4. **Community Pools**: Pool real USDC with other users in transparent contracts
5. **Governance**: Use real on-chain reputation to vote on proposals

### ✅ Real Blockchain Interactions

1. **Wallet Connection**: RainbowKit connects to real Base Sepolia network
2. **Transaction Signing**: All state changes require MetaMask/wallet signature
3. **Gas Fees**: Real ETH required for Base Sepolia gas fees
4. **Event Indexing**: Backend indexes real emitted contract events
5. **Data Provenance**: All cached data tagged with block number and contract source

### ✅ Real Security Model

1. **Access Control**: OpenZeppelin AccessControl with real role assignments
2. **Reentrancy Protection**: Real ReentrancyGuard on value-transferring functions
3. **Upgradeable Proxies**: UUPS proxies for contract upgradeability
4. **SIWE Authentication**: Real Sign-In With Ethereum wallet authentication

## How to Get Started

### 1. Acquire Base Sepolia ETH

You need Base Sepolia ETH for gas fees:

- **Faucet**: https://faucet.quicknode.com/base/sepolia
- **Bridge**: Use official Base bridge to transfer ETH to Base Sepolia

### 2. Get Base Sepolia USDC

The real USDC token on Base Sepolia:

- **Contract**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Faucets**: Some DeFi test faucets provide Base Sepolia USDC
- **DEX**: Use testnet DEXes to swap ETH for USDC on Base Sepolia

### 3. Connect to BFN

1. Set your wallet to Base Sepolia network (Chain ID: 84532)
2. Connect through RainbowKit on the BFN frontend
3. Sign SIWE message for authentication
4. Start depositing real USDC into savings vaults!

## Key Differences from Traditional TestNets

### What's Real

- ✅ Smart contract state and logic
- ✅ Token transfers and balances
- ✅ Wallet signatures and authentication
- ✅ Gas fees and transaction costs
- ✅ Event emissions and blockchain data

### What's Test Environment

- ⚠️ Base Sepolia is a testnet (not mainnet)
- ⚠️ USDC has no real-world dollar backing on testnet
- ⚠️ Testnet ETH has no real-world value
- ⚠️ Data may be reset if testnet is upgraded

## Verification Steps

You can verify the real nature of BFN integration:

### 1. Check Contract Code

```bash
# View the real USDC contract on Base Sepolia
open https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e

# View BFN deployed contracts
open https://sepolia.basescan.org/address/0x75517c778c77628a5c0d4bba7398520da8849eb0
```

### 2. Verify Transactions

All BFN operations create real blockchain transactions:

```bash
# Example real deposit transaction
open https://sepolia.basescan.org/tx/0x[transaction-hash]
```

### 3. Check Token Balances

Use standard tools to verify real token balances:

```bash
# Using cast (from Foundry)
cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "balanceOf(address)" [your-address] \
  --rpc-url https://sepolia.base.org
```

## Developer Guidelines

### For Frontend Development

- Never hardcode financial values in components
- Always read balances from smart contracts via viem/wagmi
- Show loading states without financial placeholders
- Handle read failures with error states, never substituted values

### For Backend Development

- Cache financial data with full provenance (contract address, block number)
- Expire cached financial data after 30 seconds
- Never store financial balances as authoritative data
- Only cache for performance, never as source of truth

### For Contract Development

- Use real USDC address `0x036CbD53842c5426634e7929541eC2318f3dCF7e` in initializers
- Test against real USDC contract behavior
- Validate all token transfers occur on-chain
- Emit events for all state changes for real indexing

## Troubleshooting Real Integration

### Common Issues

**Q: "I don't see my USDC balance"**
A: Ensure you have USDC on Base Sepolia at `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

**Q: "Transactions are failing"**
A: Check you have Base Sepolia ETH for gas and your wallet is on Chain ID 84532

**Q: "Data isn't loading"**
A: Verify Base Sepolia RPC is accessible and contracts are deployed at expected addresses

**Q: "Getting 'placeholder value' errors in tests"**
A: BFN explicitly prevents showing placeholder financial values - this is by design for user trust

## Migration from Mock Systems

If migrating from a system using mock tokens or placeholder data:

### ✅ Remove Mock References

- Delete or deprecate MockERC20 contracts
- Remove hardcoded financial values from components
- Replace test token addresses with real USDC address
- Update deployment scripts to use real token

### ✅ Update Integration Points

- Frontend: Use real contract addresses in shared/addresses.ts
- Backend: Update cached data to reference real contracts
- Tests: Mock at the hook/service level, not token level

### ✅ Verify Real Behavior

- Test actual USDC transfers on Base Sepolia
- Verify real wallet connection and signing
- Confirm real event emission and indexing

## Security Considerations

Since BFN uses real smart contracts and tokens:

1. **Private Key Security**: Never commit private keys, use environment variables
2. **Contract Upgrades**: UUPS proxy upgrades require multisig control
3. **Role Management**: AccessControl roles should be managed by governance
4. **Financial Limits**: Consider implementing daily/weekly deposit limits
5. **Emergency Controls**: Pausable contracts for emergency stops

## Conclusion

BFN's integration with real USDC and Base Sepolia provides users with authentic DeFi experiences while maintaining testnet safety. This approach builds user trust through transparency while enabling real-world testing of financial workflows.

The "realness" of the integration means every action users take has genuine on-chain consequences, making BFN a true production environment for decentralized finance education and community building.
