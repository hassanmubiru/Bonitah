import { Page, BrowserContext } from '@playwright/test';

/**
 * Mock wallet utility for deterministic E2E testing
 * 
 * Provides consistent wallet behavior for Playwright tests
 */
export class MockWallet {
  constructor(
    private page: Page,
    private _context: BrowserContext
  ) {}

  /**
   * Mock wallet connection
   */
  async mockConnection(address: string, chainId: number = 84532) {
    await this.page.addInitScript(
      ({ address, chainId }) => {
        // Mock ethereum provider
        (window as any).ethereum = {
          isMetaMask: true,
          request: async ({ method, params }: any) => {
            switch (method) {
              case 'eth_requestAccounts':
                return [address];
              case 'eth_accounts':
                return [address];
              case 'eth_chainId':
                return `0x${chainId.toString(16)}`;
              case 'wallet_switchEthereumChain':
                return null;
              case 'personal_sign':
                // Mock signature - this will be overridden per test
                return '0x123...mock-signature';
              default:
                throw new Error(`Unsupported method: ${method}`);
            }
          },
          on: () => {},
          removeListener: () => {},
        };

        // Mock wagmi detection
        (window as any).dispatchEvent(new Event('ethereum#initialized'));
      },
      { address, chainId }
    );
  }

  /**
   * Mock message signing
   */
  async mockSignature(message: string) {
    await this.page.addInitScript(
      (message) => {
        const originalRequest = (window as any).ethereum.request;
        (window as any).ethereum.request = async ({ method, params }: any) => {
          if (method === 'personal_sign') {
            // Simulate signing delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            return '0xmocked_signature_for_' + btoa(message).substring(0, 32);
          }
          return originalRequest({ method, params });
        };
      },
      message
    );
  }

  /**
   * Mock signature rejection
   */
  async mockSignatureRejection() {
    await this.page.addInitScript(() => {
      const originalRequest = (window as any).ethereum.request;
      (window as any).ethereum.request = async ({ method, params }: any) => {
        if (method === 'personal_sign') {
          throw new Error('User rejected the request.');
        }
        return originalRequest({ method, params });
      };
    });
  }

  /**
   * Mock network switch
   */
  async mockNetworkSwitch(newChainId: number) {
    await this.page.addInitScript(
      (newChainId) => {
        const originalRequest = (window as any).ethereum.request;
        (window as any).ethereum.request = async ({ method, params }: any) => {
          if (method === 'wallet_switchEthereumChain') {
            // Update chainId after switch
            setTimeout(() => {
              (window as any).ethereum.request = async ({ method: m, params: p }: any) => {
                if (m === 'eth_chainId') {
                  return `0x${newChainId.toString(16)}`;
                }
                return originalRequest({ method: m, params: p });
              };
            }, 100);
            return null;
          }
          return originalRequest({ method, params });
        };
      },
      newChainId
    );
  }

  /**
   * Mock transaction sending
   */
  async mockTransaction(txHash: string = '0xmocked_tx_hash') {
    await this.page.addInitScript(
      (txHash) => {
        const originalRequest = (window as any).ethereum.request;
        (window as any).ethereum.request = async ({ method, params }: any) => {
          if (method === 'eth_sendTransaction') {
            // Simulate transaction delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            return txHash;
          }
          return originalRequest({ method, params });
        };
      },
      txHash
    );
  }

  /**
   * Mock transaction receipt
   */
  async mockTransactionReceipt(txHash: string, success: boolean = true) {
    await this.page.addInitScript(
      ({ txHash, success }) => {
        const originalRequest = (window as any).ethereum.request;
        (window as any).ethereum.request = async ({ method, params }: any) => {
          if (method === 'eth_getTransactionReceipt' && params[0] === txHash) {
            return {
              transactionHash: txHash,
              blockNumber: '0x123456',
              gasUsed: '0x5208',
              status: success ? '0x1' : '0x0',
            };
          }
          return originalRequest({ method, params });
        };
      },
      { txHash, success }
    );
  }

  /**
   * Mock contract read calls
   */
  async mockContractRead(address: string, data: any) {
    await this.page.addInitScript(
      ({ address, data }) => {
        const originalRequest = (window as any).ethereum.request;
        (window as any).ethereum.request = async ({ method, params }: any) => {
          if (method === 'eth_call' && params[0].to.toLowerCase() === address.toLowerCase()) {
            return data;
          }
          return originalRequest({ method, params });
        };
      },
      { address, data }
    );
  }

  /**
   * Set test ETH balance
   */
  async setBalance(address: string, balance: string = '10000000000000000000') {
    await this.page.addInitScript(
      ({ address, balance }) => {
        const originalRequest = (window as any).ethereum.request;
        (window as any).ethereum.request = async ({ method, params }: any) => {
          if (method === 'eth_getBalance' && params[0].toLowerCase() === address.toLowerCase()) {
            return `0x${BigInt(balance).toString(16)}`;
          }
          return originalRequest({ method, params });
        };
      },
      { address, balance }
    );
  }
}