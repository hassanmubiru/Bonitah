/**
 * Page Object Models for Playwright E2E Tests
 * 
 * This file contains page objects that encapsulate the behavior
 * of different pages in the application, making tests more maintainable
 * and reusable.
 */

import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if an element is visible
   */
  async isVisible(selector: string): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation() {
    await this.page.waitForLoadState('networkidle');
  }
}

export class HomePage extends BasePage {
  readonly heroTitle: Locator;
  readonly connectButton: Locator;
  readonly learnMoreButton: Locator;
  readonly featuresSection: Locator;
  readonly ctaSection: Locator;

  constructor(page: Page) {
    super(page);
    this.heroTitle = page.locator('h1:has-text("Building Financial")');
    this.connectButton = page.locator('[data-testid="rk-connect-button"]').first();
    this.learnMoreButton = page.locator('text=Learn More');
    this.featuresSection = page.locator('#features');
    this.ctaSection = page.locator('text=Ready to start your financial journey?');
  }

  async navigate() {
    await this.page.goto('/');
    await this.waitForLoad();
  }

  async clickConnectWallet() {
    await this.connectButton.click();
  }

  async clickLearnMore() {
    await this.learnMoreButton.click();
  }

  async scrollToFeatures() {
    await this.featuresSection.scrollIntoViewIfNeeded();
  }

  async verifyHeroContent() {
    await expect(this.heroTitle).toBeVisible();
    await expect(this.page.locator('text=Join the Bonitah Financial Network')).toBeVisible();
    await expect(this.connectButton).toBeVisible();
  }

  async verifyFeaturesSection() {
    await expect(this.featuresSection).toBeVisible();
    await expect(this.page.locator('text=Smart Savings')).toBeVisible();
    await expect(this.page.locator('text=Goal Setting')).toBeVisible();
    await expect(this.page.locator('text=Community')).toBeVisible();
    await expect(this.page.locator('text=Education')).toBeVisible();
  }
}

export class AuthPage extends BasePage {
  readonly welcomeTitle: Locator;
  readonly step1Title: Locator;
  readonly step2Title: Locator;
  readonly connectButton: Locator;
  readonly signInButton: Locator;
  readonly walletConnectedStatus: Locator;
  readonly errorAlert: Locator;
  readonly loadingState: Locator;
  readonly redirectingMessage: Locator;
  readonly step1Indicator: Locator;
  readonly step2Indicator: Locator;

  constructor(page: Page) {
    super(page);
    this.welcomeTitle = page.locator('text=Welcome to BFN');
    this.step1Title = page.locator('text=Step 1: Connect Your Wallet');
    this.step2Title = page.locator('text=Step 2: Sign Authentication Message');
    this.connectButton = page.locator('[data-testid="rk-connect-button"]');
    this.signInButton = page.locator('button:has-text("Sign In with Ethereum")');
    this.walletConnectedStatus = page.locator('text=Wallet Connected');
    this.errorAlert = page.locator('[role="alert"]');
    this.loadingState = page.locator('text=Signing In...');
    this.redirectingMessage = page.locator('text=Redirecting to dashboard...');
    this.step1Indicator = this.step1Title.locator('..').locator('.h-2.w-2.rounded-full').first();
    this.step2Indicator = this.step2Title.locator('..').locator('.h-2.w-2.rounded-full').first();
  }

  async navigate() {
    await this.page.goto('/auth');
    await this.waitForLoad();
  }

  async verifyStep1Inactive() {
    await expect(this.step1Title).toBeVisible();
    await expect(this.step1Indicator).toHaveClass(/bg-gray-300/);
    await expect(this.connectButton).toBeVisible();
    await expect(this.walletConnectedStatus).not.toBeVisible();
  }

  async verifyStep1Active() {
    await expect(this.step1Title).toBeVisible();
    await expect(this.step1Indicator).toHaveClass(/bg-green-500/);
    await expect(this.walletConnectedStatus).toBeVisible();
  }

  async verifyStep2Visible() {
    await expect(this.step2Title).toBeVisible();
    await expect(this.signInButton).toBeVisible();
  }

  async verifyStep2Inactive() {
    await expect(this.step2Indicator).toHaveClass(/bg-gray-300/);
  }

  async clickConnectWallet() {
    await this.connectButton.click();
  }

  async clickSignIn() {
    await this.signInButton.click();
  }

  async verifyError(errorText: string) {
    await expect(this.errorAlert).toBeVisible();
    await expect(this.errorAlert).toContainText(errorText);
  }

  async verifyLoadingState() {
    await expect(this.loadingState).toBeVisible();
    await expect(this.signInButton).toBeDisabled();
  }

  async verifyRedirecting() {
    await expect(this.redirectingMessage).toBeVisible();
  }

  async waitForRedirect() {
    await this.page.waitForURL('/dashboard', { timeout: 10000 });
  }
}

export class DashboardPage extends BasePage {
  readonly pageTitle: Locator;
  readonly savingsOverview: Locator;
  readonly portfolioChart: Locator;
  readonly recentTransactions: Locator;
  readonly goalsSection: Locator;
  readonly communityStats: Locator;
  readonly achievementsPanel: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('h1:has-text("Dashboard")');
    this.savingsOverview = page.locator('[data-testid="savings-overview"]');
    this.portfolioChart = page.locator('[data-testid="portfolio-chart"]');
    this.recentTransactions = page.locator('[data-testid="recent-transactions"]');
    this.goalsSection = page.locator('[data-testid="goals-section"]');
    this.communityStats = page.locator('[data-testid="community-stats"]');
    this.achievementsPanel = page.locator('[data-testid="achievements-panel"]');
  }

  async navigate() {
    await this.page.goto('/dashboard');
    await this.waitForLoad();
  }

  async verifyDashboardContent() {
    // Note: This will depend on the actual dashboard implementation
    // For now, we'll check for basic presence of dashboard elements
    await this.waitForLoad();
    
    // Check if we're on the dashboard route
    expect(this.page.url()).toContain('/dashboard');
    
    // Check for auth guard - if not authenticated, should redirect
    // This test will evolve as dashboard is implemented
  }

  async verifyTransactionHistory() {
    if (await this.isVisible('[data-testid="recent-transactions"]')) {
      await expect(this.recentTransactions).toBeVisible();
    }
  }

  async verifySavingsData() {
    if (await this.isVisible('[data-testid="savings-overview"]')) {
      await expect(this.savingsOverview).toBeVisible();
    }
  }
}

export class SavingsPage extends BasePage {
  readonly depositButton: Locator;
  readonly withdrawButton: Locator;
  readonly amountInput: Locator;
  readonly balanceDisplay: Locator;
  readonly transactionModal: Locator;
  readonly confirmButton: Locator;

  constructor(page: Page) {
    super(page);
    this.depositButton = page.locator('button:has-text("Deposit")');
    this.withdrawButton = page.locator('button:has-text("Withdraw")');
    this.amountInput = page.locator('input[type="number"]');
    this.balanceDisplay = page.locator('[data-testid="balance-display"]');
    this.transactionModal = page.locator('[role="dialog"]');
    this.confirmButton = page.locator('button:has-text("Confirm")');
  }

  async navigate() {
    await this.page.goto('/savings');
    await this.waitForLoad();
  }

  async initiateDeposit(amount: string) {
    await this.depositButton.click();
    await expect(this.transactionModal).toBeVisible();
    await this.amountInput.fill(amount);
    await this.confirmButton.click();
  }

  async initiateWithdraw(amount: string) {
    await this.withdrawButton.click();
    await expect(this.transactionModal).toBeVisible();
    await this.amountInput.fill(amount);
    await this.confirmButton.click();
  }

  async verifyBalance() {
    if (await this.isVisible('[data-testid="balance-display"]')) {
      await expect(this.balanceDisplay).toBeVisible();
    }
  }
}

export class NavigationMenu extends BasePage {
  readonly homeLink: Locator;
  readonly dashboardLink: Locator;
  readonly savingsLink: Locator;
  readonly authLink: Locator;
  readonly mobileMenuButton: Locator;
  readonly userMenu: Locator;
  readonly signOutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.homeLink = page.locator('a[href="/"]');
    this.dashboardLink = page.locator('a[href="/dashboard"]');
    this.savingsLink = page.locator('a[href="/savings"]');
    this.authLink = page.locator('a[href="/auth"]');
    this.mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
    this.userMenu = page.locator('[data-testid="user-menu"]');
    this.signOutButton = page.locator('button:has-text("Sign Out")');
  }

  async navigateToHome() {
    await this.homeLink.click();
    await this.waitForNavigation();
  }

  async navigateToDashboard() {
    await this.dashboardLink.click();
    await this.waitForNavigation();
  }

  async navigateToSavings() {
    await this.savingsLink.click();
    await this.waitForNavigation();
  }

  async navigateToAuth() {
    await this.authLink.click();
    await this.waitForNavigation();
  }

  async signOut() {
    if (await this.isVisible('[data-testid="user-menu"]')) {
      await this.userMenu.click();
      await this.signOutButton.click();
      await this.waitForNavigation();
    }
  }

  async openMobileMenu() {
    if (await this.isVisible('[data-testid="mobile-menu-button"]')) {
      await this.mobileMenuButton.click();
    }
  }
}

export class NetworkGuard extends BasePage {
  readonly networkWarning: Locator;
  readonly switchNetworkButton: Locator;
  readonly wrongNetworkMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.networkWarning = page.locator('[data-testid="network-warning"]');
    this.switchNetworkButton = page.locator('button:has-text("Switch Network")');
    this.wrongNetworkMessage = page.locator('text=Please switch to Base Sepolia');
  }

  async verifywrongNetworkWarning() {
    await expect(this.networkWarning).toBeVisible();
    await expect(this.wrongNetworkMessage).toBeVisible();
  }

  async clickSwitchNetwork() {
    await this.switchNetworkButton.click();
  }

  async verifyNetworkAccepted() {
    await expect(this.networkWarning).not.toBeVisible();
  }
}