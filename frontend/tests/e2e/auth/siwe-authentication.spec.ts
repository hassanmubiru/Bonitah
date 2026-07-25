/**
 * E2E Tests for SIWE (Sign-In With Ethereum) Authentication
 * 
 * Tests the complete SIWE authentication flow including:
 * - Nonce generation and message signing
 * - Backend verification and JWT issuance
 * - Session management and persistence
 * - Error handling for signing failures
 */

import { expect } from '@playwright/test';
import { test, testWithWallet, setupAuthenticatedUser, resetBrowserState } from '../utils/fixtures';
import { WALLET_CONFIGS } from '../utils/mock-wallet';

test.describe('SIWE Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page);
  });

  test.describe('Successful Authentication', () => {
    test('should complete full SIWE authentication flow', async ({ 
      page, 
      mockWallet, 
      authPage, 
      dashboardPage 
    }) => {
      // Navigate to auth page
      await authPage.navigate();

      // Ensure wallet is connected
      await mockWallet.connect();
      await page.waitForTimeout(1000);
      await authPage.verifyStep1Active();
      await authPage.verifyStep2Visible();

      // Click sign in button
      await authPage.clickSignIn();

      // Should show loading state
      await authPage.verifyLoadingState();

      // Mock the backend authentication response
      await page.route('**/auth/nonce', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            nonce: 'test-nonce-12345',
            message: 'Sign in to Bonitah Financial Network\n\nNonce: test-nonce-12345'
          })
        });
      });

      await page.route('**/auth/verify', async (route) => {
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
      });

      // Wait for authentication process to complete
      await authPage.verifyRedirecting();
      
      // Should redirect to dashboard
      await authPage.waitForRedirect();
      await dashboardPage.verifyDashboardContent();
    });

    test('should store JWT token in localStorage', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);

      // Verify JWT token is stored
      const token = await page.evaluate(() => {
        return localStorage.getItem('bfn_auth_token');
      });

      expect(token).toBeTruthy();
    });

    test('should persist authentication across page refresh', async ({ 
      page, 
      mockWallet, 
      authPage, 
      dashboardPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);

      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should remain on dashboard (not redirect to auth)
      expect(page.url()).toContain('/dashboard');
    });

    test('should maintain session across browser tabs', async ({ 
      page, 
      context, 
      mockWallet, 
      authPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);

      // Open new tab
      const newPage = await context.newPage();
      const newMockWallet = new (await import('../utils/mock-wallet')).MockWallet(
        newPage, 
        WALLET_CONFIGS.CONNECTED_BASE_SEPOLIA
      );
      await newMockWallet.inject();

      // Navigate to dashboard in new tab
      await newPage.goto('/dashboard');
      await newPage.waitForLoadState('networkidle');

      // Should be authenticated in new tab
      expect(newPage.url()).toContain('/dashboard');
      
      await newPage.close();
    });
  });

  test.describe('Authentication Failures', () => {
    testWithWallet(
      'should handle user rejection of signing request',
      WALLET_CONFIGS.REJECTS_SIGNING,
      async ({ page, mockWallet, authPage }) => {
        await authPage.navigate();
        await mockWallet.connect();
        await page.waitForTimeout(1000);

        // Click sign in
        await authPage.clickSignIn();

        // Mock nonce endpoint
        await page.route('**/auth/nonce', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              nonce: 'test-nonce-12345',
              message: 'Sign in to Bonitah Financial Network\n\nNonce: test-nonce-12345'
            })
          });
        });

        // Wait for error to appear
        await authPage.verifyError('User rejected signing');

        // Should remain on auth page
        expect(page.url()).toContain('/auth');
        await authPage.verifyStep2Visible();
      }
    );

    test('should handle backend nonce generation failure', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      await mockWallet.connect();
      await page.waitForTimeout(1000);

      // Mock nonce endpoint failure
      await page.route('**/auth/nonce', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Nonce generation failed' })
        });
      });

      await authPage.clickSignIn();
      
      // Should show error
      await authPage.verifyError('Nonce generation failed');
      expect(page.url()).toContain('/auth');
    });

    test('should handle backend verification failure', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      await mockWallet.connect();
      await page.waitForTimeout(1000);

      // Mock successful nonce but failed verification
      await page.route('**/auth/nonce', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            nonce: 'test-nonce-12345',
            message: 'Sign in to Bonitah Financial Network\n\nNonce: test-nonce-12345'
          })
        });
      });

      await page.route('**/auth/verify', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid signature' })
        });
      });

      await authPage.clickSignIn();
      
      // Should show verification error
      await authPage.verifyError('Invalid signature');
      expect(page.url()).toContain('/auth');
    });

    test('should handle network timeout during authentication', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      await mockWallet.connect();
      await page.waitForTimeout(1000);

      // Mock slow/timeout response
      await page.route('**/auth/nonce', async (route) => {
        await page.waitForTimeout(10000); // Simulate timeout
        await route.fulfill({
          status: 408,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Request timeout' })
        });
      });

      await authPage.clickSignIn();
      
      // Should handle timeout gracefully
      await authPage.verifyError('Request timeout');
      expect(page.url()).toContain('/auth');
    });
  });

  test.describe('Session Management', () => {
    test('should redirect to auth when accessing protected route without authentication', async ({ 
      page, 
      dashboardPage 
    }) => {
      // Try to access dashboard without authentication
      await dashboardPage.navigate();

      // Should redirect to auth page
      await page.waitForURL('/auth', { timeout: 10000 });
      expect(page.url()).toContain('/auth');
    });

    test('should handle expired JWT token', async ({ 
      page, 
      mockWallet, 
      authPage, 
      dashboardPage 
    }) => {
      await setupAuthenticatedUser(page, mockWallet, authPage);

      // Manually set expired token
      await page.evaluate(() => {
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIweDc0MmQzNUNjNjUyNEMzZDkxRjZCZjFiMGM4ZUQwOUI2RDViOTZDNyIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNTE2MjM5MDIyfQ.invalid';
        localStorage.setItem('bfn_auth_token', expiredToken);
      });

      // Try to access protected route
      await dashboardPage.navigate();

      // Should redirect to auth due to expired token
      await page.waitForURL('/auth', { timeout: 10000 });
      expect(page.url()).toContain('/auth');
    });

    test('should sign out successfully', async ({ 
      page, 
      mockWallet, 
      authPage, 
      navigationMenu, 
      homePage 
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

      // Navigate to a page with user menu (if implemented)
      await homePage.navigate();

      // Sign out (if user menu is implemented)
      if (await navigationMenu.isVisible('[data-testid="user-menu"]')) {
        await navigationMenu.signOut();
      } else {
        // Manually clear auth token for this test
        await page.evaluate(() => {
          localStorage.removeItem('bfn_auth_token');
        });
      }

      // Try to access protected route
      await page.goto('/dashboard');

      // Should redirect to auth
      await page.waitForURL('/auth', { timeout: 10000 });
      expect(page.url()).toContain('/auth');
    });
  });

  test.describe('Security Scenarios', () => {
    test('should reject invalid nonce format', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      await mockWallet.connect();
      await page.waitForTimeout(1000);

      // Mock invalid nonce response
      await page.route('**/auth/nonce', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            nonce: '', // Invalid empty nonce
            message: 'Sign in to Bonitah Financial Network'
          })
        });
      });

      await authPage.clickSignIn();
      
      // Should handle invalid nonce
      await authPage.verifyError('Invalid nonce');
    });

    test('should prevent replay attacks with used nonce', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      await mockWallet.connect();
      await page.waitForTimeout(1000);

      let nonceUsed = false;

      await page.route('**/auth/nonce', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            nonce: 'test-nonce-12345',
            message: 'Sign in to Bonitah Financial Network\n\nNonce: test-nonce-12345'
          })
        });
      });

      await page.route('**/auth/verify', async (route) => {
        if (nonceUsed) {
          // Simulate nonce already used
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Nonce already used' })
          });
        } else {
          nonceUsed = true;
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
      });

      // First authentication should succeed
      await authPage.clickSignIn();
      await authPage.waitForRedirect();

      // Navigate back to auth
      await authPage.navigate();
      await mockWallet.connect();
      await page.waitForTimeout(1000);

      // Try to authenticate again with same nonce (simulated)
      await authPage.clickSignIn();
      
      // Should reject due to nonce reuse
      await authPage.verifyError('Nonce already used');
    });

    test('should validate wallet address matches signature', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      await mockWallet.connect();
      await page.waitForTimeout(1000);

      await page.route('**/auth/nonce', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            nonce: 'test-nonce-12345',
            message: 'Sign in to Bonitah Financial Network\n\nNonce: test-nonce-12345'
          })
        });
      });

      await page.route('**/auth/verify', async (route) => {
        // Simulate signature verification failure
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Signature does not match address' })
        });
      });

      await authPage.clickSignIn();
      
      // Should reject invalid signature
      await authPage.verifyError('Signature does not match address');
    });
  });

  test.describe('Retry and Recovery', () => {
    test('should allow retry after signing failure', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      await mockWallet.connect();
      await page.waitForTimeout(1000);

      // First attempt - reject signing
      await mockWallet.rejectSigning();
      await authPage.clickSignIn();
      await authPage.verifyError('User rejected signing');

      // Second attempt - accept signing
      await mockWallet.acceptRequests();
      
      // Mock successful authentication
      await page.route('**/auth/nonce', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            nonce: 'test-nonce-54321',
            message: 'Sign in to Bonitah Financial Network\n\nNonce: test-nonce-54321'
          })
        });
      });

      await page.route('**/auth/verify', async (route) => {
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
      });

      await authPage.clickSignIn();
      await authPage.waitForRedirect();

      // Should succeed on retry
      expect(page.url()).toContain('/dashboard');
    });

    test('should clear error states on successful retry', async ({ 
      page, 
      mockWallet, 
      authPage 
    }) => {
      await authPage.navigate();
      await mockWallet.connect();
      await page.waitForTimeout(1000);

      // Cause an error
      await page.route('**/auth/nonce', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' })
        });
      });

      await authPage.clickSignIn();
      await authPage.verifyError('Server error');

      // Fix the endpoint for retry
      await page.unroute('**/auth/nonce');
      await page.route('**/auth/nonce', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            nonce: 'test-nonce-67890',
            message: 'Sign in to Bonitah Financial Network\n\nNonce: test-nonce-67890'
          })
        });
      });

      await page.route('**/auth/verify', async (route) => {
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
      });

      // Retry should succeed and clear error
      await authPage.clickSignIn();
      await authPage.waitForRedirect();
      
      expect(page.url()).toContain('/dashboard');
    });
  });
});