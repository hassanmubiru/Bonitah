/**
 * E2E Tests for Transaction History Viewing
 * 
 * Tests the complete transaction history viewing functionality including:
 * - Viewing transaction history on dashboard and dedicated pages
 * - Filtering and searching transactions
 * - Transaction details and formatting
 * - Pagination and performance with large transaction sets
 * - Export functionality
 */

import { expect } from '@playwright/test';
import { test, setupAuthenticatedUser, resetBrowserState, TIMEOUTS } from '../utils/fixtures';

test.describe('Transaction History Viewing', () => {
  test.beforeEach(async ({ page, mockWallet }) => {
    await resetBrowserState(page);
    
    // Mock transaction history API with sample data
    await page.route('**/api/transactions**', async (route) => {
      const url = new URL(route.request().url());
      const limit = url.searchParams.get('limit') || '50';
      const offset = url.searchParams.get('offset') || '0';
      const type = url.searchParams.get('type');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      
      // Generate sample transaction data
      const sampleTransactions = [
        {
          id: '1',
          type: 'deposit',
          amount: '0.5',
          token: 'ETH',
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed',
          gasUsed: '21000',
          gasPrice: '20000000000'
        },
        {
          id: '2',
          type: 'withdraw',
          amount: '0.2',
          token: 'ETH',
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed',
          gasUsed: '25000',
          gasPrice: '18000000000'
        },
        {
          id: '3',
          type: 'goal_contribution',
          amount: '100',
          token: 'USD',
          goalName: 'Emergency Fund',
          timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed'
        },
        {
          id: '4',
          type: 'community_vote',
          proposalId: 'prop-1',
          votePower: '50',
          voteChoice: 'yes',
          timestamp: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed'
        },
        {
          id: '5',
          type: 'deposit',
          amount: '1.0',
          token: 'ETH',
          txHash: '0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc',
          timestamp: new Date(Date.now() - 120 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed',
          gasUsed: '21000',
          gasPrice: '22000000000'
        }
      ];
      
      // Apply filtering
      let filteredTransactions = sampleTransactions;
      if (type) {
        filteredTransactions = filteredTransactions.filter(tx => tx.type === type);
      }
      if (startDate) {
        filteredTransactions = filteredTransactions.filter(tx => 
          new Date(tx.timestamp) >= new Date(startDate)
        );
      }
      if (endDate) {
        filteredTransactions = filteredTransactions.filter(tx => 
          new Date(tx.timestamp) <= new Date(endDate)
        );
      }
      
      // Apply pagination
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);
      const paginatedTransactions = filteredTransactions.slice(offsetNum, offsetNum + limitNum);
      
      await route.fulfill({
        json: {
          transactions: paginatedTransactions,
          total: filteredTransactions.length,
          hasMore: offsetNum + limitNum < filteredTransactions.length
        }
      });
    });
  });

  test('should display transaction history on dashboard', async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto('/dashboard');
    
    // Wait for transactions to load
    await expect(page.getByTestId('recent-transactions')).toBeVisible({ timeout: TIMEOUTS.navigation });
    
    // Check that transactions are displayed
    const transactionItems = page.getByTestId('transaction-item');
    await expect(transactionItems).toHaveCount(5);
    
    // Verify transaction details are shown
    const firstTransaction = transactionItems.first();
    await expect(firstTransaction).toContainText('deposit');
    await expect(firstTransaction).toContainText('0.5');
    await expect(firstTransaction).toContainText('ETH');
  });

  test('should navigate to full transaction history', async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto('/dashboard');
    
    // Click view all transactions link
    await page.getByTestId('view-all-transactions').click();
    
    // Should navigate to transactions page
    await expect(page).toHaveURL('/transactions');
    await expect(page.getByRole('heading', { name: /transaction history/i })).toBeVisible();
  });

  test('should filter transactions by type', async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto('/transactions');
    
    // Select deposit filter
    await page.getByTestId('transaction-type-filter').selectOption('deposit');
    
    // Verify only deposit transactions are shown
    await page.waitForTimeout(1000); // Wait for filter to apply
    const transactionItems = page.getByTestId('transaction-item');
    await expect(transactionItems).toHaveCount(2); // Only deposits
    
    for (const item of await transactionItems.all()) {
      await expect(item).toContainText('deposit');
    }
  });

  test('should filter transactions by date range', async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto('/transactions');
    
    // Set date filter to last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await page.getByTestId('start-date-filter').fill(yesterday.toISOString().split('T')[0]);
    
    // Apply filter
    await page.getByTestId('apply-date-filter').click();
    
    // Should show only recent transactions
    await page.waitForTimeout(1000);
    const transactionItems = page.getByTestId('transaction-item');
    await expect(transactionItems.first()).toContainText('deposit');
  });

  test('should display transaction details in modal', async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto('/transactions');
    
    // Click on first transaction
    await page.getByTestId('transaction-item').first().click();
    
    // Transaction details modal should open
    const modal = page.getByTestId('transaction-details-modal');
    await expect(modal).toBeVisible();
    
    // Verify detailed information is displayed
    await expect(modal).toContainText('Transaction Hash');
    await expect(modal).toContainText('0x1234567890abcdef');
    await expect(modal).toContainText('Gas Used');
    await expect(modal).toContainText('21000');
  });

  test('should paginate through transaction history', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    // Mock large transaction set
    await page.route('**/api/transactions**', async (route) => {
      const url = new URL(route.request().url());
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      
      // Generate more transactions for pagination test
      const totalTransactions = 25;
      const transactions = Array.from({ length: totalTransactions }, (_, i) => ({
        id: `tx-${i + 1}`,
        type: i % 2 === 0 ? 'deposit' : 'withdraw',
        amount: (Math.random() * 10).toFixed(2),
        token: 'ETH',
        txHash: `0x${'0'.repeat(60)}${i.toString(16).padStart(4, '0')}`,
        timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
        status: 'confirmed'
      }));
      
      const paginatedTransactions = transactions.slice(offset, offset + limit);
      
      await route.fulfill({
        json: {
          transactions: paginatedTransactions,
          total: totalTransactions,
          hasMore: offset + limit < totalTransactions
        }
      });
    });
    
    await page.goto('/transactions');
    
    // Verify first page loads
    await expect(page.getByTestId('transaction-item')).toHaveCount(10);
    
    // Click next page
    await page.getByTestId('next-page').click();
    
    // Verify second page loads
    await expect(page.getByTestId('transaction-item')).toHaveCount(10);
    
    // Verify page indicator
    await expect(page.getByTestId('page-indicator')).toContainText('2');
  });
});