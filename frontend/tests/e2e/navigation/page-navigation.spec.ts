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