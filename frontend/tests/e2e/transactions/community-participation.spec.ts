/**
 * E2E Tests for Community Participation
 * 
 * Tests community features including:
 * - Joining and creating savings circles
 * - Contributing to community pools
 * - Voting on community proposals
 * - Participation in governance
 */

import { expect } from '@playwright/test';
import { test, setupAuthenticatedUser, resetBrowserState, TIMEOUTS } from '../utils/fixtures';

test.describe('Community Participation', () => {
  test.beforeEach(async ({ page, mockWallet }) => {
    await resetBrowserState(page);
    
    // Mock community API endpoints
    await page.route('**/api/community/circles', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            circles: [
              {
                id: 1,
                name: 'DeFi Beginners Circle',
                memberCount: 15,
                maxMembers: 20,
                totalContributions: '5000',
                status: 'active',
                description: 'Learning DeFi together'
              }
            ]
          })
        });
      }
    });

    await page.route('**/api/community/pools', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pools: [
            {
              id: 1,
              name: 'Stablecoin Yield Pool',
              totalValue: '50000',
              apy: '8.5',
              participantCount: 42,
              userShare: '2.5',
              status: 'active'
            }
          ]
        })
      });
    });
  });

  test.describe('Savings Circles', () => {
    test('should display available savings circles', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/community');
      await page.waitForLoadState('networkidle');

      // Should show circles section
      await expect(page.locator('text=Savings Circles')).toBeVisible();
      await expect(page.locator('text=DeFi Beginners Circle')).toBeVisible();
      await expect(page.locator('text=15/20 members')).toBeVisible();
      await expect(page.locator('text=$5,000 total')).toBeVisible();
      await expect(page.locator('text=Learning DeFi together')).toBeVisible();
    });

    test('should join an existing savings circle', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/community');

      // Mock join circle endpoint
      await page.route('**/api/community/circles/1/join', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            txHash: '0xjoin123456',
            circleId: 1,
            membershipFee: '0.05'
          })
        });
      });

      // Click join circle
      await page.click('button:has-text("Join Circle")');
      
      // Should show join confirmation
      await expect(page.locator('text=Join DeFi Beginners Circle')).toBeVisible();
      await expect(page.locator('text=Membership fee: 0.05 ETH')).toBeVisible();
      
      // Confirm joining
      await page.click('button:has-text("Confirm Join")');
      
      // Should show transaction confirmation
      await expect(page.locator('text=Transaction Pending')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });

      // Mock successful transaction
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transactionComplete', {
          detail: {
            success: true,
            txHash: '0xjoin123456'
          }
        }));
      });

      // Should show success message
      await expect(page.locator('text=Successfully joined circle')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      await expect(page.locator('text=You are now a member')).toBeVisible();
    });
    test('should create a new savings circle', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/community');

      // Mock create circle endpoint
      await page.route('**/api/community/circles', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 2,
              name: 'Advanced Trading Circle',
              memberCount: 1,
              maxMembers: 10,
              totalContributions: '0',
              status: 'active'
            })
          });
        }
      });

      // Click create circle
      await page.click('button:has-text("Create Circle")');
      
      // Should show creation form
      await expect(page.locator('text=Create New Savings Circle')).toBeVisible();
      
      // Fill form
      await page.fill('input[name="circleName"]', 'Advanced Trading Circle');
      await page.fill('input[name="maxMembers"]', '10');
      await page.fill('textarea[name="description"]', 'For experienced DeFi users');
      
      // Submit form
      await page.click('button:has-text("Create Circle")');
      
      // Should show success message
      await expect(page.locator('text=Circle created successfully')).toBeVisible({ timeout: TIMEOUTS.API_RESPONSE });
      await expect(page.locator('text=Advanced Trading Circle')).toBeVisible();
    });

    test('should contribute to circle pool', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock user being a member of a circle
      await page.route('**/api/community/circles/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            name: 'DeFi Beginners Circle',
            isMember: true,
            memberCount: 16,
            totalContributions: '5000',
            userContributions: '250'
          })
        });
      });

      await page.goto('/community/circles/1');

      // Should show member dashboard
      await expect(page.locator('text=Your contributions: $250')).toBeVisible();
      
      // Click contribute
      await page.click('button:has-text("Contribute to Pool")');
      
      // Fill contribution amount
      await page.fill('input[name="amount"]', '100');
      await page.click('button:has-text("Contribute")');
      
      // Should confirm transaction
      await expect(page.locator('text=Confirm Contribution')).toBeVisible();
      await page.click('button:has-text("Confirm Transaction")');
      
      // Mock successful contribution
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transactionComplete', {
          detail: { success: true, txHash: '0xcontrib123' }
        }));
      });

      await expect(page.locator('text=Contribution Successful')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
    });
  });

  test.describe('Investment Pools', () => {
    test('should display available investment pools', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/community/pools');

      // Should show pools
      await expect(page.locator('text=Investment Pools')).toBeVisible();
      await expect(page.locator('text=Stablecoin Yield Pool')).toBeVisible();
      await expect(page.locator('text=8.5% APY')).toBeVisible();
      await expect(page.locator('text=$50,000 TVL')).toBeVisible();
      await expect(page.locator('text=42 participants')).toBeVisible();
    });

    test('should contribute to investment pool', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/community/pools');

      // Mock pool contribution endpoint
      await page.route('**/api/community/pools/1/contribute', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            txHash: '0xpool123',
            newShare: '5.2',
            estimatedReturns: '208'
          })
        });
      });

      // Click contribute to pool
      await page.click('button:has-text("Contribute")');
      
      // Should show pool details
      await expect(page.locator('text=Contribute to Stablecoin Yield Pool')).toBeVisible();
      await expect(page.locator('text=Current APY: 8.5%')).toBeVisible();
      
      // Enter contribution amount
      await page.fill('input[name="poolContribution"]', '1000');
      
      // Should show estimated returns
      await expect(page.locator('text=Estimated annual returns: $85')).toBeVisible();
      
      // Confirm contribution
      await page.click('button:has-text("Contribute to Pool")');
      
      await expect(page.locator('text=Transaction Pending')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });

      // Mock success
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transactionComplete', {
          detail: { success: true, txHash: '0xpool123' }
        }));
      });

      await expect(page.locator('text=Pool Contribution Successful')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      await expect(page.locator('text=Your new share: 5.2%')).toBeVisible();
    });