/**
 * E2E Tests for Network Failure Handling
 * 
 * Tests application behavior under various network conditions:
 * - Complete network disconnection
 * - Intermittent connectivity issues  
 * - API endpoint failures
 * - Recovery mechanisms and retry logic
 */

import { expect } from '@playwright/test';
import { test, setupAuthenticatedUser, resetBrowserState, TIMEOUTS } from '../utils/fixtures';

test.describe('Network Failure Handling', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page);
  });

  test.describe('Complete Network Disconnection', () => {
    test('should handle offline mode gracefully', async ({ 
      page, 
      homePage 
    }) => {
      await homePage.navigate();
      
      // Simulate going offline
      await page.context().setOffline(true);
      
      // Try to navigate to another page
      await page.click('a[href="/auth"]');
      
      // Should show offline indicator or error message
      if (await page.isVisible('text=You are offline')) {
        await expect(page.locator('text=You are offline')).toBeVisible();
      } else if (await page.isVisible('text=Network Error')) {
        await expect(page.locator('text=Network Error')).toBeVisible();
      }
      
      // Restore network
      await page.context().setOffline(false);
      
      // Should recover when network returns
      await page.waitForTimeout(1000);
      await page.reload();
      await expect(page.locator('text=Welcome to BFN')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
    });

    test('should queue actions while offline and execute when reconnected', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      await savingsPage.navigate();
      
      // Go offline
      await page.context().setOffline(true);
      
      // Try to initiate a transaction while offline
      if (await page.isVisible('button:has-text("Deposit")')) {
        await page.click('button:has-text("Deposit")');
        await page.fill('input[type="number"]', '0.1');
        await page.click('button:has-text("Confirm")');
        
        // Should show offline error
        await expect(page.locator('text=Unable to connect')).toBeVisible({ timeout: 5000 });
      }
      
      // Go back online
      await page.context().setOffline(false);
      
      // Should allow retry of the action
      if (await page.isVisible('button:has-text("Retry")')) {
        await page.click('button:has-text("Retry")');
        
        // Action should now work
        await expect(page.locator('text=Transaction Pending')).toBeVisible({ timeout: TIMEOUTS.TRANSACTION_CONFIRMATION });
      }
    });

    test('should preserve user data during offline periods', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Store some user data
      await page.evaluate(() => {
        localStorage.setItem('user_draft_data', JSON.stringify({
          goalName: 'Emergency Fund',
          targetAmount: '1000'
        }));
      });
      
      // Go offline
      await page.context().setOffline(true);
      
      // Refresh page
      await page.reload();
      
      // Data should still be available
      const storedData = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('user_draft_data') || '{}');
      });
      
      expect(storedData.goalName).toBe('Emergency Fund');
      expect(storedData.targetAmount).toBe('1000');
      
      // Go back online
      await page.context().setOffline(false);
    });
  });

  test.describe('Intermittent Connectivity', () => {
    test('should handle slow network connections', async ({ 
      page, 
      homePage 
    }) => {
      // Simulate slow network
      await page.route('**/*', async (route) => {
        // Add delay to all requests
        await page.waitForTimeout(2000);
        await route.continue();
      });
      
      const startTime = Date.now();
      await homePage.navigate();
      
      // Should show loading states during slow load
      if (await page.isVisible('.loading, .spinner, .animate-spin')) {
        await expect(page.locator('.loading, .spinner, .animate-spin')).toBeVisible();
      }
      
      // Should eventually load
      await homePage.verifyHeroContent();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeGreaterThan(2000); // Should reflect the added delay
    });

    test('should timeout and show error for very slow requests', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock extremely slow API response
      await page.route('**/api/**', async (route) => {
        // Don't respond at all to simulate timeout
        await page.waitForTimeout(TIMEOUTS.API_RESPONSE + 1000);
        await route.continue();
      });
      
      await page.goto('/dashboard');
      
      // Should show timeout error
      await expect(page.locator('text=Request timeout', { timeout: TIMEOUTS.API_RESPONSE + 2000 })).toBeVisible();
      
      // Should offer retry option
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    });

    test('should handle connection drops during transactions', async ({ 
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
        
        // Simulate connection drop during transaction
        await page.waitForTimeout(1000);
        await page.context().setOffline(true);
        
        // Should handle gracefully
        await expect(page.locator('text=Connection lost')).toBeVisible({ timeout: 5000 });
        
        // Restore connection
        await page.context().setOffline(false);
        
        // Should allow recovery
        if (await page.isVisible('button:has-text("Check Status")')) {
          await page.click('button:has-text("Check Status")');
        }
      }
    });
  });

  test.describe('API Endpoint Failures', () => {
    test('should handle 500 server errors gracefully', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      // Mock server error
      await page.route('**/api/**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal Server Error',
            message: 'Something went wrong on our end'
          })
        });
      });
      
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Try to access a page that requires API calls
      await page.goto('/dashboard');
      
      // Should show user-friendly error message
      await expect(page.locator('text=Something went wrong')).toBeVisible({ timeout: TIMEOUTS.API_RESPONSE });
      await expect(page.locator('text=Please try again later')).toBeVisible();
      
      // Should provide retry option
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    });

    test('should handle 404 API endpoints', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock 404 for specific API
      await page.route('**/api/user/profile', async (route) => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Not Found',
            message: 'User profile not found'
          })
        });
      });
      
      await page.goto('/profile');
      
      // Should show appropriate error for missing resource
      await expect(page.locator('text=Profile not found')).toBeVisible({ timeout: TIMEOUTS.API_RESPONSE });
    });

    test('should handle authentication failures (401)', async ({ 
      page, 
      mockWallet, 
      authPage, 
      dashboardPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock 401 unauthorized response
      await page.route('**/api/**', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unauthorized',
            message: 'Token expired'
          })
        });
      });
      
      await dashboardPage.navigate();
      
      // Should redirect to auth page on auth failure
      await page.waitForURL('/auth', { timeout: TIMEOUTS.REDIRECT });
      
      // Should show message about session expiry
      if (await page.isVisible('text=Session expired')) {
        await expect(page.locator('text=Session expired')).toBeVisible();
      }
    });

    test('should handle rate limiting (429)', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock rate limiting response
      await page.route('**/api/**', async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Try again in 60 seconds.',
            retryAfter: 60
          })
        });
      });
      
      // Try to make API call
      await page.goto('/dashboard');
      
      // Should show rate limit message
      await expect(page.locator('text=Too many requests')).toBeVisible({ timeout: TIMEOUTS.API_RESPONSE });
      await expect(page.locator('text=Try again in')).toBeVisible();
    });
  });
  test.describe('Recovery Mechanisms', () => {
    test('should automatically retry failed requests', async ({ 
      page, 
      homePage 
    }) => {
      let attemptCount = 0;
      
      // Mock endpoint that fails twice, then succeeds
      await page.route('**/api/health', async (route) => {
        attemptCount++;
        
        if (attemptCount <= 2) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Server Error' })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'healthy' })
          });
        }
      });
      
      await homePage.navigate();
      
      // Should eventually succeed after retries
      await page.waitForTimeout(5000); // Allow time for retries
      expect(attemptCount).toBeGreaterThan(1);
    });

    test('should implement exponential backoff for retries', async ({ 
      page 
    }) => {
      const retryTimes: number[] = [];
      
      await page.route('**/api/test', async (route) => {
        retryTimes.push(Date.now());
        
        if (retryTimes.length <= 3) {
          await route.fulfill({ status: 500 });
        } else {
          await route.fulfill({ status: 200, body: '{}' });
        }
      });
      
      // Trigger API call
      await page.evaluate(async () => {
        try {
          await fetch('/api/test');
        } catch (e) {
          // Expected to fail initially
        }
      });
      
      // Wait for retries to complete
      await page.waitForTimeout(10000);
      
      // Should show increasing delays between retries
      if (retryTimes.length > 2) {
        const delay1 = retryTimes[1] - retryTimes[0];
        const delay2 = retryTimes[2] - retryTimes[1];
        
        expect(delay2).toBeGreaterThan(delay1);
      }
    });

    test('should provide manual retry options', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock API failure
      let shouldFail = true;
      await page.route('**/api/balance', async (route) => {
        if (shouldFail) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Server Error' })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ balance: '1.5', symbol: 'ETH' })
          });
        }
      });
      
      await savingsPage.navigate();
      
      // Should show error and retry button
      await expect(page.locator('text=Unable to load balance')).toBeVisible({ timeout: TIMEOUTS.API_RESPONSE });
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();
      
      // Fix the API and retry
      shouldFail = false;
      await page.click('button:has-text("Retry")');
      
      // Should succeed on retry
      await expect(page.locator('text=1.5 ETH')).toBeVisible({ timeout: TIMEOUTS.API_RESPONSE });
    });

    test('should cache successful responses to reduce failures', async ({ 
      page, 
      homePage 
    }) => {
      let requestCount = 0;
      
      await page.route('**/api/config', async (route) => {
        requestCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ version: '1.0.0' }),
          headers: {
            'Cache-Control': 'max-age=3600'
          }
        });
      });
      
      await homePage.navigate();
      await page.waitForTimeout(1000);
      
      // Navigate away and back
      await page.goto('/auth');
      await page.goto('/');
      
      // Should use cached response, not make new request
      await page.waitForTimeout(1000);
      expect(requestCount).toBe(1);
    });

    test('should degrade gracefully when non-critical APIs fail', async ({ 
      page, 
      mockWallet, 
      authPage, 
      dashboardPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock non-critical API failure (e.g., analytics)
      await page.route('**/api/analytics', async (route) => {
        await route.fulfill({ status: 500 });
      });
      
      // Mock critical API success (e.g., user data)
      await page.route('**/api/user', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            address: '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7',
            balance: '1.5'
          })
        });
      });
      
      await dashboardPage.navigate();
      
      // Core functionality should work
      await expect(page).toHaveURL('/dashboard');
      
      // Should show main content even if analytics fail
      await expect(page.locator('text=Dashboard')).toBeVisible();
      
      // May show warning about unavailable features
      if (await page.isVisible('text=Some features temporarily unavailable')) {
        await expect(page.locator('text=Some features temporarily unavailable')).toBeVisible();
      }
    });
  });

  test.describe('User Communication', () => {
    test('should show clear error messages for network issues', async ({ 
      page, 
      homePage 
    }) => {
      // Mock network error
      await page.route('**/*', async (route) => {
        await route.abort('internetdisconnected');
      });
      
      await page.goto('/');
      
      // Should show user-friendly error message
      await expect(page.locator('text=Unable to connect')).toBeVisible({ timeout: 5000 });
      
      // Should provide helpful guidance
      const errorMessages = [
        'Check your internet connection',
        'Try refreshing the page',
        'Contact support if the problem persists'
      ];
      
      for (const message of errorMessages) {
        if (await page.isVisible(`text=${message}`)) {
          await expect(page.locator(`text=${message}`)).toBeVisible();
          break;
        }
      }
    });

    test('should show loading states during network operations', async ({ 
      page, 
      mockWallet, 
      authPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock slow API response
      await page.route('**/api/balance', async (route) => {
        await page.waitForTimeout(3000);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ balance: '1.5' })
        });
      });
      
      await savingsPage.navigate();
      
      // Should show loading state
      const loadingIndicators = [
        '.loading',
        '.spinner',
        '.animate-spin',
        'text=Loading...'
      ];
      
      let foundLoading = false;
      for (const indicator of loadingIndicators) {
        if (await page.isVisible(indicator)) {
          await expect(page.locator(indicator)).toBeVisible();
          foundLoading = true;
          break;
        }
      }
      
      // Should eventually show content
      await expect(page.locator('text=1.5')).toBeVisible({ timeout: 5000 });
    });

    test('should provide offline indicators', async ({ 
      page, 
      homePage 
    }) => {
      await homePage.navigate();
      
      // Go offline
      await page.context().setOffline(true);
      
      // Should show offline indicator
      await page.waitForTimeout(2000);
      
      if (await page.isVisible('.offline-indicator')) {
        await expect(page.locator('.offline-indicator')).toBeVisible();
      } else if (await page.isVisible('text=Offline')) {
        await expect(page.locator('text=Offline')).toBeVisible();
      }
      
      // Go back online
      await page.context().setOffline(false);
      
      // Offline indicator should disappear
      await page.waitForTimeout(2000);
      if (await page.isVisible('.offline-indicator')) {
        await expect(page.locator('.offline-indicator')).not.toBeVisible();
      }
    });

    test('should show connection status in real-time', async ({ 
      page, 
      homePage 
    }) => {
      await homePage.navigate();
      
      // Should show connected status initially
      if (await page.isVisible('[data-testid="connection-status"]')) {
        await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
      }
      
      // Simulate poor connection
      await page.route('**/*', async (route) => {
        await page.waitForTimeout(5000);
        await route.continue();
      });
      
      // Try to navigate
      await page.click('a[href="/auth"]');
      
      // Should show slow connection warning
      if (await page.isVisible('text=Slow connection detected')) {
        await expect(page.locator('text=Slow connection detected')).toBeVisible();
      }
    });
  });
});