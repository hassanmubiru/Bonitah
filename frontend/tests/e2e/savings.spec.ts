import { test, expect } from '@playwright/test';
import { MockWallet } from '../helpers/mock-wallet';

/**
 * Savings Transaction E2E Tests
 * 
 * Implements Task 22.1 requirement for initiating transactions
 */
test.describe('Savings Transactions', () => {
  let mockWallet: MockWallet;

  test.beforeEach(async ({ page, context }) => {
    mockWallet = new MockWallet(page, context);
    
    // Setup authenticated user
    await mockWallet.mockConnection('0x742d35Cc6634C0532925a3b8D404d67B18D2f83f');
    await mockWallet.setBalance('0x742d35Cc6634C0532925a3b8D404d67B18D2f83f', '10000000000000000000');
    
    await page.goto('/auth');
    await page.click('[data-testid="connect-wallet-button"]');
    await page.click('[data-testid="generate-nonce-button"]');
    
    const messageText = await page.locator('[data-testid="siwe-message"]').textContent();
    await mockWallet.mockSignature(messageText!);
    await page.click('[data-testid="sign-message-button"]');
    
    await expect(page).toHaveURL('/dashboard');
  });

  test('should deposit funds to savings vault', async ({ page }) => {
    // Navigate to savings page
    await page.click('[data-testid="nav-savings"]');
    await expect(page).toHaveURL('/savings');

    // Check initial balance display
    await expect(page.locator('[data-testid="wallet-balance"]')).toBeVisible();
    await expect(page.locator('[data-testid="savings-balance"]')).toBeVisible();

    // Open deposit modal
    await page.click('[data-testid="deposit-button"]');
    await expect(page.locator('[data-testid="deposit-modal"]')).toBeVisible();

    // Enter deposit amount
    await page.fill('[data-testid="deposit-amount-input"]', '1.5');
    await expect(page.locator('[data-testid="deposit-preview"]')).toContainText('1.5 ETH');

    // Mock successful transaction
    const txHash = '0xdeposit123...abc';
    await mockWallet.mockTransaction(txHash);
    await mockWallet.mockTransactionReceipt(txHash, true);

    // Submit deposit
    await page.click('[data-testid="confirm-deposit-button"]');

    // Should show transaction pending
    await expect(page.locator('[data-testid="tx-pending"]')).toBeVisible();
    await expect(page.locator('[data-testid="tx-hash"]')).toContainText(txHash.substring(0, 10));

    // Wait for transaction confirmation
    await expect(page.locator('[data-testid="tx-success"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="deposit-success-message"]')).toContainText('1.5 ETH deposited');

    // Verify balance updated
    await page.click('[data-testid="close-modal-button"]');
    // Note: In real test, would mock contract read to return updated balance
  });

  test('should withdraw funds from savings vault', async ({ page }) => {
    // Mock existing savings balance
    await mockWallet.mockContractRead(
      '0x0000000000000000000000000000000000000001', // Mock SavingsVault address
      '0x0000000000000000000000000000000000000000000000001bc16d674ec80000' // 2 ETH in hex
    );

    await page.goto('/savings');

    // Open withdraw modal
    await page.click('[data-testid="withdraw-button"]');
    await expect(page.locator('[data-testid="withdraw-modal"]')).toBeVisible();

    // Enter withdraw amount
    await page.fill('[data-testid="withdraw-amount-input"]', '0.5');
    
    // Verify amount validation
    await expect(page.locator('[data-testid="withdraw-preview"]')).toContainText('0.5 ETH');
    await expect(page.locator('[data-testid="remaining-balance"]')).toContainText('1.5 ETH');

    // Mock successful withdrawal
    const txHash = '0xwithdraw456...def';
    await mockWallet.mockTransaction(txHash);
    await mockWallet.mockTransactionReceipt(txHash, true);

    // Submit withdrawal
    await page.click('[data-testid="confirm-withdraw-button"]');

    // Verify transaction flow
    await expect(page.locator('[data-testid="tx-pending"]')).toBeVisible();
    await expect(page.locator('[data-testid="tx-success"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="withdraw-success-message"]')).toContainText('0.5 ETH withdrawn');
  });

  test('should handle insufficient balance error', async ({ page }) => {
    await page.goto('/savings');

    // Try to deposit more than wallet balance
    await page.click('[data-testid="deposit-button"]');
    await page.fill('[data-testid="deposit-amount-input"]', '100');

    // Should show insufficient balance error
    await expect(page.locator('[data-testid="insufficient-balance-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-deposit-button"]')).toBeDisabled();
  });

  test('should handle transaction rejection', async ({ page }) => {
    await page.goto('/savings');

    await page.click('[data-testid="deposit-button"]');
    await page.fill('[data-testid="deposit-amount-input"]', '1');

    // Mock transaction rejection
    await page.addInitScript(() => {
      const originalRequest = (window as any).ethereum.request;
      (window as any).ethereum.request = async ({ method, params }: any) => {
        if (method === 'eth_sendTransaction') {
          throw new Error('User rejected the request.');
        }
        return originalRequest({ method, params });
      };
    });

    await page.click('[data-testid="confirm-deposit-button"]');

    // Should show rejection error
    await expect(page.locator('[data-testid="tx-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="tx-error"]')).toContainText('rejected');
    await expect(page.locator('[data-testid="retry-transaction-button"]')).toBeVisible();
  });

  test('should show transaction history', async ({ page }) => {
    // Mock transaction history from backend
    await page.route('**/api/transactions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          transactions: [
            {
              id: '1',
              hash: '0xdeposit123...abc',
              type: 'deposit',
              amount: '1500000000000000000',
              timestamp: new Date().toISOString(),
              status: 'confirmed',
              blockNumber: 12345
            },
            {
              id: '2', 
              hash: '0xwithdraw456...def',
              type: 'withdraw',
              amount: '500000000000000000',
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              status: 'confirmed',
              blockNumber: 12340
            }
          ],
          pagination: {
            page: 1,
            limit: 50,
            total: 2
          }
        })
      });
    });

    await page.goto('/savings');

    // Navigate to transaction history
    await page.click('[data-testid="transaction-history-tab"]');

    // Verify transactions displayed
    await expect(page.locator('[data-testid="transaction-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="tx-item-deposit"]')).toBeVisible();
    await expect(page.locator('[data-testid="tx-item-withdraw"]')).toBeVisible();

    // Check transaction details
    await expect(page.locator('[data-testid="tx-item-deposit"]')).toContainText('1.5 ETH');
    await expect(page.locator('[data-testid="tx-item-deposit"]')).toContainText('Deposit');
    await expect(page.locator('[data-testid="tx-item-withdraw"]')).toContainText('0.5 ETH');
    await expect(page.locator('[data-testid="tx-item-withdraw"]')).toContainText('Withdraw');

    // Test transaction filtering
    await page.selectOption('[data-testid="tx-filter-select"]', 'deposit');
    await expect(page.locator('[data-testid="tx-item-deposit"]')).toBeVisible();
    await expect(page.locator('[data-testid="tx-item-withdraw"]')).toBeHidden();
  });
});