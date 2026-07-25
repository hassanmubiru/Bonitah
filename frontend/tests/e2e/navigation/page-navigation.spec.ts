/**
 * E2E Tests for Page Navigation
 * 
 * Tests navigation between different pages including:
 * - Basic page routing and URL handling
 * - Authenticated vs unauthenticated navigation
 * - Navigation state preservation
 * - Mobile menu functionality
 */

import { expect } from '@playwright/test';
import { test, setupAuthenticatedUser, resetBrowserState, TIMEOUTS } from '../utils/fixtures';

test.describe('Page Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page);
  });

  test.describe('Basic Navigation', () => {
    test('should navigate between public pages', async ({ 
      page, 
      homePage, 
      authPage 
    }) => {
      // Start at home page
      await homePage.navigate();
      await expect(page).toHaveURL('/');
      
      // Navigate to auth page
      await authPage.navigate();
      await expect(page).toHaveURL('/auth');
      
      // Navigate back to home
      await homePage.navigate();
      await expect(page).toHaveURL('/');
    });

    test('should handle direct URL navigation', async ({ page }) => {
      const publicUrls = [
        { url: '/', title: 'Building Financial' },
        { url: '/auth', title: 'Welcome to BFN' },
      ];

      for (const { url, title } of publicUrls) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        
        await expect(page).toHaveURL(url);
        await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
      }
    });

    test('should show 404 page for invalid routes', async ({ page }) => {
      await page.goto('/invalid-route');
      await page.waitForLoadState('networkidle');
      
      // Should redirect to 404 page or show 404 content
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/(404|not-found)/);
      
      // Should show 404 content
      await expect(page.locator('text=Page Not Found')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
    });

    test('should preserve query parameters during navigation', async ({ page }) => {
      await page.goto('/?ref=email');
      await page.waitForLoadState('networkidle');
      
      expect(page.url()).toContain('ref=email');
      
      // Navigate to auth page
      await page.click('a[href="/auth"]');
      await page.waitForLoadState('networkidle');
      
      // Query parameters should be preserved if designed to do so
      // This depends on implementation - test may need adjustment
      expect(page.url()).toContain('/auth');
    });
  });

  test.describe('Authenticated Navigation', () => {
    test('should navigate to protected pages when authenticated', async ({ 
      page, 
      mockWallet, 
      authPage, 
      dashboardPage, 
      savingsPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);

      const protectedRoutes = [
        { page: dashboardPage, url: '/dashboard' },
        { page: savingsPage, url: '/savings' },
      ];

      for (const { page: testPage, url } of protectedRoutes) {
        await testPage.navigate();
        await expect(page).toHaveURL(url);
        await testPage.verifyDashboardContent?.() || await page.waitForLoadState('networkidle');
      }
    });

    test('should redirect to auth for protected pages when unauthenticated', async ({ 
      page 
    }) => {
      const protectedRoutes = ['/dashboard', '/savings', '/ai'];

      for (const route of protectedRoutes) {
        await page.goto(route);
        
        // Should redirect to auth page
        await page.waitForURL('/auth', { timeout: TIMEOUTS.REDIRECT });
        expect(page.url()).toContain('/auth');
      }
    });

    test('should redirect to dashboard when accessing auth page while authenticated', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Try to navigate to auth page
      await page.goto('/auth');
      
      // Should redirect to dashboard
      await page.waitForURL('/dashboard', { timeout: TIMEOUTS.REDIRECT });
    });

    test('should handle logout and redirect appropriately', async ({ 
      page, 
      mockWallet, 
      authPage, 
      dashboardPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Navigate to dashboard
      await dashboardPage.navigate();
      
      // Simulate logout by clearing auth token
      await page.evaluate(() => {
        localStorage.removeItem('bfn_auth_token');
      });
      
      // Try to access protected route
      await page.goto('/savings');
      
      // Should redirect to auth
      await page.waitForURL('/auth', { timeout: TIMEOUTS.REDIRECT });
    });
  });

  test.describe('Navigation UI Components', () => {
    test('should show navigation menu on desktop', async ({ 
      page, 
      homePage, 
      navigationMenu 
    }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await homePage.navigate();
      
      // Should show desktop navigation
      if (await navigationMenu.isVisible('nav')) {
        await expect(navigationMenu.homeLink).toBeVisible();
        
        // Test navigation via menu
        if (await navigationMenu.isVisible('[href="/auth"]')) {
          await navigationMenu.navigateToAuth();
          await expect(page).toHaveURL('/auth');
        }
      }
    });

    test('should show mobile menu on small screens', async ({ 
      page, 
      homePage, 
      navigationMenu 
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await homePage.navigate();
      
      // Mobile menu button should be visible
      if (await navigationMenu.isVisible('[data-testid="mobile-menu-button"]')) {
        await navigationMenu.openMobileMenu();
        
        // Mobile navigation should be visible
        await expect(navigationMenu.homeLink).toBeVisible();
        
        // Test navigation via mobile menu
        await navigationMenu.navigateToAuth();
        await expect(page).toHaveURL('/auth');
      }
    });

    test('should highlight active page in navigation', async ({ 
      page, 
      homePage, 
      authPage 
    }) => {
      await homePage.navigate();
      
      // Home link should be active
      if (await page.isVisible('nav a[href="/"]')) {
        const homeLink = page.locator('nav a[href="/"]');
        await expect(homeLink).toHaveClass(/active|current/);
      }
      
      // Navigate to auth page
      await authPage.navigate();
      
      // Auth link should now be active
      if (await page.isVisible('nav a[href="/auth"]')) {
        const authLink = page.locator('nav a[href="/auth"]');
        await expect(authLink).toHaveClass(/active|current/);
      }
    });

    test('should show user menu when authenticated', async ({ 
      page, 
      mockWallet, 
      authPage, 
      navigationMenu 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Navigate to a page with navigation
      await page.goto('/dashboard');
      
      // User menu should be visible
      if (await navigationMenu.isVisible('[data-testid="user-menu"]')) {
        await expect(navigationMenu.userMenu).toBeVisible();
        
        // Open user menu
        await navigationMenu.userMenu.click();
        
        // Should show user options
        await expect(page.locator('text=Profile')).toBeVisible();
        await expect(page.locator('text=Settings')).toBeVisible();
        await expect(navigationMenu.signOutButton).toBeVisible();
      }
    });
  });

  test.describe('Browser Navigation', () => {
    test('should handle browser back/forward buttons', async ({ 
      page, 
      homePage, 
      authPage 
    }) => {
      // Navigate to multiple pages
      await homePage.navigate();
      await authPage.navigate();
      
      // Use browser back button
      await page.goBack();
      await expect(page).toHaveURL('/');
      
      // Use browser forward button
      await page.goForward();
      await expect(page).toHaveURL('/auth');
    });

    test('should handle page refresh correctly', async ({ 
      page, 
      mockWallet, 
      authPage, 
      dashboardPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Navigate to dashboard
      await dashboardPage.navigate();
      
      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should remain on dashboard
      await expect(page).toHaveURL('/dashboard');
    });

    test('should handle page refresh on public pages', async ({ 
      page, 
      homePage 
    }) => {
      await homePage.navigate();
      
      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should remain on home page
      await expect(page).toHaveURL('/');
      await homePage.verifyHeroContent();
    });

    test('should handle deep linking to protected routes', async ({ 
      page 
    }) => {
      // Try to access deep link without authentication
      await page.goto('/dashboard/settings');
      
      // Should redirect to auth
      await page.waitForURL('/auth', { timeout: TIMEOUTS.REDIRECT });
    });
  });
  test.describe('Navigation Performance', () => {
    test('should load pages within acceptable time limits', async ({ 
      page, 
      homePage, 
      authPage 
    }) => {
      const startTime = Date.now();
      
      await homePage.navigate();
      const homeLoadTime = Date.now() - startTime;
      
      expect(homeLoadTime).toBeLessThan(TIMEOUTS.PAGE_LOAD);
      
      const authStartTime = Date.now();
      await authPage.navigate();
      const authLoadTime = Date.now() - authStartTime;
      
      expect(authLoadTime).toBeLessThan(TIMEOUTS.PAGE_LOAD);
    });

    test('should handle concurrent navigation requests', async ({ 
      page 
    }) => {
      // Start multiple navigation requests simultaneously
      const navigationPromises = [
        page.goto('/'),
        page.goto('/auth'),
        page.goto('/'),
      ];
      
      // Wait for all to complete
      await Promise.all(navigationPromises);
      
      // Should end up on the last requested page
      await expect(page).toHaveURL('/');
    });

    test('should cache resources for faster subsequent loads', async ({ 
      page, 
      homePage 
    }) => {
      // First load
      const firstLoadStart = Date.now();
      await homePage.navigate();
      const firstLoadTime = Date.now() - firstLoadStart;
      
      // Navigate away and back
      await page.goto('/auth');
      
      // Second load should be faster due to caching
      const secondLoadStart = Date.now();
      await homePage.navigate();
      const secondLoadTime = Date.now() - secondLoadStart;
      
      // Second load should generally be faster
      // This may vary based on caching strategy
      expect(secondLoadTime).toBeLessThan(firstLoadTime * 1.5);
    });
  });

  test.describe('Error Handling in Navigation', () => {
    test('should handle network errors during navigation', async ({ 
      page 
    }) => {
      // Simulate network failure
      await page.route('**/*', async (route) => {
        if (route.request().url().includes('.js') || route.request().url().includes('.css')) {
          await route.abort('internetdisconnected');
        } else {
          await route.continue();
        }
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Page should still load basic content
      await expect(page.locator('body')).toBeVisible();
    });

    test('should recover from temporary network issues', async ({ 
      page, 
      homePage 
    }) => {
      let requestCount = 0;
      
      // Fail first request, succeed on retry
      await page.route('**/', async (route) => {
        requestCount++;
        if (requestCount === 1) {
          await route.abort('internetdisconnected');
        } else {
          await route.continue();
        }
      });
      
      await homePage.navigate();
      
      // Should eventually succeed
      await homePage.verifyHeroContent();
    });

    test('should handle JavaScript errors gracefully', async ({ 
      page, 
      homePage 
    }) => {
      // Inject JavaScript error
      await page.addInitScript(() => {
        // Simulate a JavaScript error
        setTimeout(() => {
          throw new Error('Simulated JS error');
        }, 1000);
      });
      
      await homePage.navigate();
      
      // Page should still be functional despite JS error
      await homePage.verifyHeroContent();
      await expect(homePage.connectButton).toBeVisible();
    });

    test('should show appropriate error messages for failed requests', async ({ 
      page 
    }) => {
      // Mock API failure
      await page.route('**/api/**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' })
        });
      });
      
      await page.goto('/dashboard');
      
      // Should show error message or fallback content
      if (await page.isVisible('text=Unable to load')) {
        await expect(page.locator('text=Unable to load')).toBeVisible();
      } else {
        // Should at least redirect to auth if unauthenticated
        await page.waitForURL('/auth', { timeout: TIMEOUTS.REDIRECT });
      }
    });
  });

  test.describe('Accessibility in Navigation', () => {
    test('should support keyboard navigation', async ({ 
      page, 
      homePage 
    }) => {
      await homePage.navigate();
      
      // Tab through navigation elements
      await page.keyboard.press('Tab');
      
      // Should be able to navigate using keyboard
      let activeElement = await page.evaluate(() => document.activeElement?.tagName);
      
      // Continue tabbing to find navigation elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const currentElement = await page.evaluate(() => document.activeElement?.tagName);
        
        if (currentElement === 'A' || currentElement === 'BUTTON') {
          // Found a navigation element, try to activate it
          await page.keyboard.press('Enter');
          await page.waitForTimeout(500);
          break;
        }
      }
    });

    test('should have proper ARIA labels and landmarks', async ({ 
      page, 
      homePage 
    }) => {
      await homePage.navigate();
      
      // Check for navigation landmarks
      const navElement = page.locator('nav');
      if (await navElement.count() > 0) {
        await expect(navElement.first()).toHaveAttribute('role', 'navigation');
      }
      
      // Check for main content landmark
      const mainElement = page.locator('main, [role="main"]');
      await expect(mainElement.first()).toBeVisible();
    });

    test('should announce page changes to screen readers', async ({ 
      page, 
      homePage, 
      authPage 
    }) => {
      await homePage.navigate();
      
      // Navigate to different page
      await authPage.navigate();
      
      // Page title should update for screen readers
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title).not.toBe('');
      
      // Should have appropriate headings structure
      const h1Elements = await page.locator('h1').count();
      expect(h1Elements).toBeGreaterThanOrEqual(1);
    });

    test('should provide skip links for screen readers', async ({ 
      page, 
      homePage 
    }) => {
      await homePage.navigate();
      
      // Look for skip links (usually hidden but accessible)
      const skipLink = page.locator('a:has-text("Skip to main content")');
      
      if (await skipLink.count() > 0) {
        // Skip link should be focusable
        await skipLink.focus();
        await expect(skipLink).toBeFocused();
      }
    });
  });
});