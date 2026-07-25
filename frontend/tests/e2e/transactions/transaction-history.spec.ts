/**
 * E2E Tests for Transaction History Viewing
 * 
 * Tests the complete transaction history viewing functionality including:
 * - Viewing transaction history on dashboard and dedicated pages
 * - Filtering and searching transactions
 * - Transaction details and formatting
 * - Pagination and performance with large transaction sets
 * - Export functionality
 */

import { expect } from '@playwright/test';
import { test, setupAuthenticatedUser, resetBrowserState, TIMEOUTS } from '../utils/fixtures';

test.describe('Transaction History Viewing', () => {
  test.beforeEach(async ({ page, mockWallet }) => {
    await resetBrowserState(page);
    
    // Mock transaction history API with sample data
    await page.route('**/api/transactions**', async (route) => {
      const url = new URL(route.request().url());
      const limit = url.searchParams.get('limit') || '50';
      const offset = url.searchParams.get('offset') || '0';
      const type = url.searchParams.get('type');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      
      // Generate sample transaction data
      const sampleTransactions = [
        {
          id: '1',
          type: 'deposit',
          amount: '0.5',
          token: 'ETH',
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed',
          gasUsed: '21000',
          gasPrice: '20000000000'
        },
        {
          id: '2',
          type: 'withdraw',
          amount: '0.2',
          token: 'ETH',
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed',
          gasUsed: '25000',
          gasPrice: '18000000000'
        },
        {
          id: '3',
          type: 'goal_contribution',
          amount: '100',
          token: 'USD',
          goalName: 'Emergency Fund',
          timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed'
        },
        {
          id: '4',
          type: 'community_vote',
          proposalId: 'prop-1',
          votePower: '50',
          voteChoice: 'yes',
          timestamp: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed'
        },
        {
          id: '5',
          type: 'deposit',
          amount: '1.0',