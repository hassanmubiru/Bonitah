import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for BFN E2E tests
 * 
 * Implements Task 22.1 requirements:
 * - Cover account creation, authentication, initiating a transaction, and viewing transaction history
 * - Requirements: 15.5
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  
  // Global timeout configurations
  timeout: 60000, // 60s per test
  expect: {
    timeout: 10000, // 10s for assertions
  },
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ...(process.env['CI'] ? [['github']] : [['list']]),
  ],
  
  // Test output directory
  outputDir: 'test-results/',
  
  // Global test configuration
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Custom context options
    contextOptions: {
      permissions: ['notifications', 'clipboard-read', 'clipboard-write'],
    },
  },

  // Browser projects for cross-browser testing
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Development server setup
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env['CI'],
    timeout: 120000, // 2 minutes to start
  },
});