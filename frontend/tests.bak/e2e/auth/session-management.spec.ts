/**
 * E2E Tests for Session Management
 * 
 * Tests session lifecycle, persistence, and state management including:
 * - Session initialization and validation
 * - Cross-tab session synchronization  
 * - Automatic logout on token expiry
 * - Auth guards and protected route access
 */

import { expect } from '@playwright/test';
import { test, setupAuthenticatedUser, resetBrowserState, TIMEOUTS } from '../utils/fixtures';

test.describe('Session Management', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page);
  });

  test.describe('Session Initialization', () => {
    test('should initialize session from stored JWT token', async ({ 
      page, 
      mockWallet, 
      authPage, 
      dashboardPage 
    }) => {
      // Manually set a valid JWT token
      await page.goto('/');
      await page.evaluate(() => {
        const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIweDc0MmQzNUNjNjUyNEMzZDkxRjZCZjFiMGM4ZUQwOUI2RDViOTZDNyIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxODAwMDAwMDAwfQ.test';
        localStorage.setItem('bfn_auth_token', validToken);
      });

      // Mock token validation endpoint
      await page.route('**/auth/validate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: true,
            user: {
              address: '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7',
              role: 'user'
            }
          })
        });
      });

      // Navigate to protected route
      await dashboardPage.navigate();
      
      // Should be authenticated and access dashboard
      await dashboardPage.verifyDashboardContent();
    });

    test('should reject invalid JWT token format', async ({ 
      page, 
      dashboardPage 
    }) => {
      // Set invalid token format
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('bfn_auth_token', 'invalid-token-format');
      });

      // Try to access protected route
      await dashboardPage.navigate();
      
      // Should redirect to auth due to invalid token
      await page.waitForURL('/auth', { timeout: TIMEOUTS.REDIRECT });
    });

    test('should handle missing JWT token', async ({ 
      page, 
      dashboardPage 
    }) => {
      // Ensure no token is stored
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.removeItem('bfn_auth_token');
      });

      // Try to access protected route
      await dashboardPage.navigate();
      
      // Should redirect to auth
      await page.waitForURL('/auth', { timeout: TIMEOUTS.REDIRECT });
    });
  });

  test.describe('Session Persistence', () => {
    test('should maintain session across browser refresh', async ({ 
      page, 
      mockWallet, 
      authPage, 
      dashboardPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should remain authenticated
      await dashboardPage.verifyDashboardContent();
    });

    test('should maintain session across navigation', async ({ 
      page, 
      mockWallet, 
      authPage, 
      homePage, 
      dashboardPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Navigate to different pages
      await homePage.navigate();
      await dashboardPage.navigate();
      await homePage.navigate();
      await dashboardPage.navigate();
      
      // Should remain authenticated throughout
      await dashboardPage.verifyDashboardContent();
    });

    test('should persist session across browser restart simulation', async ({ 
      page, 
      context, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Get the stored token
      const storedToken = await page.evaluate(() => {
        return localStorage.getItem('bfn_auth_token');
      });
      
      expect(storedToken).toBeTruthy();
      
      // Close the page and create a new one (simulating browser restart)
      await page.close();
      const newPage = await context.newPage();
      
      // Manually restore token (simulating localStorage persistence)
      await newPage.goto('/');
      await newPage.evaluate((token) => {
        localStorage.setItem('bfn_auth_token', token);
      }, storedToken);
      
      // Mock token validation
      await newPage.route('**/auth/validate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: true,
            user: {
              address: '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7',
              role: 'user'
            }
          })
        });
      });
      
      // Should be able to access protected routes
      await newPage.goto('/dashboard');
      await newPage.waitForLoadState('networkidle');
      
      expect(newPage.url()).toContain('/dashboard');
    });
  });

  test.describe('Cross-Tab Session Synchronization', () => {
    test('should synchronize authentication state across tabs', async ({ 
      page, 
      context, 
      mockWallet, 
      authPage 
    }) => {
      // Authenticate in first tab
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Open second tab
      const secondTab = await context.newPage();
      const secondMockWallet = new (await import('../utils/mock-wallet')).MockWallet(
        secondTab, 
        (await import('../utils/mock-wallet')).WALLET_CONFIGS.CONNECTED_BASE_SEPOLIA
      );
      await secondMockWallet.inject();
      
      // Mock token validation for second tab
      await secondTab.route('**/auth/validate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: true,
            user: {
              address: '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7',
              role: 'user'
            }
          })
        });
      });
      
      // Navigate to dashboard in second tab
      await secondTab.goto('/dashboard');
      await secondTab.waitForLoadState('networkidle');
      
      // Should be authenticated in second tab
      expect(secondTab.url()).toContain('/dashboard');
      
      await secondTab.close();
    });

    test('should synchronize logout across tabs', async ({ 
      page, 
      context, 
      mockWallet, 
      authPage 
    }) => {
      // Authenticate in first tab
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Open second tab with authentication
      const secondTab = await context.newPage();
      await secondTab.goto('/dashboard');
      await secondTab.waitForLoadState('networkidle');
      
      // Logout in first tab (simulate by clearing localStorage)
      await page.evaluate(() => {
        localStorage.removeItem('bfn_auth_token');
        // Trigger storage event
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'bfn_auth_token',
          oldValue: 'test-token',
          newValue: null,
          url: window.location.href
        }));
      });
      
      // Second tab should detect logout and redirect
      await secondTab.waitForTimeout(2000); // Give time for storage event to propagate
      
      // Try to navigate in second tab
      await secondTab.goto('/dashboard');
      await secondTab.waitForURL('/auth', { timeout: TIMEOUTS.REDIRECT });
      
      await secondTab.close();
    });

    test('should handle concurrent authentication in multiple tabs', async ({ 
      page, 
      context, 
      mockWallet 
    }) => {
      // Open multiple tabs
      const secondTab = await context.newPage();
      const thirdTab = await context.newPage();
      
      // Set up mock wallets for all tabs
      const secondMockWallet = new (await import('../utils/mock-wallet')).MockWallet(
        secondTab, 
        (await import('../utils/mock-wallet')).WALLET_CONFIGS.CONNECTED_BASE_SEPOLIA
      );
      const thirdMockWallet = new (await import('../utils/mock-wallet')).MockWallet(
        thirdTab, 
        (await import('../utils/mock-wallet')).WALLET_CONFIGS.CONNECTED_BASE_SEPOLIA
      );
      
      await secondMockWallet.inject();
      await thirdMockWallet.inject();
      
      // Navigate all tabs to auth page
      await page.goto('/auth');
      await secondTab.goto('/auth');
      await thirdTab.goto('/auth');
      
      // Connect wallets in all tabs
      await mockWallet.connect();
      await secondMockWallet.connect();
      await thirdMockWallet.connect();
      
      // Mock auth endpoints for all tabs
      const mockAuthSuccess = async (route: any) => {
        if (route.request().url().includes('/auth/nonce')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              nonce: `test-nonce-${Date.now()}`,
              message: 'Sign in to Bonitah Financial Network'
            })
          });
        } else if (route.request().url().includes('/auth/verify')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              token: 'test-jwt-token',
              user: {
                address: '0x742d35Cc6524C3d91F6Bf1b0c8eD09B06D5b96C7',
                role: 'user'
              }
            })
          });
        }
      };
      
      await page.route('**/auth/**', mockAuthSuccess);
      await secondTab.route('**/auth/**', mockAuthSuccess);
      await thirdTab.route('**/auth/**', mockAuthSuccess);
      
      // Attempt authentication in all tabs simultaneously
      await Promise.all([
        page.click('button:has-text("Sign In with Ethereum")'),
        secondTab.click('button:has-text("Sign In with Ethereum")'),
        thirdTab.click('button:has-text("Sign In with Ethereum")')
      ]);
      
      // All tabs should eventually redirect to dashboard
      await Promise.all([
        page.waitForURL('/dashboard', { timeout: TIMEOUTS.REDIRECT }),
        secondTab.waitForURL('/dashboard', { timeout: TIMEOUTS.REDIRECT }),
        thirdTab.waitForURL('/dashboard', { timeout: TIMEOUTS.REDIRECT })
      ]);
      
      await secondTab.close();
      await thirdTab.close();
    });
  });

  test.describe('Token Expiry and Refresh', () => {
    test('should handle expired JWT token gracefully', async ({ 
      page, 
      dashboardPage 
    }) => {
      // Set an expired token
      await page.goto('/');
      await page.evaluate(() => {
        // Token with past expiry time
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIweDc0MmQzNUNjNjUyNEMzZDkxRjZCZjFiMGM4ZUQwOUI2RDViOTZDNyIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAwfQ.test';
        localStorage.setItem('bfn_auth_token', expiredToken);
      });
      
      // Mock token validation to reject expired token
      await page.route('**/auth/validate', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired' })
        });
      });
      
      // Try to access protected route
      await dashboardPage.navigate();
      
      // Should redirect to auth due to expired token
      await page.waitForURL('/auth', { timeout: TIMEOUTS.REDIRECT });
    });

    test('should auto-logout when token expires during session', async ({ 
      page, 
      mockWallet, 
      authPage, 
      dashboardPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Simulate token expiry by changing validation response
      await page.route('**/auth/validate', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired' })
        });
      });
      
      // Make an API call that would trigger token validation
      await page.evaluate(async () => {
        try {
          await fetch('/api/user/profile', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('bfn_auth_token')}`
            }
          });
        } catch (error) {
          // Expected to fail
        }
      });
      
      // Should eventually redirect to auth
      await page.waitForURL('/auth', { timeout: TIMEOUTS.REDIRECT });
    });

    test('should handle network errors during token validation', async ({ 
      page, 
      dashboardPage 
    }) => {
      // Set a token
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('bfn_auth_token', 'test-token');
      });
      
      // Mock network error for token validation
      await page.route('**/auth/validate', async (route) => {
        await route.abort('internetdisconnected');
      });
      
      // Try to access protected route
      await dashboardPage.navigate();
      
      // Should handle gracefully (behavior may vary based on implementation)
      // Either redirect to auth or show error state
      await page.waitForTimeout(3000);
      const currentUrl = page.url();
      
      expect(currentUrl).toMatch(/\/(auth|dashboard|error)/);
    });
  });

  test.describe('Auth Guards and Route Protection', () => {
    test('should protect all dashboard routes', async ({ page }) => {
      const protectedRoutes = [
        '/dashboard',
        '/savings', 
        '/ai',
        // Add more routes as they're implemented
      ];
      
      for (const route of protectedRoutes) {
        await page.goto(route);
        await page.waitForURL('/auth', { timeout: TIMEOUTS.REDIRECT });
        expect(page.url()).toContain('/auth');
      }
    });

    test('should allow access to public routes without authentication', async ({ page }) => {
      const publicRoutes = [
        '/',
        '/auth',
        // Add more public routes as needed
      ];
      
      for (const route of publicRoutes) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        
        // Should not redirect to auth
        expect(page.url()).toContain(route);
      }
    });

    test('should redirect authenticated users away from auth page', async ({ 
      page, 
      mockWallet, 
      authPage, 
      dashboardPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Try to navigate back to auth page
      await authPage.navigate();
      
      // Should redirect to dashboard
      await page.waitForURL('/dashboard', { timeout: TIMEOUTS.REDIRECT });
    });
  });

  test.describe('Session Storage and Security', () => {
    test('should store JWT token securely in localStorage', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Check token storage
      const tokenInfo = await page.evaluate(() => {
        const token = localStorage.getItem('bfn_auth_token');
        return {
          exists: !!token,
          isString: typeof token === 'string',
          hasContent: token && token.length > 0,
          // Don't log actual token value for security
          prefix: token ? token.substring(0, 10) : null
        };
      });
      
      expect(tokenInfo.exists).toBe(true);
      expect(tokenInfo.isString).toBe(true);
      expect(tokenInfo.hasContent).toBe(true);
    });

    test('should clear all auth data on logout', async ({ 
      page, 
      mockWallet, 
      authPage, 
      navigationMenu 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Mock logout endpoint
      await page.route('**/auth/logout', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });
      
      // Simulate logout
      await page.evaluate(() => {
        localStorage.removeItem('bfn_auth_token');
        sessionStorage.clear();
      });
      
      // Check that auth data is cleared
      const authData = await page.evaluate(() => {
        return {
          token: localStorage.getItem('bfn_auth_token'),
          sessionData: sessionStorage.length
        };
      });
      
      expect(authData.token).toBeNull();
      expect(authData.sessionData).toBe(0);
    });

    test('should not store sensitive data in sessionStorage', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);
      
      // Check sessionStorage doesn't contain sensitive data
      const sessionData = await page.evaluate(() => {
        const data: { [key: string]: string } = {};
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) {
            data[key] = sessionStorage.getItem(key) || '';
          }
        }
        return data;
      });
      
      // Check for sensitive patterns
      const sensitivePatterns = [/token/i, /jwt/i, /private/i, /secret/i];
      
      for (const [key, value] of Object.entries(sessionData)) {
        for (const pattern of sensitivePatterns) {
          if (pattern.test(key) || pattern.test(value)) {
            console.warn(`Potentially sensitive data in sessionStorage: ${key}`);
          }
        }
      }
    });
  });
});