/**
 * Playwright Test Fixtures
 * 
 * This file contains reusable test fixtures that set up common
 * test scenarios and provide initialized page objects.
 */

import { test as base, Page } from '@playwright/test';
import { MockWallet, MockWalletConfig, WALLET_CONFIGS } from './mock-wallet';
import { 
  HomePage, 
  AuthPage, 
  DashboardPage, 
  SavingsPage, 
  NavigationMenu,
  NetworkGuard 
} from './page-objects';

// Define fixture types
type TestFixtures = {
  mockWallet: MockWallet;
  homePage: HomePage;
  authPage: AuthPage;
  dashboardPage: DashboardPage;
  savingsPage: SavingsPage;
  navigationMenu: NavigationMenu;
  networkGuard: NetworkGuard;
};

type WorkerFixtures = {
  // Add any worker-scoped fixtures here if needed
};

/**
 * Extend base Playwright test with our custom fixtures
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Mock wallet fixture - sets up a connected wallet by default
  mockWallet: async ({ page }, use, testInfo) => {
    const mockWallet = new MockWallet(page, WALLET_CONFIGS.CONNECTED_BASE_SEPOLIA);
    await mockWallet.inject();
    await use(mockWallet);
  },

  // Page object fixtures
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  savingsPage: async ({ page }, use) => {
    await use(new SavingsPage(page));
  },

  navigationMenu: async ({ page }, use) => {
    await use(new NavigationMenu(page));
  },

  networkGuard: async ({ page }, use) => {
    await use(new NetworkGuard(page));
  },
});

/**
 * Test configuration helpers
 */
export const TEST_USERS = {
  STANDARD_USER: {
    address: '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7',
    privateKey: 'test-private-key', // This would be a test key in real implementation
    expectedRole: 'user',
  },
  ADMIN_USER: {
    address: '0x123456789012345678901234567890123456789A',
    privateKey: 'test-admin-private-key',
    expectedRole: 'admin',
  },
} as const;

/**
 * Common test timeouts
 */
export const TIMEOUTS = {
  WALLET_CONNECTION: 10000,
  TRANSACTION_CONFIRMATION: 30000,
  PAGE_LOAD: 15000,
  API_RESPONSE: 10000,
  REDIRECT: 10000,
} as const;

/**
 * Test data generators
 */
export const TEST_DATA = {
  transactions: {
    deposit: {
      amount: '0.1',
      expectedGasFee: '~0.001 ETH',
    },
    withdraw: {
      amount: '0.05',
      expectedGasFee: '~0.001 ETH',
    },
  },
  goals: {
    emergencyFund: {
      name: 'Emergency Fund',
      target: '1000',
      description: '6 months of expenses',
    },
    vacation: {
      name: 'Vacation Fund',
      target: '2500',
      description: 'Trip to Europe',
    },
  },
} as const;

/**
 * Helper function to create a test with a specific wallet configuration
 */
export function testWithWallet(
  title: string,
  walletConfig: MockWalletConfig,
  testFn: (fixtures: TestFixtures & { page: Page }) => Promise<void>
) {
  return test(title, async ({ page, ...fixtures }) => {
    // Override the default wallet with the specified config
    const customMockWallet = new MockWallet(page, walletConfig);
    await customMockWallet.inject();
    
    await testFn({
      ...fixtures,
      mockWallet: customMockWallet,
      page,
    });
  });
}

/**
 * Helper to set up an authenticated user session
 */
export async function setupAuthenticatedUser(
  page: Page, 
  mockWallet: MockWallet,
  authPage: AuthPage
) {
  // Navigate to auth page
  await authPage.navigate();
  
  // Ensure wallet is connected
  await mockWallet.connect();
  
  // Complete SIWE flow
  await authPage.verifyStep2Visible();
  await authPage.clickSignIn();
  
  // Wait for authentication to complete
  await authPage.waitForRedirect();
}

/**
 * Helper to clear browser storage and reset state
 */
export async function resetBrowserState(page: Page) {
  await page.evaluate(() => {
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
  });
  
  // Reload to ensure clean state
  await page.reload();
}

export { expect } from '@playwright/test';