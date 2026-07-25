/**
 * Simple example test to verify Playwright setup
 */

import { test, expect } from '@playwright/test';

test.describe('Basic Setup Test', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/BFN|Bonitah/i);
  });
});
