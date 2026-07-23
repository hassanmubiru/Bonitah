import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';
import { PaginationQueryDto } from './transactions.dto';

/**
 * Property 30: Transaction history is scoped, ordered, and paged
 * **Validates: Requirements 12.3**
 *
 * This property test validates that cached events are returned scoped to the requesting 
 * user's wallet address, ordered by descending block number, and properly paginated 
 * with at most 100 events per response.
 *
 * Key requirements tested:
 * - Transaction history is scoped to the requesting user's wallet address only
 * - Events are ordered by descending block number (most recent first)
 * - Pagination limits responses to at most 100 events per page
 * - Empty result set is returned when no events exist for the user
 * - Pagination metadata is accurate (total count, page info, etc.)
 */
describe('Property 30: Transaction history scoping/ordering/paging', () => {
  let service: TransactionsService;
  let prisma: PrismaService;

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
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property: Transaction history is scoped to requesting user's wallet address only
   * Requirements: 12.3 (wallet address scoping)
   */
  it('returns events scoped to the requesting users wallet address only', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Target user wallet address
          userWallet: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          // Other wallet addresses that should NOT appear in results
          otherWallets: fc.array(
            fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
            { minLength: 1, maxLength: 5 }
          ),
          // Events for the target user
          userEvents: fc.array(
            fc.record({
              id: fc.string(),
              contractAddress: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
              eventName: fc.string(),
              transactionHash: fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`),
              blockNumber: fc.bigInt({ min: 1n, max: 1000000n }),
              blockHash: fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`),
              logIndex: fc.integer({ min: 0, max: 100 }),
              payload: fc.record({ amount: fc.string(), from: fc.string() }),
              createdAt: fc.date(),
            }),
            { minLength: 0, maxLength: 10 }
          ),
          pagination: fc.record({
            page: fc.integer({ min: 1, max: 5 }),
            limit: fc.integer({ min: 1, max: 100 }),
          }),
        }),
        async ({ userWallet, otherWallets, userEvents, pagination }) => {
          // Ensure other wallets are different from user wallet
          const distinctOtherWallets = otherWallets.filter(w => 
            w.toLowerCase() !== userWallet.toLowerCase()
          );
          if (distinctOtherWallets.length === 0) {
            return; // Skip if no distinct other wallets
          }

          // Attach wallet addresses to events
          const userEventsWithWallet = userEvents.map(event => ({
            ...event,
            walletAddress: userWallet.toLowerCase(),
          }));

          // Mock Prisma responses
          (prisma.cachedEvent.findMany as jest.Mock).mockResolvedValue(userEventsWithWallet);
          (prisma.cachedEvent.count as jest.Mock).mockResolvedValue(userEvents.length);

          const result = await service.getTransactionHistory(userWallet, pagination);

          // Verify findMany was called with correct wallet scoping
          expect(prisma.cachedEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: {
                walletAddress: userWallet.toLowerCase(), // Normalized to lowercase
              },
            })
          );

          // Verify count was called with same scoping
          expect(prisma.cachedEvent.count).toHaveBeenCalledWith({
            where: {
              walletAddress: userWallet.toLowerCase(),
            },
          });

          // Property: All returned events belong to the requesting user's wallet
          result.events.forEach(event => {
            expect(event.walletAddress).toBe(userWallet.toLowerCase());
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Events are ordered by descending block number (most recent first)  
   * Requirements: 12.3 (descending block number ordering)
   */
  it('orders events by descending block number', () => {
    fc.assert(
      fc.property(
        fc.record({
          walletAddress: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          events: fc.array(
            fc.record({
              id: fc.string(),
              contractAddress: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
              eventName: fc.string(),
              transactionHash: fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`),
              blockNumber: fc.bigInt({ min: 1n, max: 1000000n }),
              blockHash: fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`),
              logIndex: fc.integer({ min: 0, max: 100 }),
              payload: fc.record({}),
              createdAt: fc.date(),
            }),
            { minLength: 2, max: 20 } // At least 2 events to test ordering
          ),
          pagination: fc.record({
            page: fc.integer({ min: 1, max: 3 }),
            limit: fc.integer({ min: 1, max: 100 }),
          }),
        }),
        async ({ walletAddress, events, pagination }) => {
          // Sort events by descending block number for expected result
          const sortedEvents = events
            .map(event => ({ ...event, walletAddress: walletAddress.toLowerCase() }))
            .sort((a, b) => Number(b.blockNumber - a.blockNumber));

          // Mock Prisma responses
          (prisma.cachedEvent.findMany as jest.Mock).mockResolvedValue(sortedEvents);
          (prisma.cachedEvent.count as jest.Mock).mockResolvedValue(events.length);

          const result = await service.getTransactionHistory(walletAddress, pagination);

          // Verify findMany was called with descending block number ordering
          expect(prisma.cachedEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              orderBy: {
                blockNumber: 'desc', // Descending order (most recent first)
              },
            })
          );

          // Property: Returned events are ordered by descending block number
          if (result.events.length > 1) {
            for (let i = 0; i < result.events.length - 1; i++) {
              const current = result.events[i];
              const next = result.events[i + 1];
              
              // Current block number should be >= next block number (descending)
              expect(Number(current.blockNumber)).toBeGreaterThanOrEqual(Number(next.blockNumber));
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Pagination limits responses to at most 100 events per page
   * Requirements: 12.3 (maximum 100 events per response)
   */
  it('enforces maximum 100 events per page', () => {
    fc.assert(
      fc.property(
        fc.record({
          walletAddress: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          requestedLimit: fc.integer({ min: 1, max: 500 }), // Test limits above 100
          totalEvents: fc.integer({ min: 0, max: 1000 }),
          page: fc.integer({ min: 1, max: 10 }),
        }),
        async ({ walletAddress, requestedLimit, totalEvents, page }) => {
          const pagination: PaginationQueryDto = { page, limit: requestedLimit };

          // Generate mock events
          const mockEvents = Array.from({ length: Math.min(totalEvents, 100) }, (_, i) => ({
            id: `event-${i}`,
            contractAddress: `0x${'a'.repeat(40)}`,
            eventName: `Event${i}`,
            transactionHash: `0x${'b'.repeat(64)}`,
            blockNumber: BigInt(1000 - i), // Descending
            blockHash: `0x${'c'.repeat(64)}`,
            logIndex: i,
            payload: {},
            createdAt: new Date(),
            walletAddress: walletAddress.toLowerCase(),
          }));

          // Mock Prisma responses
          (prisma.cachedEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);
          (prisma.cachedEvent.count as jest.Mock).mockResolvedValue(totalEvents);

          const result = await service.getTransactionHistory(walletAddress, pagination);

          // Property: Effective limit is at most 100 (Requirement 12.3)
          const expectedLimit = Math.min(requestedLimit, 100);
          
          expect(prisma.cachedEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              take: expectedLimit, // Should never exceed 100
            })
          );

          // Property: Returned events never exceed 100
          expect(result.events.length).toBeLessThanOrEqual(100);
          expect(result.pagination.pageSize).toBeLessThanOrEqual(100);
          expect(result.pagination.pageSize).toBe(expectedLimit);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty result set when no events exist for the user
   * Requirements: 12.4 (empty result set for no cached events)
   */
  it('returns empty result set when no events exist for user', () => {
    fc.assert(
      fc.property(
        fc.record({
          walletAddress: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          pagination: fc.record({
            page: fc.integer({ min: 1, max: 5 }),
            limit: fc.integer({ min: 1, max: 100 }),
          }),
        }),
        async ({ walletAddress, pagination }) => {
          // Mock empty results
          (prisma.cachedEvent.findMany as jest.Mock).mockResolvedValue([]);
          (prisma.cachedEvent.count as jest.Mock).mockResolvedValue(0);

          const result = await service.getTransactionHistory(walletAddress, pagination);

          // Property: Empty result set without error (Requirement 12.4)
          expect(result.events).toEqual([]);
          expect(result.pagination.totalCount).toBe(0);
          expect(result.pagination.totalPages).toBe(0);
          expect(result.pagination.hasNextPage).toBe(false);
          expect(result.pagination.hasPreviousPage).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Pagination metadata is accurate
   * Requirements: 12.3 (proper pagination with metadata)
   */
  it('provides accurate pagination metadata', () => {
    fc.assert(
      fc.property(
        fc.record({
          walletAddress: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          totalEvents: fc.integer({ min: 0, max: 500 }),
          page: fc.integer({ min: 1, max: 10 }),
          limit: fc.integer({ min: 1, max: 100 }),
        }),
        async ({ walletAddress, totalEvents, page, limit }) => {
          const effectiveLimit = Math.min(limit, 100);
          const skip = (page - 1) * effectiveLimit;
          const eventsOnPage = Math.max(0, Math.min(effectiveLimit, totalEvents - skip));
          
          // Generate mock events for the current page
          const mockEvents = Array.from({ length: eventsOnPage }, (_, i) => ({
            id: `event-${skip + i}`,
            contractAddress: `0x${'a'.repeat(40)}`,
            eventName: `Event${i}`,
            transactionHash: `0x${'b'.repeat(64)}`,
            blockNumber: BigInt(1000 - skip - i),
            blockHash: `0x${'c'.repeat(64)}`,
            logIndex: i,
            payload: {},
            createdAt: new Date(),
            walletAddress: walletAddress.toLowerCase(),
          }));

          // Mock Prisma responses
          (prisma.cachedEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);
          (prisma.cachedEvent.count as jest.Mock).mockResolvedValue(totalEvents);

          const result = await service.getTransactionHistory(walletAddress, { page, limit });

          // Calculate expected pagination values
          const expectedTotalPages = Math.ceil(totalEvents / effectiveLimit);
          const expectedHasNextPage = page < expectedTotalPages;
          const expectedHasPreviousPage = page > 1;

          // Property: Pagination metadata is accurate
          expect(result.pagination.currentPage).toBe(page);
          expect(result.pagination.totalCount).toBe(totalEvents);
          expect(result.pagination.totalPages).toBe(expectedTotalPages);
          expect(result.pagination.pageSize).toBe(effectiveLimit);
          expect(result.pagination.hasNextPage).toBe(expectedHasNextPage);
          expect(result.pagination.hasPreviousPage).toBe(expectedHasPreviousPage);

          // Property: Correct skip/take values used in query
          expect(prisma.cachedEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              skip: (page - 1) * effectiveLimit,
              take: effectiveLimit,
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Wallet address normalization (case insensitive)
   * Requirements: 12.3 (consistent address handling)
   */
  it('normalizes wallet addresses to lowercase for consistent querying', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Mixed case wallet address
          walletAddress: fc.hexaString({ minLength: 40, maxLength: 40 })
            .map(s => `0x${s}`)
            .map(addr => {
              // Randomly mix uppercase and lowercase
              return addr.split('').map(c => 
                Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()
              ).join('');
            }),
          pagination: fc.record({
            page: fc.integer({ min: 1, max: 3 }),
            limit: fc.integer({ min: 1, max: 50 }),
          }),
        }),
        async ({ walletAddress, pagination }) => {
          // Mock empty results for simplicity
          (prisma.cachedEvent.findMany as jest.Mock).mockResolvedValue([]);
          (prisma.cachedEvent.count as jest.Mock).mockResolvedValue(0);

          await service.getTransactionHistory(walletAddress, pagination);

          // Property: Wallet address is normalized to lowercase in queries
          expect(prisma.cachedEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: {
                walletAddress: walletAddress.toLowerCase(), // Always lowercase
              },
            })
          );

          expect(prisma.cachedEvent.count).toHaveBeenCalledWith({
            where: {
              walletAddress: walletAddress.toLowerCase(), // Always lowercase
            },
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});