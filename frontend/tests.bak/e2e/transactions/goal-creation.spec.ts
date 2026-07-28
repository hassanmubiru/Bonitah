/**
 * E2E Tests for Goal Creation and Management
 * 
 * Tests the complete goal creation and management flow including:
 * - Goal creation with validation
 * - Goal contribution transactions
 * - Goal progress tracking and updates
 * - Goal completion and locked savings
 */

import { expect } from '@playwright/test';
import { test, setupAuthenticatedUser, resetBrowserState, TIMEOUTS, TEST_DATA } from '../utils/fixtures';

test.describe('Goal Creation and Management', () => {
  test.beforeEach(async ({ page, mockWallet }) => {
    await resetBrowserState(page);
    
    // Mock goals API endpoints
    await page.route('**/api/goals', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            goals: [
              {
                id: 1,
                name: 'Emergency Fund',
                target: '1000',
                current: '250',
                description: '6 months of expenses',
                createdAt: '2024-01-01T00:00:00Z',
                status: 'active'
              }
            ]
          })
        });
      } else if (route.request().method() === 'POST') {
        const body = await route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 2,
            name: body.name,
            target: body.target,
            current: '0',
            description: body.description,
            createdAt: new Date().toISOString(),
            status: 'active'
          })
        });
      }
    });

    await page.route('**/api/goals/*/contribute', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          newTotal: '350'
        })
      });
    });
  });

  test.describe('Goal Creation', () => {
    test('should create a new savings goal successfully', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Navigate to goals page (may be part of savings or separate page)
      await page.goto('/goals');
      await page.waitForLoadState('networkidle');

      // Click create new goal
      await page.click('button:has-text("Create Goal")');
      
      // Should show goal creation form
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('text=Create New Goal')).toBeVisible();

      // Fill in goal details
      const goalData = TEST_DATA.goals.emergencyFund;
      await page.fill('input[name="goalName"]', goalData.name);
      await page.fill('input[name="targetAmount"]', goalData.target);
      await page.fill('textarea[name="description"]', goalData.description);

      // Submit form
      await page.click('button:has-text("Create Goal")');

      // Should show success message
      await expect(page.locator('text=Goal created successfully')).toBeVisible({ timeout: TIMEOUTS.API_RESPONSE });
      
      // Should close modal and show new goal in list
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
      await expect(page.locator(`text=${goalData.name}`)).toBeVisible();
      await expect(page.locator(`text=$${goalData.target}`)).toBeVisible();
      await expect(page.locator(`text=${goalData.description}`)).toBeVisible();
    });

    test('should validate goal creation form inputs', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/goals');

      await page.click('button:has-text("Create Goal")');

      // Test empty name validation
      await page.click('button:has-text("Create Goal")');
      await expect(page.locator('text=Goal name is required')).toBeVisible();

      // Fill name but leave target empty
      await page.fill('input[name="goalName"]', 'Test Goal');
      await page.click('button:has-text("Create Goal")');
      await expect(page.locator('text=Target amount is required')).toBeVisible();

      // Test minimum target amount
      await page.fill('input[name="targetAmount"]', '0');
      await expect(page.locator('text=Target must be greater than 0')).toBeVisible();

      // Test maximum target amount
      await page.fill('input[name="targetAmount"]', '1000000');
      await expect(page.locator('text=Target amount is too large')).toBeVisible();

      // Test valid inputs
      await page.fill('input[name="targetAmount"]', '1000');
      await page.fill('textarea[name="description"]', 'Valid goal description');
      
      // Create button should be enabled
      await expect(page.locator('button:has-text("Create Goal")')).toBeEnabled();
    });

    test('should handle goal creation failures', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/goals');

      // Mock API failure
      await page.route('**/api/goals', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Goal with this name already exists'
            })
          });
        }
      });

      await page.click('button:has-text("Create Goal")');
      
      // Fill form with duplicate name
      await page.fill('input[name="goalName"]', 'Emergency Fund'); // Already exists
      await page.fill('input[name="targetAmount"]', '2000');
      await page.fill('textarea[name="description"]', 'Another emergency fund');

      await page.click('button:has-text("Create Goal")');

      // Should show error message
      await expect(page.locator('text=Goal with this name already exists')).toBeVisible({ timeout: TIMEOUTS.API_RESPONSE });
      
      // Form should remain open for correction
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });

    test('should support different goal categories', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/goals');

      await page.click('button:has-text("Create Goal")');

      // Test category selection if available
      if (await page.isVisible('select[name="category"]')) {
        await page.selectOption('select[name="category"]', 'emergency');
        await page.selectOption('select[name="category"]', 'vacation');
        await page.selectOption('select[name="category"]', 'investment');
        await page.selectOption('select[name="category"]', 'other');
      }

      // Should be able to create goals with different categories
      const categories = ['Emergency Fund', 'Vacation Fund', 'Investment Goal'];
      
      for (let i = 0; i < categories.length; i++) {
        await page.fill('input[name="goalName"]', categories[i]);
        await page.fill('input[name="targetAmount"]', (1000 * (i + 1)).toString());
        await page.fill('textarea[name="description"]', `Description for ${categories[i]}`);
        
        await page.click('button:has-text("Create Goal")');
        
        // Should create successfully
        await expect(page.locator('text=Goal created successfully')).toBeVisible();
        
        // Open form for next goal if not last
        if (i < categories.length - 1) {
          await page.click('button:has-text("Create Goal")');
        }
      }
    });
  });

  test.describe('Goal Contribution', () => {
    test('should contribute to existing goal successfully', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/goals');

      // Wait for goals to load
      await expect(page.locator('text=Emergency Fund')).toBeVisible();

      // Click contribute button on existing goal
      await page.click('button:has-text("Contribute")');
      
      // Should show contribution modal
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('text=Contribute to Emergency Fund')).toBeVisible();

      // Fill contribution amount
      const contributionAmount = '100';
      await page.fill('input[name="contributionAmount"]', contributionAmount);

      // Should show progress preview
      await expect(page.locator('text=New progress: $350 / $1000 (35%)')).toBeVisible();

      // Submit contribution
      await page.click('button:has-text("Contribute")');

      // Should show transaction confirmation
      await expect(page.locator('text=Confirm Contribution')).toBeVisible();
      await expect(page.locator(`text=${contributionAmount} ETH`)).toBeVisible();

      // Confirm transaction
      await page.click('button:has-text("Confirm Transaction")');

      // Should show transaction pending state
      await expect(page.locator('text=Transaction Pending')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });

      // Mock successful transaction
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transactionComplete', {
          detail: {
            success: true,
            txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
          }
        }));
      });

      // Should show success and update goal progress
      await expect(page.locator('text=Contribution Successful')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      await expect(page.locator('text=$350 / $1000')).toBeVisible();
    });

    test('should validate contribution amounts', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/goals');

      await expect(page.locator('text=Emergency Fund')).toBeVisible();
      await page.click('button:has-text("Contribute")');

      // Test minimum contribution
      await page.fill('input[name="contributionAmount"]', '0.001');
      await expect(page.locator('text=Minimum contribution is 0.01 ETH')).toBeVisible();

      // Test maximum contribution (shouldn't exceed remaining goal amount)
      await page.fill('input[name="contributionAmount"]', '1000');
      await expect(page.locator('text=Amount exceeds remaining goal target')).toBeVisible();

      // Test valid contribution
      await page.fill('input[name="contributionAmount"]', '50');
      await expect(page.locator('button:has-text("Contribute")')).toBeEnabled();
    });

    test('should handle contribution transaction failures', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/goals');

      // Mock transaction failure
      await mockWallet.rejectSigning();

      await expect(page.locator('text=Emergency Fund')).toBeVisible();
      await page.click('button:has-text("Contribute")');
      await page.fill('input[name="contributionAmount"]', '100');
      await page.click('button:has-text("Contribute")');
      await page.click('button:has-text("Confirm Transaction")');

      // Should show transaction rejection error
      await expect(page.locator('text=Transaction rejected by user')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      
      // Should offer retry option
      await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
    });

    test('should show accurate progress calculation', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/goals');

      await expect(page.locator('text=Emergency Fund')).toBeVisible();
      
      // Should show current progress (25% = $250 / $1000)
      await expect(page.locator('text=25%')).toBeVisible();
      await expect(page.locator('text=$250 / $1000')).toBeVisible();

      // Open contribution modal
      await page.click('button:has-text("Contribute")');

      // Test different contribution amounts and preview
      const testAmounts = [
        { amount: '100', expectedProgress: '35%', expectedTotal: '$350' },
        { amount: '250', expectedProgress: '50%', expectedTotal: '$500' },
        { amount: '750', expectedProgress: '100%', expectedTotal: '$1000' }
      ];

      for (const test of testAmounts) {
        await page.fill('input[name="contributionAmount"]', test.amount);
        await expect(page.locator(`text=${test.expectedProgress}`)).toBeVisible();
        await expect(page.locator(`text=${test.expectedTotal}`)).toBeVisible();
      }
    });
  });

  test.describe('Goal Completion and Locking', () => {
    test('should handle goal completion', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);

      // Mock a goal that's almost complete
      await page.route('**/api/goals', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              goals: [
                {
                  id: 1,
                  name: 'Emergency Fund',
                  target: '1000',
                  current: '950', // Almost complete
                  description: '6 months of expenses',
                  createdAt: '2024-01-01T00:00:00Z',
                  status: 'active'
                }
              ]
            })
          });
        }
      });

      await page.goto('/goals');
      
      // Should show near-complete goal
      await expect(page.locator('text=$950 / $1000')).toBeVisible();
      await expect(page.locator('text=95%')).toBeVisible();

      // Make final contribution
      await page.click('button:has-text("Contribute")');
      await page.fill('input[name="contributionAmount"]', '50');
      
      // Should indicate goal will be completed
      await expect(page.locator('text=This will complete your goal!')).toBeVisible();
      
      await page.click('button:has-text("Contribute")');
      await page.click('button:has-text("Confirm Transaction")');

      // Mock successful completion transaction
      await page.route('**/api/goals/*/contribute', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            txHash: '0xabcdef123456',
            newTotal: '1000',
            goalCompleted: true,
            lockingOptions: ['3_months', '6_months', '12_months']
          })
        });
      });

      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transactionComplete', {
          detail: { success: true, txHash: '0xabcdef123456' }
        }));
      });

      // Should show goal completion celebration
      await expect(page.locator('text=🎉 Goal Completed!')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      await expect(page.locator('text=Emergency Fund has been completed')).toBeVisible();
      
      // Should offer locking options
      await expect(page.locator('text=Lock your savings for additional rewards?')).toBeVisible();
      await expect(page.locator('text=3 months')).toBeVisible();
      await expect(page.locator('text=6 months')).toBeVisible();
      await expect(page.locator('text=12 months')).toBeVisible();
    });

    test('should allow locking completed goal funds', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock completed goal state
      await page.goto('/goals?completed=true');
      
      // Simulate goal completion flow leading to locking options
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('goalCompleted', {
          detail: {
            goalId: 1,
            goalName: 'Emergency Fund',
            amount: '1000',
            lockingOptions: ['3_months', '6_months', '12_months']
          }
        }));
      });

      // Should show locking options modal
      await expect(page.locator('text=Lock your savings')).toBeVisible();
      await expect(page.locator('text=Choose lock period:')).toBeVisible();

      // Select 6 months locking period
      await page.click('input[value="6_months"]');
      
      // Should show locking benefits
      await expect(page.locator('text=+2% APY bonus')).toBeVisible();
      await expect(page.locator('text=Unlock date:')).toBeVisible();

      // Confirm locking
      await page.click('button:has-text("Lock Funds")');

      // Mock locking transaction
      await page.route('**/api/goals/*/lock', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            txHash: '0xlock123456',
            lockPeriod: '6_months',
            unlockDate: '2024-07-01T00:00:00Z',
            bonusRate: '2'
          })
        });
      });

      // Should show locking confirmation
      await expect(page.locator('text=Confirm Lock Transaction')).toBeVisible();
      await page.click('button:has-text("Confirm Lock")');

      // Should show transaction success
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transactionComplete', {
          detail: { success: true, txHash: '0xlock123456' }
        }));
      });

      await expect(page.locator('text=Funds Locked Successfully')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      await expect(page.locator('text=Unlock date: July 1, 2024')).toBeVisible();
    });

    test('should allow skipping locking for immediate access', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Simulate goal completion
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('goalCompleted', {
          detail: {
            goalId: 1,
            goalName: 'Emergency Fund',
            amount: '1000',
            lockingOptions: ['3_months', '6_months', '12_months']
          }
        }));
      });

      // Should show locking options
      await expect(page.locator('text=Lock your savings')).toBeVisible();

      // Choose to skip locking
      await page.click('button:has-text("Skip - Keep Unlocked")');

      // Should confirm the choice
      await expect(page.locator('text=Funds remain available for immediate withdrawal')).toBeVisible();
      await expect(page.locator('text=Goal completed and funds unlocked')).toBeVisible();

      // Goal should show as completed but unlocked
      await expect(page.locator('text=Completed')).toBeVisible();
      await expect(page.locator('text=Available for withdrawal')).toBeVisible();
    });
  });

  test.describe('Goal Management and Editing', () => {
    test('should allow editing goal details', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/goals');

      // Look for edit button on existing goal
      if (await page.isVisible('button:has-text("Edit")')) {
        await page.click('button:has-text("Edit")');

        // Should show edit form
        await expect(page.locator('text=Edit Goal')).toBeVisible();

        // Modify goal details
        await page.fill('input[name="goalName"]', 'Updated Emergency Fund');
        await page.fill('textarea[name="description"]', 'Updated description');

        // Save changes
        await page.click('button:has-text("Save Changes")');

        // Should show success message
        await expect(page.locator('text=Goal updated successfully')).toBeVisible();
        await expect(page.locator('text=Updated Emergency Fund')).toBeVisible();
      }
    });

    test('should allow deleting incomplete goals', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/goals');

      // Look for delete option
      if (await page.isVisible('button:has-text("Delete")')) {
        await page.click('button:has-text("Delete")');

        // Should show confirmation dialog
        await expect(page.locator('text=Delete Goal')).toBeVisible();
        await expect(page.locator('text=Are you sure?')).toBeVisible();
        await expect(page.locator('text=This action cannot be undone')).toBeVisible();

        // Mock delete API
        await page.route('**/api/goals/*', async (route) => {
          if (route.request().method() === 'DELETE') {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true })
            });
          }
        });

        // Confirm deletion
        await page.click('button:has-text("Delete Goal")');

        // Should show success and remove goal from list
        await expect(page.locator('text=Goal deleted successfully')).toBeVisible();
        await expect(page.locator('text=Emergency Fund')).not.toBeVisible();
      }
    });

    test('should show goal history and transactions', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await page.goto('/goals');

      // Mock goal history endpoint
      await page.route('**/api/goals/*/history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transactions: [
              {
                id: 1,
                type: 'contribution',
                amount: '100',
                timestamp: '2024-01-15T10:00:00Z',
                txHash: '0xabc123'
              },
              {
                id: 2,
                type: 'contribution',
                amount: '150',
                timestamp: '2024-01-20T15:30:00Z',
                txHash: '0xdef456'
              }
            ]
          })
        });
      });

      // Click on goal to view details
      if (await page.isVisible('text=Emergency Fund')) {
        await page.click('text=Emergency Fund');

        // Should show goal details with history
        await expect(page.locator('text=Transaction History')).toBeVisible();
        await expect(page.locator('text=+$100')).toBeVisible();
        await expect(page.locator('text=+$150')).toBeVisible();
        await expect(page.locator('text=Jan 15, 2024')).toBeVisible();
        await expect(page.locator('text=Jan 20, 2024')).toBeVisible();
      }
    });
  });
});