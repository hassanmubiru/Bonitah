/**
 * E2E Tests for Wallet Rejections and Error Handling
 * 
 * Tests wallet-specific error scenarios:
 * - User rejection of connection requests
 * - User rejection of transaction signing
 * - Wallet disconnection during operations
 * - Network switching rejections
 */

import { expect } from '@playwright/test';
import { test, testWithWallet, setupAuthenticatedUser, resetBrowserState, TIMEOUTS } from '../utils/fixtures';
import { WALLET_CONFIGS } from '../utils/mock-wallet';

test.describe('Wallet Rejections and Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page);
  });

  test.describe('Connection Rejections', () => {
    testWithWallet(
      'should handle user rejection of connection request gracefully',
      WALLET_CONFIGS.REJECTS_CONNECTION,
      async ({ page, mockWallet, homePage }) => {
        await homePage.navigate();
        
        // Try to connect wallet
        await homePage.clickConnectWallet();
        
        // Should handle rejection gracefully
        await page.waitForTimeout(2000);
        
        // Connect button should remain available
        await expect(homePage.connectButton).toBeVisible();
        
        // Should not show connected state
        await expect(page.locator('text=Connected')).not.toBeVisible();
      }
    );

    test('should recover from connection rejection and allow retry', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      
      // Start with wallet that rejects connections
      await mockWallet.rejectConnection();
      
      // Try to connect
      await authPage.clickConnectWallet();
      await page.waitForTimeout(1000);
      
      // Should remain in disconnected state
      await authPage.verifyStep1Inactive();
      
      // User fixes wallet settings and tries again
      await mockWallet.acceptRequests();
      await mockWallet.connect();
      
      // Should now work
      await page.waitForTimeout(1000);
      await authPage.verifyStep1Active();
    });

    test('should handle wallet not installed scenario', async ({ 
      page, 
      homePage 
    }) => {
      // Remove wallet provider
      await page.addInitScript(() => {
        delete (window as any).ethereum;
      });
      
      await homePage.navigate();
      
      // Click connect button
      await homePage.clickConnectWallet();
      
      // Should show wallet installation prompt
      if (await page.isVisible('text=No wallet detected')) {
        await expect(page.locator('text=No wallet detected')).toBeVisible();
        await expect(page.locator('text=Please install MetaMask')).toBeVisible();
      }
    });

    test('should handle multiple wallets and user cancellation', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      // Mock multiple wallet providers
      await page.addInitScript(() => {
        // Add second wallet provider
        (window as any).ethereum2 = {
          isMetaMask: false,
          request: async () => {
            throw new Error('User cancelled wallet selection');
          }
        };
      });
      
      await authPage.navigate();
      
      // Click connect - should show wallet selection
      await authPage.clickConnectWallet();
      
      // If wallet selection modal appears, simulate cancellation
      if (await page.isVisible('text=Select Wallet')) {
        // Look for cancel or close button
        if (await page.isVisible('button:has-text("Cancel")')) {
          await page.click('button:has-text("Cancel")');
        }
      }
      
      // Should return to initial state
      await authPage.verifyStep1Inactive();
    });
  });

  test.describe('Transaction Signing Rejections', () => {
    testWithWallet(
      'should handle user rejection of transaction signing',
      WALLET_CONFIGS.REJECTS_SIGNING,
      async ({ page, mockWallet, authPage, savingsPage }) => {
        // Set up authenticated user first
        await mockWallet.acceptRequests();
        await mockWallet.connect();
        await setupAuthenticatedUser(page, mockWallet, authPage);
        
        // Now set wallet to reject signing for transactions
        await mockWallet.rejectSigning();
        
        await savingsPage.navigate();
        
        if (await page.isVisible('button:has-text("Deposit")')) {
          await page.click('button:has-text("Deposit")');
          await page.fill('input[type="number"]', '0.1');
          await page.click('button:has-text("Confirm")');
          
          // Should show rejection error
          await expect(page.locator('text=Transaction rejected')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
          
          // Should offer retry
          await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
        }
      }
    );

    test('should handle signing rejection during SIWE authentication', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      
      // Connect wallet successfully
      await mockWallet.connect();
      await page.waitForTimeout(1000);
      await authPage.verifyStep1Active();
      
      // Mock nonce endpoint
      await page.route('**/auth/nonce', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            nonce: 'test-nonce',
            message: 'Sign in to BFN'
          })
        });
      });
      
      // Set wallet to reject signing
      await mockWallet.rejectSigning();
      
      // Try to sign in
      await authPage.clickSignIn();
      
      // Should show rejection error
      await authPage.verifyError('User rejected signing');
      
      // Should remain on auth page
      await expect(page).toHaveURL('/auth');
      
      // Allow retry
      await mockWallet.acceptRequests();
      
      // Mock successful auth flow
      await page.route('**/auth/verify', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: 'test-token',
            user: { address: '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7' }
          })
        });
      });
      
      // Try again - should work
      await authPage.clickSignIn();
      await authPage.waitForRedirect();
      await expect(page).toHaveURL('/dashboard');
    });

    test('should differentiate between different types of signing rejections', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();
      
      const rejectionScenarios = [
        {
          error: 'User denied transaction signature',
          expectedMessage: 'Transaction rejected by user'
        },
        {
          error: 'Transaction rejected',
          expectedMessage: 'Transaction was declined'
        },
        {
          error: 'Insufficient funds for gas',
          expectedMessage: 'Insufficient funds for transaction fees'
        }
      ];
      
      for (const scenario of rejectionScenarios) {
        // Override wallet to throw specific error
        await page.addInitScript((errorMessage) => {
          (window as any).ethereum.request = async ({ method }: { method: string }) => {
            if (method === 'eth_sendTransaction' || method === 'personal_sign') {
              throw new Error(errorMessage);
            }
            return '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7';
          };
        }, scenario.error);
        
        if (await page.isVisible('button:has-text("Deposit")')) {
          await page.click('button:has-text("Deposit")');
          await page.fill('input[type="number"]', '0.1');
          await page.click('button:has-text("Confirm")');
          
          // Should show appropriate error message
          await expect(page.locator(`text=${scenario.expectedMessage}`)).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
          
          // Close modal for next test
          if (await page.isVisible('button:has-text("Close")')) {
            await page.click('button:has-text("Close")');
          }
        }
        
        // Reset for next scenario
        await page.reload();
        await page.waitForLoadState('networkidle');
      }
    });
  });

  test.describe('Network Switching Rejections', () => {
    testWithWallet(
      'should handle user rejection of network switch',
      WALLET_CONFIGS.REJECTS_NETWORK_SWITCH,
      async ({ page, mockWallet, authPage, networkGuard }) => {
        await authPage.navigate();
        await mockWallet.connect();
        await page.waitForTimeout(1000);
        
        // Should show network switch prompt
        if (await networkGuard.isVisible('[data-testid="network-warning"]')) {
          await networkGuard.verifywrongNetworkWarning();
          
          // Try to switch network
          await networkGuard.clickSwitchNetwork();
          
          // Should show rejection error
          await expect(page.locator('text=Network switch rejected')).toBeVisible({ timeout: 3000 });
          
          // Should still show network warning
          await networkGuard.verifywrongNetworkWarning();
        }
      }
    );

    test('should provide manual network switching instructions', async ({ 
      page, 
      mockWallet, 
      authPage, 
      networkGuard 
    }) => {
      // Connect to wrong network
      await mockWallet.switchNetwork(1); // Ethereum mainnet
      await mockWallet.connect();
      
      await authPage.navigate();
      await page.waitForTimeout(1000);
      
      // Should show network warning with instructions
      if (await networkGuard.isVisible('[data-testid="network-warning"]')) {
        await expect(page.locator('text=Please switch to Base Sepolia')).toBeVisible();
        
        // Should provide manual instructions
        if (await page.isVisible('button:has-text("Manual Instructions")')) {
          await page.click('button:has-text("Manual Instructions")');
          
          await expect(page.locator('text=Network Details')).toBeVisible();
          await expect(page.locator('text=Chain ID: 84532')).toBeVisible();
          await expect(page.locator('text=RPC URL')).toBeVisible();
        }
      }
    });

    test('should detect successful manual network switch', async ({ 
      page, 
      mockWallet, 
      authPage, 
      networkGuard 
    }) => {
      // Start on wrong network
      await mockWallet.switchNetwork(1);
      await mockWallet.connect();
      
      await authPage.navigate();
      await page.waitForTimeout(1000);
      
      if (await networkGuard.isVisible('[data-testid="network-warning"]')) {
        // User manually switches network
        await mockWallet.switchNetwork(84532); // Base Sepolia
        
        // Should detect network change and remove warning
        await page.waitForTimeout(1000);
        await networkGuard.verifyNetworkAccepted();
        
        // Auth flow should now be accessible
        await authPage.verifyStep1Active();
        await authPage.verifyStep2Visible();
      }
    });
  });

  test.describe('Wallet Disconnection During Operations', () => {
    test('should handle wallet disconnection during transaction', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();
      
      if (await page.isVisible('button:has-text("Deposit")')) {
        await page.click('button:has-text("Deposit")');
        await page.fill('input[type="number"]', '0.1');
        await page.click('button:has-text("Confirm")');
        
        // Disconnect wallet during transaction
        await page.waitForTimeout(1000);
        await mockWallet.disconnect();
        
        // Should show disconnection error
        await expect(page.locator('text=Wallet disconnected')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
        
        // Should provide reconnection option
        await expect(page.locator('button:has-text("Reconnect Wallet")')).toBeVisible();
      }
    });

    test('should handle wallet disconnection during authentication', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      await mockWallet.connect();
      await page.waitForTimeout(1000);
      await authPage.verifyStep1Active();
      
      // Mock slow auth process
      await page.route('**/auth/nonce', async (route) => {
        await page.waitForTimeout(3000);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ nonce: 'test' })
        });
      });
      
      // Start authentication
      await authPage.clickSignIn();
      
      // Disconnect wallet during auth
      await page.waitForTimeout(1000);
      await mockWallet.disconnect();
      
      // Should handle gracefully
      await expect(page.locator('text=Wallet disconnected during authentication')).toBeVisible({ timeout: 5000 });
      
      // Should revert to step 1
      await authPage.verifyStep1Inactive();
    });

    test('should preserve app state after wallet reconnection', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Navigate to a specific page
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Disconnect wallet
      await mockWallet.disconnect();
      
      // Should show disconnection warning but preserve page
      if (await page.isVisible('text=Wallet disconnected')) {
        await expect(page.locator('text=Wallet disconnected')).toBeVisible();
      }
      
      // Reconnect wallet
      await mockWallet.connect();
      await page.waitForTimeout(1000);
      
      // Should remain on same page
      await expect(page).toHaveURL('/dashboard');
      
      // Warning should disappear
      if (await page.isVisible('text=Wallet disconnected')) {
        await expect(page.locator('text=Wallet disconnected')).not.toBeVisible();
      }
    });
  });

  test.describe('Recovery and User Guidance', () => {
    test('should provide clear recovery instructions for common errors', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      await mockWallet.rejectConnection();
      
      // Try to connect
      await authPage.clickConnectWallet();
      await page.waitForTimeout(1000);
      
      // Should provide helpful guidance
      const guidanceMessages = [
        'Make sure your wallet is unlocked',
        'Check that you approved the connection',
        'Try refreshing the page if issues persist'
      ];
      
      for (const message of guidanceMessages) {
        if (await page.isVisible(`text=${message}`)) {
          await expect(page.locator(`text=${message}`)).toBeVisible();
          break;
        }
      }
    });

    test('should show progressive enhancement for wallet features', async ({ 
      page, 
      homePage 
    }) => {
      // Remove wallet provider
      await page.addInitScript(() => {
        delete (window as any).ethereum;
      });
      
      await homePage.navigate();
      
      // Should show alternative access methods
      await expect(page.locator('text=Connect your wallet to get started')).toBeVisible();
      
      if (await page.isVisible('text=Don\'t have a wallet?')) {
        await expect(page.locator('text=Don\'t have a wallet?')).toBeVisible();
        await expect(page.locator('text=Learn how to set up')).toBeVisible();
      }
    });

    test('should handle rapid wallet state changes gracefully', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      
      // Rapid connect/disconnect cycle
      await mockWallet.connect();
      await page.waitForTimeout(100);
      await mockWallet.disconnect();
      await page.waitForTimeout(100);
      await mockWallet.connect();
      await page.waitForTimeout(100);
      
      // Should stabilize to final state
      await page.waitForTimeout(1000);
      await authPage.verifyStep1Active();
    });

    test('should provide contact support option for persistent issues', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      
      // Simulate persistent connection issues
      for (let i = 0; i < 3; i++) {
        await mockWallet.rejectConnection();
        await authPage.clickConnectWallet();
        await page.waitForTimeout(500);
      }
      
      // After multiple failures, should suggest support
      if (await page.isVisible('text=Still having trouble?')) {
        await expect(page.locator('text=Still having trouble?')).toBeVisible();
        await expect(page.locator('text=Contact Support')).toBeVisible();
      }
    });
  });
});