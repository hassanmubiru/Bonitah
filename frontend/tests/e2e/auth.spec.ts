import { test, expect } from '@playwright/test';
import { MockWallet } from '../helpers/mock-wallet';

/**
 * Authentication E2E Tests
 * 
 * Implements Task 22.1 requirement for authentication flow coverage
 */
test.describe('Authentication Flow', () => {
  let mockWallet: MockWallet;

  test.beforeEach(async ({ page, context }) => {
    mockWallet = new MockWallet(page, context);
    await page.goto('/');
  });

  test('should connect wallet and authenticate via SIWE', async ({ page }) => {
    // Navigate to auth page
    await page.click('[data-testid="connect-wallet-button"]');
    await expect(page).toHaveURL('/auth');

    // Mock wallet connection
    await mockWallet.mockConnection('0x742d35Cc6634C0532925a3b8D404d67B18D2f83f');

    // Generate nonce
    await page.click('[data-testid="generate-nonce-button"]');
    await expect(page.locator('[data-testid="siwe-message"]')).toBeVisible();

    // Sign message
    const messageText = await page.locator('[data-testid="siwe-message"]').textContent();
    expect(messageText).toContain('wants you to sign in with your Ethereum account');
    expect(messageText).toContain('Base Sepolia');

    // Mock signature
    await mockWallet.mockSignature(messageText!);
    await page.click('[data-testid="sign-message-button"]');

    // Verify authentication success
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
    await expect(page.locator('[data-testid="user-address"]')).toContainText('0x742d35Cc');
  });

  test('should handle wrong network and prompt switch', async ({ page }) => {
    // Mock connection to wrong network (mainnet)
    await mockWallet.mockConnection('0x742d35Cc6634C0532925a3b8D404d67B18D2f83f', 1);

    await page.click('[data-testid="connect-wallet-button"]');
    
    // Should show network switch prompt
    await expect(page.locator('[data-testid="wrong-network-alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="switch-network-button"]')).toBeVisible();

    // Mock network switch
    await mockWallet.mockNetworkSwitch(84532); // Base Sepolia
    await page.click('[data-testid="switch-network-button"]');

    // Should proceed to auth flow
    await expect(page.locator('[data-testid="generate-nonce-button"]')).toBeVisible();
  });

  test('should handle signature rejection', async ({ page }) => {
    await mockWallet.mockConnection('0x742d35Cc6634C0532925a3b8D404d67B18D2f83f');
    
    await page.click('[data-testid="connect-wallet-button"]');
    await page.click('[data-testid="generate-nonce-button"]');
    
    // Mock signature rejection
    await mockWallet.mockSignatureRejection();
    await page.click('[data-testid="sign-message-button"]');

    // Should show error and allow retry
    await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="auth-error"]')).toContainText('User rejected');
    await expect(page.locator('[data-testid="retry-auth-button"]')).toBeVisible();
  });

  test('should handle expired JWT and re-authenticate', async ({ page }) => {
    // Set expired JWT in localStorage
    await page.addInitScript(() => {
      localStorage.setItem('jwt_token', 'expired.jwt.token');
    });

    await page.goto('/dashboard');

    // Should redirect to auth due to expired token
    await expect(page).toHaveURL('/auth');
    await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
  });

  test('should logout and clear authentication', async ({ page }) => {
    // Complete authentication first
    await mockWallet.mockConnection('0x742d35Cc6634C0532925a3b8D404d67B18D2f83f');
    await page.click('[data-testid="connect-wallet-button"]');
    await page.click('[data-testid="generate-nonce-button"]');
    
    const messageText = await page.locator('[data-testid="siwe-message"]').textContent();
    await mockWallet.mockSignature(messageText!);
    await page.click('[data-testid="sign-message-button"]');

    await expect(page).toHaveURL('/dashboard');

    // Logout
    await page.click('[data-testid="user-menu-button"]');
    await page.click('[data-testid="logout-button"]');

    // Should redirect to landing and clear auth state
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
    
    // Verify JWT cleared
    const jwt = await page.evaluate(() => localStorage.getItem('jwt_token'));
    expect(jwt).toBeNull();
  });
});