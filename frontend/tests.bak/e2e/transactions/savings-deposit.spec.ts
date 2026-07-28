/**
 * E2E Tests for Savings Deposit Transactions
 * 
 * Tests the complete deposit flow including:
 * - Deposit initiation and wallet signing
 * - Transaction confirmation and status tracking
 * - Balance updates and UI reflection
 * - Error handling for failed transactions
 */

import { expect } from '@playwright/test';
import { test, setupAuthenticatedUser, resetBrowserState, TIMEOUTS, TEST_DATA } from '../utils/fixtures';

test.describe('Savings Deposit Flow', () => {
  test.beforeEach(async ({ page, mockWallet }) => {
    await resetBrowserState(page);
    
    // Mock contract interaction endpoints
    await page.route('**/api/contract/balance', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: '1.5',
          decimals: 18,
          symbol: 'ETH'
        })
      });
    });

    await page.route('**/api/contract/deposit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          gasEstimate: '21000'
        })
      });
    });
  });

  test.describe('Successful Deposit Flow', () => {
    test('should complete full deposit transaction', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      // Verify balance is displayed
      await savingsPage.verifyBalance();

      // Initiate deposit
      const depositAmount = TEST_DATA.transactions.deposit.amount;
      await savingsPage.initiateDeposit(depositAmount);

      // Should show transaction confirmation modal
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator(`text=${depositAmount}`)).toBeVisible();
      await expect(page.locator('text=Confirm Deposit')).toBeVisible();

      // Click confirm to trigger wallet transaction
      await page.click('button:has-text("Confirm Deposit")');

      // Should show transaction pending state
      await expect(page.locator('text=Transaction Pending')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });

      // Mock successful transaction confirmation
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        // Simulate transaction success
        window.dispatchEvent(new CustomEvent('transactionComplete', {
          detail: {
            success: true,
            txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
          }
        }));
      });

      // Should show success message and updated balance
      await expect(page.locator('text=Deposit Successful')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      
      // Transaction hash should be displayed
      await expect(page.locator('text=0x1234...cdef')).toBeVisible();
      
      // Close success modal
      await page.click('button:has-text("Close")');

      // Balance should be updated (mock updated balance call)
      await page.route('**/api/contract/balance', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            balance: '1.6', // Increased by 0.1
            decimals: 18,
            symbol: 'ETH'
          })
        });
      });

      // Refresh balance
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Updated balance should be shown
      await expect(page.locator('text=1.6 ETH')).toBeVisible();
    });

    test('should handle multiple deposit amounts correctly', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      const testAmounts = ['0.01', '0.1', '1.0', '10.0'];

      for (const amount of testAmounts) {
        await savingsPage.initiateDeposit(amount);
        
        // Verify amount is displayed correctly in confirmation
        await expect(page.locator(`text=${amount}`)).toBeVisible();
        
        // Cancel to test next amount
        await page.click('button:has-text("Cancel")');
        await expect(page.locator('[role="dialog"]')).not.toBeVisible();
      }
    });

    test('should validate minimum deposit amount', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      // Try to deposit too small amount
      await savingsPage.depositButton.click();
      await savingsPage.amountInput.fill('0.001');
      
      // Should show validation error
      await expect(page.locator('text=Minimum deposit is 0.01 ETH')).toBeVisible();
      
      // Confirm button should be disabled
      await expect(savingsPage.confirmButton).toBeDisabled();
    });

    test('should validate maximum deposit amount against balance', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      // Try to deposit more than balance (wallet has 2 ETH, try to deposit 3)
      await savingsPage.depositButton.click();
      await savingsPage.amountInput.fill('3.0');
      
      // Should show insufficient balance error
      await expect(page.locator('text=Insufficient balance')).toBeVisible();
      
      // Confirm button should be disabled
      await expect(savingsPage.confirmButton).toBeDisabled();
    });
  });

  test.describe('Transaction Failures', () => {
    test('should handle user rejection of transaction', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      // Set wallet to reject transactions
      await mockWallet.rejectSigning();

      await savingsPage.initiateDeposit('0.1');
      await page.click('button:has-text("Confirm Deposit")');

      // Should show rejection error
      await expect(page.locator('text=Transaction rejected by user')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      
      // Should allow retry
      await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
      
      // Close error modal
      await page.click('button:has-text("Close")');
      
      // Should return to normal state
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('should handle transaction failure from contract', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      // Mock contract failure
      await page.route('**/api/contract/deposit', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Contract execution failed',
            reason: 'Insufficient allowance'
          })
        });
      });

      await savingsPage.initiateDeposit('0.1');
      await page.click('button:has-text("Confirm Deposit")');

      // Should show contract error
      await expect(page.locator('text=Contract execution failed')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      await expect(page.locator('text=Insufficient allowance')).toBeVisible();
      
      // Should show retry option
      await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
    });

    test('should handle network errors during transaction', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      // Mock network error
      await page.route('**/api/contract/deposit', async (route) => {
        await route.abort('internetdisconnected');
      });

      await savingsPage.initiateDeposit('0.1');
      await page.click('button:has-text("Confirm Deposit")');

      // Should show network error
      await expect(page.locator('text=Network error occurred')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      
      // Should allow retry
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    });

    test('should handle gas estimation failure', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      // Mock gas estimation failure
      await page.route('**/api/contract/deposit', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Gas estimation failed',
            reason: 'Transaction would fail'
          })
        });
      });

      await savingsPage.initiateDeposit('0.1');
      await page.click('button:has-text("Confirm Deposit")');

      // Should show gas estimation error
      await expect(page.locator('text=Gas estimation failed')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      await expect(page.locator('text=Transaction would fail')).toBeVisible();
    });
  });

  test.describe('Transaction Status Tracking', () => {
    test('should show transaction status progression', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      await savingsPage.initiateDeposit('0.1');
      await page.click('button:has-text("Confirm Deposit")');

      // Should show initial pending state
      await expect(page.locator('text=Preparing transaction')).toBeVisible();
      
      // Simulate progression through states
      await page.waitForTimeout(1000);
      await expect(page.locator('text=Waiting for signature')).toBeVisible();
      
      await page.waitForTimeout(1000);
      await expect(page.locator('text=Transaction submitted')).toBeVisible();
      
      await page.waitForTimeout(1000);
      await expect(page.locator('text=Confirming on blockchain')).toBeVisible();
      
      // Mock final confirmation
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transactionComplete', {
          detail: {
            success: true,
            txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            confirmations: 1
          }
        }));
      });
      
      await expect(page.locator('text=Transaction confirmed')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
    });

    test('should provide transaction hash and block explorer link', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      await savingsPage.initiateDeposit('0.1');
      await page.click('button:has-text("Confirm Deposit")');

      // Mock transaction success
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transactionComplete', {
          detail: {
            success: true,
            txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
          }
        }));
      });

      await expect(page.locator('text=Transaction Hash:')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      await expect(page.locator('text=0x1234...cdef')).toBeVisible();
      
      // Block explorer link should be present
      const explorerLink = page.locator('a:has-text("View on Block Explorer")');
      await expect(explorerLink).toBeVisible();
      await expect(explorerLink).toHaveAttribute('href', /.*basescan\.org.*0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef/);
    });

    test('should handle pending transaction timeout', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      await savingsPage.initiateDeposit('0.1');
      await page.click('button:has-text("Confirm Deposit")');

      // Let transaction stay pending for timeout period
      await page.waitForTimeout(TIMEOUTS.TRANSACTION_CONFIRMATION);

      // Should show timeout warning
      await expect(page.locator('text=Transaction is taking longer than expected')).toBeVisible();
      await expect(page.locator('text=This may be due to network congestion')).toBeVisible();
      
      // Should provide options to wait or cancel
      await expect(page.locator('button:has-text("Keep Waiting")')).toBeVisible();
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    });
  });

  test.describe('Balance Updates and Synchronization', () => {
    test('should update balance immediately after successful transaction', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      const initialBalance = '1.5';
      const depositAmount = '0.1';
      const expectedBalance = '1.6';

      // Verify initial balance
      await expect(page.locator(`text=${initialBalance} ETH`)).toBeVisible();

      await savingsPage.initiateDeposit(depositAmount);
      await page.click('button:has-text("Confirm Deposit")');

      // Mock successful transaction
      await page.route('**/api/contract/balance', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            balance: expectedBalance,
            decimals: 18,
            symbol: 'ETH'
          })
        });
      });

      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transactionComplete', {
          detail: { success: true, txHash: '0x123...def' }
        }));
      });

      // Balance should update automatically
      await expect(page.locator(`text=${expectedBalance} ETH`)).toBeVisible({ timeout: 5000 });
    });

    test('should handle balance update failures gracefully', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      await savingsPage.initiateDeposit('0.1');
      await page.click('button:has-text("Confirm Deposit")');

      // Mock balance update failure
      await page.route('**/api/contract/balance', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unable to fetch balance' })
        });
      });

      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transactionComplete', {
          detail: { success: true, txHash: '0x123...def' }
        }));
      });

      // Should show transaction success but balance update warning
      await expect(page.locator('text=Deposit Successful')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      await expect(page.locator('text=Balance update may be delayed')).toBeVisible();
    });

    test('should provide manual balance refresh option', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      // Look for refresh button (might be in a menu or always visible)
      if (await page.isVisible('button:has-text("Refresh Balance")')) {
        await page.click('button:has-text("Refresh Balance")');
        
        // Should show loading state
        await expect(page.locator('text=Updating balance...')).toBeVisible();
        
        // Should update after a moment
        await page.waitForTimeout(1000);
        await expect(page.locator('text=Updating balance...')).not.toBeVisible();
      }
    });
  });

  test.describe('User Experience and Accessibility', () => {
    test('should be accessible via keyboard navigation', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      // Tab to deposit button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should focus on deposit button
      await expect(savingsPage.depositButton).toBeFocused();
      
      // Press Enter to open modal
      await page.keyboard.press('Enter');
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      
      // Tab to amount input
      await page.keyboard.press('Tab');
      await expect(savingsPage.amountInput).toBeFocused();
      
      // Type amount
      await page.keyboard.type('0.1');
      
      // Tab to confirm button
      await page.keyboard.press('Tab');
      await expect(savingsPage.confirmButton).toBeFocused();
    });

    test('should show appropriate loading states', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      await savingsPage.initiateDeposit('0.1');
      
      // Should show loading state on confirm button after click
      await page.click('button:has-text("Confirm Deposit")');
      await expect(page.locator('button:has-text("Confirming...")')).toBeVisible();
      await expect(page.locator('button:has-text("Confirming...")')).toBeDisabled();
      
      // Should show spinner or loading indicator
      await expect(page.locator('.animate-spin')).toBeVisible();
    });

    test('should handle window resize during transaction', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();

      await savingsPage.initiateDeposit('0.1');
      await page.click('button:has-text("Confirm Deposit")');

      // Resize window during transaction
      await page.setViewportSize({ width: 375, height: 667 }); // Mobile
      
      // Modal should remain accessible and properly positioned
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      
      // Resize back to desktop
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Modal should still be properly positioned
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });
  });
});