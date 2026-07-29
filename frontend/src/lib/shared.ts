import { type Abi } from 'viem';

// Re-exports from copied shared package
export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const NETWORKS = {
  baseSepolia: {
    id: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  },
};

// Contract addresses
const contractAddresses: Record<number, Record<string, string>> = {
  84532: {
    Registry: '0xBd81a62b21eaE93D74daB2B2D93e040D51f75db1',
    SavingsVault: '0x16E88B4a717B082f8d29C4EeA0796F488C0da7B6',
    CommunityTreasury: '0xa0D284d9080cb7F6676e62116E0A659BB4Ed9b04',
    Education: '0x5A63Da81A04BE39d5469B8BD9281CbD3332b51ac',
    Governance: '0x13B14D148E3369dCC448006494810A95928eEEB4',
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
};

export function getContractAddress(contractName: string, chainId = BASE_SEPOLIA_CHAIN_ID): `0x${string}` {
  return (contractAddresses[chainId]?.[contractName] || '0x0') as `0x${string}`;
}

export function getContractAbi(contractName: string): Abi {
  // Simplified ABIs - in a real deployment these would be the full ABIs
  const abis: Record<string, Abi> = {
    Registry: [
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getProfile',
        outputs: [{ name: '', type: 'tuple', components: [
          { name: 'registered', type: 'bool' },
          { name: 'verified', type: 'bool' },
          { name: 'reputationScore', type: 'uint256' },
          { name: 'ipfsProfileHash', type: 'string' },
          { name: 'registeredAt', type: 'uint256' }
        ]}],
        stateMutability: 'view',
        type: 'function'
      },
      {
        inputs: [{ name: 'ipfsProfileHash', type: 'string' }],
        name: 'updateProfile',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
      },
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'isRegistered',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function'
      },
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'reputationOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
      },
      {
        inputs: [],
        name: 'register',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
      }
    ],
    SavingsVault: [
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
      }
    ],
    Education: [
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getCertificates',
        outputs: [{ name: '', type: 'uint256[]' }],
        stateMutability: 'view',
        type: 'function'
      }
    ]
  };
  return abis[contractName] || [];
}

// Types
export interface PortfolioSeriesResponse {
  success: boolean;
  data?: {
    series: Array<{
      date: string;
      value: number;
    }>;
  };
  error?: string;
}

export interface TransactionsResponse {
  success: boolean;
  data?: {
    transactions: Array<{
      id: string;
      type: string;
      amount: string;
      timestamp: string;
      status: string;
    }>;
  };
  error?: string;
}