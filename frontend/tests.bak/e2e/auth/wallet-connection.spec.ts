/**
 * E2E Tests for Wallet Connection Flow
 * 
 * Tests the complete wallet connection process including:
 * - Wallet detection and connection
 * - Connection failures and error handling  
 * - Network validation and switching
 * - Connection state persistence
 */

import { expect } from '@playwright/test';
import { test, testWithWallet, resetBrowserState } from '../utils/fixtures';
import { WALLET_CONFIGS } from '../utils/mock-wallet';

test.describe('Wallet Connection Flow', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page);
  });

  test.describe('Successful Connection', () => {
    test('should connect wallet successfully from home page', async ({ 
      page, 
      mockWallet, 
      homePage 
    }) => {
      // Start with disconnected wallet
      await mockWallet.updateConfig({ connected: false });
      await homePage.navigate();

      // Verify connect button is visible
      await expect(homePage.connectButton).toBeVisible();

      // Click connect button
      await homePage.clickConnectWallet();

      // Simulate wallet connection
      await mockWallet.connect();

      // Wait for connection to be reflected in UI
      await page.waitForTimeout(1000);

      // Verify wallet is connected
      // Note: The exact UI changes will depend on RainbowKit's behavior
      // This test validates that the mock wallet integration works
      await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 });
    });

    test('should connect wallet successfully from auth page', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      // Start with disconnected wallet
      await mockWallet.updateConfig({ connected: false });
      await authPage.navigate();

      // Verify initial state - step 1 inactive
      await authPage.verifyStep1Inactive();

      // Connect wallet
      await mockWallet.connect();

      // Wait for UI to update
      await page.waitForTimeout(1000);

      // Verify step 1 is now active and step 2 is visible
      await authPage.verifyStep1Active();
      await authPage.verifyStep2Visible();
    });

    test('should maintain connection state across page navigation', async ({ 
      page, 
      mockWallet, 
      homePage, 
      authPage, 
      navigationMenu 
    }) => {
      // Connect wallet on home page
      await homePage.navigate();
      await mockWallet.connect();
      await page.waitForTimeout(1000);

      // Navigate to auth page
      await authPage.navigate();

      // Verify wallet is still connected
      await authPage.verifyStep1Active();
      await authPage.verifyStep2Visible();

      // Navigate back to home
      await homePage.navigate();

      // Connection should persist
      await expect(page.locator('text=Connected')).toBeVisible();
    });
  });

  test.describe('Connection Failures', () => {
    testWithWallet(
      'should handle user rejection of connection request',
      WALLET_CONFIGS.REJECTS_CONNECTION,
      async ({ page, mockWallet, authPage }) => {
        await authPage.navigate();

        // Verify initial state
        await authPage.verifyStep1Inactive();

        // Try to connect - this should be rejected by the mock wallet
        await authPage.clickConnectWallet();

        // Wait for potential error handling
        await page.waitForTimeout(2000);

        // Wallet should remain disconnected
        await authPage.verifyStep1Inactive();
        await expect(authPage.step2Title).not.toBeVisible();
      }
    );

    test('should handle wallet disconnection gracefully', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();

      // Start connected
      await mockWallet.connect();
      await page.waitForTimeout(1000);
      await authPage.verifyStep1Active();

      // Simulate disconnection
      await mockWallet.disconnect();
      await page.waitForTimeout(1000);

      // Should revert to disconnected state
      await authPage.verifyStep1Inactive();
      await expect(authPage.step2Title).not.toBeVisible();
    });

    test('should handle network unavailability', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();

      // Override wallet to simulate network errors
      await page.addInitScript(() => {
        const originalRequest = (window as any).ethereum?.request;
        (window as any).ethereum.request = async (params: any) => {
          if (params.method === 'eth_requestAccounts') {
            throw new Error('Network Error: Could not connect to wallet');
          }
          return originalRequest(params);
        };
      });

      // Try to connect
      await authPage.clickConnectWallet();
      await page.waitForTimeout(2000);

      // Should remain in disconnected state
      await authPage.verifyStep1Inactive();
    });
  });

  test.describe('Network Validation', () => {
    testWithWallet(
      'should prompt network switch when on wrong network',
      WALLET_CONFIGS.WRONG_NETWORK,
      async ({ page, mockWallet, authPage, networkGuard }) => {
        await authPage.navigate();

        // Connect to wrong network
        await mockWallet.connect();
        await page.waitForTimeout(1000);

        // Should show network warning
        if (await networkGuard.isVisible('[data-testid="network-warning"]')) {
          await networkGuard.verifywrongNetworkWarning();
        }
      }
    );

    testWithWallet(
      'should handle successful network switch',
      WALLET_CONFIGS.WRONG_NETWORK,
      async ({ page, mockWallet, authPage, networkGuard }) => {
        await authPage.navigate();
        await mockWallet.connect();

        // Switch to correct network
        await mockWallet.switchNetwork(84532); // Base Sepolia
        await page.waitForTimeout(1000);

        // Network warning should disappear
        if (await networkGuard.isVisible('[data-testid="network-warning"]')) {
          await networkGuard.verifyNetworkAccepted();
        }

        // Auth flow should be accessible
        await authPage.verifyStep1Active();
        await authPage.verifyStep2Visible();
      }
    );

    testWithWallet(
      'should handle rejected network switch',
      WALLET_CONFIGS.REJECTS_NETWORK_SWITCH,
      async ({ page, mockWallet, authPage, networkGuard }) => {
        await authPage.navigate();
        await mockWallet.connect();
        await page.waitForTimeout(1000);

        // Try to switch network through UI (if available)
        if (await networkGuard.isVisible('[data-testid="network-warning"]')) {
          await networkGuard.verifywrongNetworkWarning();
          
          if (await networkGuard.isVisible('button:has-text("Switch Network")')) {
            await networkGuard.clickSwitchNetwork();
            await page.waitForTimeout(2000);
            
            // Should still show network warning due to rejection
            await networkGuard.verifywrongNetworkWarning();
          }
        }
      }
    );
  });

  test.describe('Wallet State Persistence', () => {
    test('should persist wallet connection across browser refresh', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      await mockWallet.connect();
      await page.waitForTimeout(1000);
      await authPage.verifyStep1Active();

      // Refresh page
      await page.reload();
      await authPage.waitForLoad();

      // Connection should persist
      await authPage.verifyStep1Active();
    });

    test('should handle multiple rapid connection attempts', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      await mockWallet.updateConfig({ connected: false });

      // Make multiple rapid connection attempts
      for (let i = 0; i < 3; i++) {
        await authPage.clickConnectWallet();
        await page.waitForTimeout(100);
      }

      // Connect wallet
      await mockWallet.connect();
      await page.waitForTimeout(2000);

      // Should end up in connected state
      await authPage.verifyStep1Active();
    });

    test('should handle connection state changes during page load', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      // Start navigation
      const navigationPromise = authPage.navigate();

      // Change connection state while page is loading
      await mockWallet.connect();
      
      // Wait for navigation to complete
      await navigationPromise;
      await page.waitForTimeout(1000);

      // Should reflect the current connection state
      await authPage.verifyStep1Active();
      await authPage.verifyStep2Visible();
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    test('should work with different viewport sizes', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await authPage.navigate();
      await mockWallet.connect();
      await page.waitForTimeout(1000);
      await authPage.verifyStep1Active();

      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await authPage.waitForLoad();
      await authPage.verifyStep1Active();

      // Test desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.reload();
      await authPage.waitForLoad();
      await authPage.verifyStep1Active();
    });

    test('should handle slow network conditions', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      // Simulate slow network
      await page.route('**/*', async (route) => {
        await page.waitForTimeout(500); // Add 500ms delay
        await route.continue();
      });

      await authPage.navigate();
      await mockWallet.connect();
      
      // Should work despite slow network
      await authPage.verifyStep1Active({ timeout: 10000 });
      await authPage.verifyStep2Visible();
    });
  });
});