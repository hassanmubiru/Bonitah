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
    test('should withdraw from investment pool', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock user having pool investment
      await page.route('**/api/community/pools/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            name: 'Stablecoin Yield Pool',
            userInvestment: '1000',
            userShare: '2.5',
            accruedReturns: '42.50',
            withdrawable: true
          })
        });
      });

      await page.goto('/community/pools/1');

      // Should show user investment details
      await expect(page.locator('text=Your investment: $1,000')).toBeVisible();
      await expect(page.locator('text=Accrued returns: $42.50')).toBeVisible();
      
      // Click withdraw
      await page.click('button:has-text("Withdraw")');
      
      // Should show withdrawal options
      await expect(page.locator('text=Withdraw from Pool')).toBeVisible();
      await expect(page.locator('text=Principal + Returns: $1,042.50')).toBeVisible();
      
      // Choose partial withdrawal
      await page.fill('input[name="withdrawAmount"]', '500');
      
      // Confirm withdrawal
      await page.click('button:has-text("Withdraw Funds")');
      
      await expect(page.locator('text=Transaction Pending')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });

      // Mock successful withdrawal
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transactionComplete', {
          detail: { success: true, txHash: '0xwithdraw123' }
        }));
      });

      await expect(page.locator('text=Withdrawal Successful')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
    });
  });

  test.describe('Community Governance', () => {
    test('should display community proposals', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock governance proposals
      await page.route('**/api/governance/proposals', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            proposals: [
              {
                id: 1,
                title: 'Increase Pool APY Cap',
                description: 'Proposal to increase maximum APY for investment pools',
                status: 'active',
                votesFor: 150,
                votesAgainst: 75,
                endDate: '2024-02-01T00:00:00Z',
                userVoted: false
              }
            ]
          })
        });
      });

      await page.goto('/community/governance');

      // Should show proposals
      await expect(page.locator('text=Community Governance')).toBeVisible();
      await expect(page.locator('text=Increase Pool APY Cap')).toBeVisible();
      await expect(page.locator('text=150 For')).toBeVisible();
      await expect(page.locator('text=75 Against')).toBeVisible();
      await expect(page.locator('text=Ends: Feb 1, 2024')).toBeVisible();
    });

    test('should vote on community proposal', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock voting endpoint
      await page.route('**/api/governance/proposals/1/vote', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            txHash: '0xvote123',
            votingPower: 10
          })
        });
      });

      await page.goto('/community/governance');

      // Click vote on proposal
      await page.click('button:has-text("Vote")');
      
      // Should show voting modal
      await expect(page.locator('text=Vote on Proposal')).toBeVisible();
      await expect(page.locator('text=Your voting power: 10')).toBeVisible();
      
      // Select vote option
      await page.click('input[value="for"]');
      await expect(page.locator('text=Voting FOR the proposal')).toBeVisible();
      
      // Submit vote
      await page.click('button:has-text("Cast Vote")');
      
      await expect(page.locator('text=Transaction Pending')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });

      // Mock successful vote
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transactionComplete', {
          detail: { success: true, txHash: '0xvote123' }
        }));
      });

      await expect(page.locator('text=Vote Cast Successfully')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      await expect(page.locator('text=You voted FOR this proposal')).toBeVisible();
    });

    test('should create governance proposal', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock proposal creation endpoint
      await page.route('**/api/governance/proposals', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 2,
              title: 'New Pool Type',
              description: 'Add cryptocurrency index pool',
              status: 'pending',
              proposalFee: '1.0'
            })
          });
        }
      });

      await page.goto('/community/governance');

      // Check if user can create proposals (based on reputation/stake)
      if (await page.isVisible('button:has-text("Create Proposal")')) {
        await page.click('button:has-text("Create Proposal")');
        
        // Should show creation form
        await expect(page.locator('text=Create New Proposal')).toBeVisible();
        await expect(page.locator('text=Proposal fee: 1.0 ETH')).toBeVisible();
        
        // Fill proposal details
        await page.fill('input[name="title"]', 'Add Cryptocurrency Index Pool');
        await page.fill('textarea[name="description"]', 'Proposal to add a new investment pool focused on major cryptocurrencies');
        
        // Submit proposal
        await page.click('button:has-text("Submit Proposal")');
        
        await expect(page.locator('text=Transaction Pending')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });

        // Mock successful proposal creation
        await page.evaluate(() => {
          window.dispatchEvent(new CustomEvent('transactionComplete', {
            detail: { success: true, txHash: '0xproposal123' }
          }));
        });

        await expect(page.locator('text=Proposal Created Successfully')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      }
    });
  });

  test.describe('Community Events and Achievements', () => {
    test('should display community events', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock community events
      await page.route('**/api/community/events', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            events: [
              {
                id: 1,
                title: 'DeFi Learning Workshop',
                description: 'Learn about yield farming strategies',
                date: '2024-01-25T18:00:00Z',
                participants: 25,
                maxParticipants: 50,
                registered: false
              }
            ]
          })
        });
      });

      await page.goto('/community/events');

      // Should show events
      await expect(page.locator('text=Community Events')).toBeVisible();
      await expect(page.locator('text=DeFi Learning Workshop')).toBeVisible();
      await expect(page.locator('text=Jan 25, 2024')).toBeVisible();
      await expect(page.locator('text=25/50 participants')).toBeVisible();
    });

    test('should register for community event', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock event registration
      await page.route('**/api/community/events/1/register', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            registrationId: 'reg123'
          })
        });
      });

      await page.goto('/community/events');

      // Register for event
      await page.click('button:has-text("Register")');
      
      // Should show registration confirmation
      await expect(page.locator('text=Event Registration')).toBeVisible();
      await page.click('button:has-text("Confirm Registration")');
      
      await expect(page.locator('text=Successfully registered for event')).toBeVisible({ timeout: TIMEOUTS.API_RESPONSE });
      await expect(page.locator('text=Registered')).toBeVisible();
    });

    test('should display community achievements', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock achievements
      await page.route('**/api/community/achievements', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            achievements: [
              {
                id: 1,
                name: 'First Contribution',
                description: 'Made your first pool contribution',
                earned: true,
                earnedDate: '2024-01-15T00:00:00Z'
              },
              {
                id: 2,
                name: 'Active Voter',
                description: 'Participated in 5 governance votes',
                earned: false,
                progress: 3,
                target: 5
              }
            ]
          })
        });
      });

      await page.goto('/community/achievements');

      // Should show achievements
      await expect(page.locator('text=Community Achievements')).toBeVisible();
      await expect(page.locator('text=First Contribution')).toBeVisible();
      await expect(page.locator('text=Earned on Jan 15')).toBeVisible();
      
      // Should show progress on incomplete achievements
      await expect(page.locator('text=Active Voter')).toBeVisible();
      await expect(page.locator('text=3/5 complete')).toBeVisible();
    });
  });
});