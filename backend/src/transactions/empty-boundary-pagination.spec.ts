/**
 * Unit tests for empty and boundary pagination behavior (Task 14.3).
 * 
 * **Validates: Requirements 12.3, 12.4**
 * 
 * Tests the edge cases in transaction history pagination according to Requirement 12.4:
 * - Empty result sets when no cached events exist for a user's wallet address
 * - Boundary conditions for pagination limits (max page size, zero results)
 * - Proper handling of edge cases in the paging logic
 * 
 * These tests focus on the pagination mechanics rather than the full integration,
 * ensuring that the transaction history service correctly handles empty datasets
 * and respects pagination boundaries as specified in the requirements.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';
import { TransactionsQuery, MAX_TX_PAGE_SIZE } from '@bfn/shared';

describe('Empty and Boundary Pagination - Unit Tests', () => {
  let service: TransactionsService;
  let prismaService: PrismaService;

  // Mock user wallet addresses for testing
  const testWalletAddress = '0x1234567890123456789012345678901234567890';
  const emptyWalletAddress = '0x0000000000000000000000000000000000000000';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: {
            cachedEvent: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Empty Result Sets (Requirement 12.4)', () => {
    it('returns empty result set when no cached events exist for user wallet address', async () => {
      // Arrange: Mock empty result from database
      (prismaService.cachedEvent.findMany as jest.Mock).mockResolvedValue([]);

      const query: TransactionsQuery = {
        limit: MAX_TX_PAGE_SIZE,
      };

      // Act: Request transaction history for wallet with no events
      const result = await service.getTransactionHistory(emptyWalletAddress, query);

      // Assert: Should return empty array, not an error (Req 12.4)
      expect(result.events).toEqual([]);
      expect(result.nextCursor).toBeNull();
      expect(Array.isArray(result.events)).toBe(true);
      expect(result.events.length).toBe(0);

      // Verify correct database query was made
      expect(prismaService.cachedEvent.findMany).toHaveBeenCalledWith({
        where: {
          walletAddress: emptyWalletAddress.toLowerCase(),
        },
        orderBy: {
          blockNumber: 'desc',
        },
        take: MAX_TX_PAGE_SIZE,
        select: {
          contractAddress: true,
          eventName: true,
          walletAddress: true,
          transactionHash: true,
          blockNumber: true,
          blockHash: true,
          logIndex: true,
          payload: true,
        },
      });
    });

    it('returns empty result set when cursor is beyond available data', async () => {
      // Arrange: Mock empty result when cursor is too high
      (prismaService.cachedEvent.findMany as jest.Mock).mockResolvedValue([]);

      const query: TransactionsQuery = {
        cursor: '99999999', // Very high block number beyond available data
        limit: 50,
      };

      // Act
      const result = await service.getTransactionHistory(testWalletAddress, query);

      // Assert
      expect(result.events).toEqual([]);
      expect(result.nextCursor).toBeNull();

      // Verify cursor was used in query
      expect(prismaService.cachedEvent.findMany).toHaveBeenCalledWith({
        where: {
          walletAddress: testWalletAddress,
          blockNumber: {
            lt: BigInt(99999999),
          },
        },
        orderBy: {
          blockNumber: 'desc',
        },
        take: 51, // limit + 1
      });
    });
  });

  describe('Pagination Boundary Conditions (Requirement 12.3)', () => {
    it('respects maximum page size limit', async () => {
      // Arrange: Mock data that would exceed max page size
      const mockEvents = Array.from({ length: MAX_TX_PAGE_SIZE + 1 }, (_, index) => ({
        id: `event-${index}`,
        contractAddress: '0xcontract',
        eventName: 'TestEvent',
        walletAddress: testWalletAddress,
        transactionHash: `0xtx${index}`,
        blockNumber: BigInt(1000 - index),
        blockHash: `0xblock${index}`,
        logIndex: 0,
        payload: { amount: '100' },
        createdAt: new Date(),
      }));

      (prismaService.cachedEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);

      const query: TransactionsQuery = {
        limit: MAX_TX_PAGE_SIZE,
      };

      // Act
      const result = await service.getTransactionHistory(testWalletAddress, query);

      // Assert: Should return exactly MAX_TX_PAGE_SIZE events, not more
      expect(result.events.length).toBe(MAX_TX_PAGE_SIZE);
      expect(result.nextCursor).toBe(String(mockEvents[MAX_TX_PAGE_SIZE - 1]!.blockNumber));

      // Verify query requested one extra to check for next page
      expect(prismaService.cachedEvent.findMany).toHaveBeenCalledWith({
        where: {
          walletAddress: testWalletAddress,
        },
        orderBy: {
          blockNumber: 'desc',
        },
        take: MAX_TX_PAGE_SIZE + 1,
      });
    });

    it('handles exact page size without extra results', async () => {
      // Arrange: Mock data that exactly matches the requested page size
      const mockEvents = Array.from({ length: 25 }, (_, index) => ({
        id: `event-${index}`,
        contractAddress: '0xcontract',
        eventName: 'TestEvent',
        walletAddress: testWalletAddress,
        transactionHash: `0xtx${index}`,
        blockNumber: BigInt(1000 - index),
        blockHash: `0xblock${index}`,
        logIndex: 0,
        payload: { amount: '100' },
        createdAt: new Date(),
      }));

      (prismaService.cachedEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);

      const query: TransactionsQuery = {
        limit: 25,
      };

      // Act
      const result = await service.getTransactionHistory(testWalletAddress, query);

      // Assert: Should return all 25 events with no next cursor (no more pages)
      expect(result.events.length).toBe(25);
      expect(result.nextCursor).toBeNull(); // No more pages available
    });

    it('correctly calculates next cursor for pagination', async () => {
      // Arrange: Mock data with one extra event to indicate more pages exist
      const mockEvents = Array.from({ length: 11 }, (_, index) => ({
        id: `event-${index}`,
        contractAddress: '0xcontract',
        eventName: 'TestEvent',
        walletAddress: testWalletAddress,
        transactionHash: `0xtx${index}`,
        blockNumber: BigInt(2000 - index),
        blockHash: `0xblock${index}`,
        logIndex: 0,
        payload: { amount: '100' },
        createdAt: new Date(),
      }));

      (prismaService.cachedEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);

      const query: TransactionsQuery = {
        limit: 10,
      };

      // Act
      const result = await service.getTransactionHistory(testWalletAddress, query);

      // Assert: Should return 10 events with cursor pointing to the 10th event
      expect(result.events.length).toBe(10);
      expect(result.nextCursor).toBe(String(mockEvents[9]!.blockNumber)); // 10th event (index 9)

      // Verify the extra event was requested but not returned
      expect(mockEvents.length).toBe(11); // Query returned 11
      expect(result.events.length).toBe(10); // But we only return 10
    });

    it('handles single event result correctly', async () => {
      // Arrange: Mock single event
      const mockEvents = [{
        id: 'single-event',
        contractAddress: '0xcontract',
        eventName: 'TestEvent',
        walletAddress: testWalletAddress,
        transactionHash: '0xsingletx',
        blockNumber: BigInt(1000),
        blockHash: '0xsingleblock',
        logIndex: 0,
        payload: { amount: '100' },
        createdAt: new Date(),
      }];

      (prismaService.cachedEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);

      const query: TransactionsQuery = {
        limit: 10,
      };

      // Act
      const result = await service.getTransactionHistory(testWalletAddress, query);

      // Assert: Should return single event with no next cursor
      expect(result.events.length).toBe(1);
      expect(result.nextCursor).toBeNull();
      expect(result.events[0]!.transactionHash).toBe('0xsingletx');
    });
  });

  describe('Cursor-Based Pagination Edge Cases', () => {
    it('handles cursor at exact boundary between pages', async () => {
      // Arrange: Mock events starting from a specific cursor
      const cursorBlockNumber = '1500';
      const mockEvents = Array.from({ length: 5 }, (_, index) => ({
        id: `event-${index}`,
        contractAddress: '0xcontract',
        eventName: 'TestEvent',
        walletAddress: testWalletAddress,
        transactionHash: `0xtx${index}`,
        blockNumber: BigInt(1499 - index), // All below cursor
        blockHash: `0xblock${index}`,
        logIndex: 0,
        payload: { amount: '100' },
        createdAt: new Date(),
      }));

      (prismaService.cachedEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);

      const query: TransactionsQuery = {
        cursor: cursorBlockNumber,
        limit: 10,
      };

      // Act
      const result = await service.getTransactionHistory(testWalletAddress, query);

      // Assert
      expect(result.events.length).toBe(5);
      expect(result.nextCursor).toBeNull(); // No more events

      // Verify cursor constraint was applied
      expect(prismaService.cachedEvent.findMany).toHaveBeenCalledWith({
        where: {
          walletAddress: testWalletAddress,
          blockNumber: {
            lt: BigInt(cursorBlockNumber),
          },
        },
        orderBy: {
          blockNumber: 'desc',
        },
        take: 11, // limit + 1
      });
    });

    it('returns empty result when cursor is below all available data', async () => {
      // Arrange: Mock empty result when cursor is too low
      (prismaService.cachedEvent.findMany as jest.Mock).mockResolvedValue([]);

      const query: TransactionsQuery = {
        cursor: '1', // Very low block number
        limit: 10,
      };

      // Act
      const result = await service.getTransactionHistory(testWalletAddress, query);

      // Assert
      expect(result.events).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('Descending Order Requirement (Requirement 12.3)', () => {
    it('ensures events are returned in descending block number order', async () => {
      // Arrange: Mock events in descending order
      const mockEvents = [
        {
          id: 'event-1',
          contractAddress: '0xcontract',
          eventName: 'TestEvent',
          walletAddress: testWalletAddress,
          transactionHash: '0xtx1',
          blockNumber: BigInt(2000),
          blockHash: '0xblock1',
          logIndex: 0,
          payload: { amount: '100' },
          createdAt: new Date(),
        },
        {
          id: 'event-2',
          contractAddress: '0xcontract',
          eventName: 'TestEvent',
          walletAddress: testWalletAddress,
          transactionHash: '0xtx2',
          blockNumber: BigInt(1999),
          blockHash: '0xblock2',
          logIndex: 0,
          payload: { amount: '200' },
          createdAt: new Date(),
        },
      ];

      (prismaService.cachedEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);

      const query: TransactionsQuery = {
        limit: 10,
      };

      // Act
      const result = await service.getTransactionHistory(testWalletAddress, query);

      // Assert: Events should be in descending block order
      expect(result.events.length).toBe(2);
      expect(Number(result.events[0]!.blockNumber)).toBeGreaterThan(Number(result.events[1]!.blockNumber));
      expect(result.events[0]!.blockNumber).toBe('2000');
      expect(result.events[1]!.blockNumber).toBe('1999');

      // Verify ordering was requested
      expect(prismaService.cachedEvent.findMany).toHaveBeenCalledWith({
        where: {
          walletAddress: testWalletAddress,
        },
        orderBy: {
          blockNumber: 'desc',
        },
        take: 11,
      });
    });
  });
});