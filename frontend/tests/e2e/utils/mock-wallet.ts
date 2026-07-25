/**
 * Mock wallet utility for deterministic Playwright testing
 * 
 * This provides a predictable wallet interface that can be used
 * in e2e tests to simulate various wallet states and interactions
 * without relying on real wallet extensions.
 */

import { Page } from '@playwright/test';

export interface MockWalletConfig {
  address: string;
  chainId: number;
  balance: string;
  connected: boolean;
  rejected?: boolean;
  networkSwitchRejected?: boolean;
}

export class MockWallet {
  private page: Page;
  private config: MockWalletConfig;

  constructor(page: Page, config: MockWalletConfig) {
    this.page = page;
    this.config = config;
  }

  /**
   * Inject mock wallet provider into the page
   * This replaces the real wallet provider with our mock
   */
  async inject() {
    await this.page.addInitScript((config: MockWalletConfig) => {
      // Mock ethereum provider
      const mockProvider = {
        isMetaMask: true,
        isConnected: () => config.connected,
        
        request: async ({ method, params }: { method: string; params?: any[] }) => {
          console.log('Mock wallet request:', method, params);
          
          switch (method) {
            case 'eth_requestAccounts':
              if (config.rejected) {
                throw new Error('User rejected connection');
              }
              return config.connected ? [config.address] : [];
              
            case 'eth_accounts':
              return config.connected ? [config.address] : [];
              
            case 'eth_chainId':
              return `0x${config.chainId.toString(16)}`;
              
            case 'net_version':
              return config.chainId.toString();
              
            case 'eth_getBalance':
              return config.balance;
              
            case 'wallet_switchEthereumChain':
              if (config.networkSwitchRejected) {
                throw new Error('User rejected network switch');
              }
              // Simulate successful network switch
              config.chainId = params?.[0]?.chainId ? parseInt(params[0].chainId, 16) : config.chainId;
              return null;
              
            case 'personal_sign':
            case 'eth_signTypedData_v4':
              if (config.rejected) {
                throw new Error('User rejected signing');
              }
              // Return a mock signature
              return '0x' + '0'.repeat(130);
              
            default:
              throw new Error(`Mock wallet: Unsupported method ${method}`);
          }
        },

        on: (event: string, callback: Function) => {
          console.log('Mock wallet listening to event:', event);
          // Store callbacks for later triggering
          if (!(window as any).mockWalletCallbacks) {
            (window as any).mockWalletCallbacks = {};
          }
          (window as any).mockWalletCallbacks[event] = callback;
        },

        removeListener: (event: string, callback: Function) => {
          console.log('Mock wallet removing listener:', event);
        },
      };

      // Replace the ethereum provider
      (window as any).ethereum = mockProvider;
      
      // Also make it available on window for debugging
      (window as any).mockWallet = {
        provider: mockProvider,
        config: config,
        triggerAccountsChanged: (accounts: string[]) => {
          const callback = (window as any).mockWalletCallbacks?.['accountsChanged'];
          if (callback) callback(accounts);
        },
        triggerChainChanged: (chainId: string) => {
          const callback = (window as any).mockWalletCallbacks?.['chainChanged'];
          if (callback) callback(chainId);
        },
        triggerConnect: (connectInfo: { chainId: string }) => {
          const callback = (window as any).mockWalletCallbacks?.['connect'];
          if (callback) callback(connectInfo);
        },
        triggerDisconnect: () => {
          const callback = (window as any).mockWalletCallbacks?.['disconnect'];
          if (callback) callback();
        }
      };
    }, this.config);
  }

  /**
   * Update wallet configuration during test
   */
  async updateConfig(newConfig: Partial<MockWalletConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    await this.page.evaluate((config) => {
      (window as any).mockWallet.config = config;
    }, this.config);
  }

  /**
   * Simulate wallet connection
   */
  async connect() {
    await this.updateConfig({ connected: true });
    await this.triggerAccountsChanged([this.config.address]);
    await this.triggerConnect({ chainId: `0x${this.config.chainId.toString(16)}` });
  }

  /**
   * Simulate wallet disconnection
   */
  async disconnect() {
    await this.updateConfig({ connected: false });
    await this.triggerAccountsChanged([]);
    await this.triggerDisconnect();
  }

  /**
   * Simulate network change
   */
  async switchNetwork(chainId: number) {
    await this.updateConfig({ chainId });
    await this.triggerChainChanged(`0x${chainId.toString(16)}`);
  }

  /**
   * Simulate rejection of connection request
   */
  async rejectConnection() {
    await this.updateConfig({ rejected: true });
  }

  /**
   * Simulate rejection of signing request
   */
  async rejectSigning() {
    await this.updateConfig({ rejected: true });
  }

  /**
   * Accept connection/signing requests
   */
  async acceptRequests() {
    await this.updateConfig({ rejected: false });
  }

  /**
   * Trigger accounts changed event
   */
  private async triggerAccountsChanged(accounts: string[]) {
    await this.page.evaluate((accounts) => {
      (window as any).mockWallet?.triggerAccountsChanged(accounts);
    }, accounts);
  }

  /**
   * Trigger chain changed event
   */
  private async triggerChainChanged(chainId: string) {
    await this.page.evaluate((chainId) => {
      (window as any).mockWallet?.triggerChainChanged(chainId);
    }, chainId);
  }

  /**
   * Trigger connect event
   */
  private async triggerConnect(connectInfo: { chainId: string }) {
    await this.page.evaluate((connectInfo) => {
      (window as any).mockWallet?.triggerConnect(connectInfo);
    }, connectInfo);
  }

  /**
   * Trigger disconnect event
   */
  private async triggerDisconnect() {
    await this.page.evaluate(() => {
      (window as any).mockWallet?.triggerDisconnect();
    });
  }
}

/**
 * Predefined wallet configurations for common test scenarios
 */
export const WALLET_CONFIGS = {
  // Standard connected wallet on Base Sepolia
  CONNECTED_BASE_SEPOLIA: {
    address: '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7',
    chainId: 84532, // Base Sepolia
    balance: '0x1bc16d674ec80000', // 2 ETH
    connected: true,
  },

  // Disconnected wallet
  DISCONNECTED: {
    address: '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7',
    chainId: 84532,
    balance: '0x1bc16d674ec80000',
    connected: false,
  },

  // Connected to wrong network (Ethereum mainnet)
  WRONG_NETWORK: {
    address: '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7',
    chainId: 1, // Ethereum mainnet
    balance: '0x1bc16d674ec80000',
    connected: true,
  },

  // Wallet that rejects connections
  REJECTS_CONNECTION: {
    address: '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7',
    chainId: 84532,
    balance: '0x1bc16d674ec80000',
    connected: false,
    rejected: true,
  },

  // Wallet that rejects signing
  REJECTS_SIGNING: {
    address: '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7',
    chainId: 84532,
    balance: '0x1bc16d674ec80000',
    connected: true,
    rejected: true,
  },

  // Wallet that rejects network switching
  REJECTS_NETWORK_SWITCH: {
    address: '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7',
    chainId: 1,
    balance: '0x1bc16d674ec80000',
    connected: true,
    networkSwitchRejected: true,
  },
} as const;