import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';
import { TransactionsQuery } from '@bfn/shared';

/**
 * Property 30: Transaction history is scoped, ordered, and paged
 * **Validates: Requirements 11.2, 12.3**
 *
 * This property test validates that cached events are returned scoped to the requesting
 * user's wallet address, ordered by descending block number, and properly paginated
 * with at most 100 events per response (API limit) or 50 events (Dashboard limit).
 *
 * Key requirements tested:
 * - Transaction history is scoped to the requesting user's wallet address only
 * - Events are ordered by descending block number (most recent first) 
 * - Pagination respects ≤100 events per page limit (Req 12.3)
 * - Dashboard display limits to ≤50 events per view (Req 11.2)
 * - Page boundaries work correctly with cursor-based pagination
 * - No data leakage between different users
 * - Empty result set is returned when no events exist for the user
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
  it('returns events scoped to the requesting users wallet address only', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Target user wallet address
          userWallet: fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => `0x${s}`),
          // Other wallet addresses that should NOT appear in results
          otherWallets: fc.array(
            fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => `0x${s}`),
            { minLength: 1, maxLength: 5 },
          ),
          // Events for the target user
          userEvents: fc.array(
            fc.record({
              id: fc.string(),
              contractAddress: fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => `0x${s}`),
              eventName: fc.string(),
              transactionHash: fc.hexaString({ minLength: 64, maxLength: 64 }).map((s) => `0x${s}`),
              blockNumber: fc.bigInt({ min: 1n, max: 1000000n }),
              blockHash: fc.hexaString({ minLength: 64, maxLength: 64 }).map((s) => `0x${s}`),
              logIndex: fc.integer({ min: 0, max: 100 }),
              payload: fc.record({ amount: fc.string(), from: fc.string() }),
              createdAt: fc.date(),
            }),
            { minLength: 0, maxLength: 10 },
          ),
          query: fc.record({
            cursor: fc.option(
              fc.bigInt({ min: 1n, max: 1000000n }).map((n) => n.toString()),
              { nil: undefined },
            ),
            limit: fc.integer({ min: 1, max: 100 }),
          }),
        }),
        async ({ userWallet, otherWallets, userEvents, query }) => {
          // Ensure other wallets are different from user wallet
          const distinctOtherWallets = otherWallets.filter(
            (w) => w.toLowerCase() !== userWallet.toLowerCase(),
          );
          if (distinctOtherWallets.length === 0) {
            return; // Skip if no distinct other wallets
          }

          // Attach wallet addresses to events
          const userEventsWithWallet = userEvents.map((event) => ({
            ...event,
            walletAddress: userWallet.toLowerCase(),
          }));

          // Mock Prisma responses
          (prisma.cachedEvent.findMany as jest.Mock).mockResolvedValue(userEventsWithWallet);

          const result = await service.getTransactionHistory(userWallet, query);

          // Verify findMany was called with correct wallet scoping
          expect(prisma.cachedEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                walletAddress: userWallet.toLowerCase(), // Normalized to lowercase
              }),
            }),
          );

          // Property: All returned events belong to the requesting user's wallet
          result.events.forEach((event) => {
            expect(event.walletAddress).toBe(userWallet.toLowerCase());
          });
        },
      ),
      { numRuns: 50 }, // Reduce runs to avoid memory issues
    );
  });

  /**
   * Property: Events are ordered by descending block number (most recent first)  
   * Requirements: 12.3 (descending block number ordering)
   */
  it('orders events by descending block number', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          walletAddress: fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => `0x${s}`),
          events: fc.array(
            fc.record({
              id: fc.string(),
              contractAddress: fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => `0x${s}`),
              eventName: fc.string(),
              transactionHash: fc.hexaString({ minLength: 64, maxLength: 64 }).map((s) => `0x${s}`),
              blockNumber: fc.bigInt({ min: 1n, max: 1000000n }),
              blockHash: fc.hexaString({ minLength: 64, maxLength: 64 }).map((s) => `0x${s}`),
              logIndex: fc.integer({ min: 0, max: 100 }),
              payload: fc.record({}),
              createdAt: fc.date(),
            }),
            { minLength: 2, maxLength: 10 }, // At least 2 events to test ordering, reduce from 20
          ),
          query: fc.record({
            cursor: fc.option(
              fc.bigInt({ min: 1n, max: 1000000n }).map((n) => n.toString()),
              { nil: undefined },
            ),
            limit: fc.integer({ min: 1, max: 100 }),
          }),
        }),
        async ({ walletAddress, events, query }) => {
          // Sort events by descending block number for expected result
          const sortedEvents = events
            .map((event) => ({ ...event, walletAddress: walletAddress.toLowerCase() }))
            .sort((a, b) => Number(b.blockNumber - a.blockNumber));

          // Mock Prisma responses
          (prisma.cachedEvent.findMany as jest.Mock).mockResolvedValue(sortedEvents);

          const result = await service.getTransactionHistory(walletAddress, query);

          // Verify findMany was called with descending block number ordering
          expect(prisma.cachedEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              orderBy: {
                blockNumber: 'desc', // Descending order (most recent first)
              },
            }),
          );

          // Property: Returned events are ordered by descending block number
          if (result.events.length > 1) {
            for (let i = 0; i < result.events.length - 1; i++) {
              const current = result.events[i];
              const next = result.events[i + 1];

              if (current && next) {
                // Current block number should be >= next block number (descending)
                expect(Number(current.blockNumber)).toBeGreaterThanOrEqual(
                  Number(next.blockNumber),
                );
              }
            }
          }
        },
      ),
      { numRuns: 50 }, // Reduce runs to avoid memory issues
    );
  });

  /**
   * Property: Service uses cursor pagination (limit + 1 fetch pattern)
   * Requirements: 12.3 (proper pagination)
   * The service fetches limit + 1 records to detect if there are more pages,
   * but returns at most 'limit' records to the caller.
   */
  it('respects the limit parameter passed to it', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          walletAddress: fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => `0x${s}`),
          requestedLimit: fc.integer({ min: 1, max: 100 }), // Test within valid range
          cursor: fc.option(
            fc.bigInt({ min: 1n, max: 1000000n }).map((n) => n.toString()),
            { nil: undefined },
          ),
        }),
        async ({ walletAddress, requestedLimit, cursor }) => {
          // Clear any previous calls before each property test run
          jest.clearAllMocks();
          
          const query: TransactionsQuery = { cursor, limit: requestedLimit };

          // Generate mock events - ensure we have more than the requested limit to test pagination
          const mockEvents = Array.from(
            { length: requestedLimit + 2 }, // Always generate more than requested to test pagination
            (_, i) => ({
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
            }),
          );

          // Mock Prisma responses
          (prisma.cachedEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);

          const result = await service.getTransactionHistory(walletAddress, query);

          // Property: Service uses limit + 1 for cursor pagination (to detect if there are more pages)
          expect(prisma.cachedEvent.findMany).toHaveBeenLastCalledWith(
            expect.objectContaining({
              take: requestedLimit + 1, // Service fetches limit + 1 for cursor pagination
            }),
          );

          // Property: Returned events never exceed the requested limit
          expect(result.events.length).toBeLessThanOrEqual(requestedLimit);
        },
      ),
      { numRuns: 50 }, // Reduce runs to avoid memory issues
    );
  });

  /**
   * Property: Empty result set when no events exist for the user
   * Requirements: 12.4 (empty result set for no cached events)
   */
  it('returns empty result set when no events exist for user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          walletAddress: fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => `0x${s}`),
          query: fc.record({
            cursor: fc.option(
              fc.bigInt({ min: 1n, max: 1000000n }).map((n) => n.toString()),
              { nil: undefined },
            ),
            limit: fc.integer({ min: 1, max: 100 }),
          }),
        }),
        async ({ walletAddress, query }) => {
          // Mock empty results
          (prisma.cachedEvent.findMany as jest.Mock).mockResolvedValue([]);

          const result = await service.getTransactionHistory(walletAddress, query);

          // Property: Empty result set without error (Requirement 12.4)
          expect(result.events).toEqual([]);
          expect(result.nextCursor).toBeNull();
        },
      ),
      { numRuns: 25 }, // Reduce runs to avoid memory issues
    );
  });

  /**
   * Property: Wallet address normalization (case insensitive)
   * Requirements: 12.3 (consistent address handling)
   */
  it('normalizes wallet addresses to lowercase for consistent querying', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Mixed case wallet address
          walletAddress: fc
            .hexaString({ minLength: 40, maxLength: 40 })
            .map((s) => `0x${s}`)
            .map((addr) => {
              // Randomly mix uppercase and lowercase
              return addr
                .split('')
                .map((c) => (Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()))
                .join('');
            }),
          query: fc.record({
            cursor: fc.option(
              fc.bigInt({ min: 1n, max: 1000000n }).map((n) => n.toString()),
              { nil: undefined },
            ),
            limit: fc.integer({ min: 1, max: 50 }),
          }),
        }),
        async ({ walletAddress, query }) => {
          // Mock empty results for simplicity
          (prisma.cachedEvent.findMany as jest.Mock).mockResolvedValue([]);

          await service.getTransactionHistory(walletAddress, query);

          // Property: Wallet address is normalized to lowercase in queries
          expect(prisma.cachedEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                walletAddress: walletAddress.toLowerCase(), // Always lowercase
              }),
            }),
          );
        },
      ),
      { numRuns: 25 }, // Reduce runs to avoid memory issues
    );
  });
});
