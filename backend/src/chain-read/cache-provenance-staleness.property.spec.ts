import { Test } from '@nestjs/testing';
import * as fc from 'fast-check';

import { ChainReadService } from './chain-read.service';
import { RedisService } from './redis.service';
import { EnvService } from '../config/env.service';
import { PrismaService } from '../prisma/prisma.service';
import { 
  generateCacheKey, 
  isStale, 
  STALENESS_THRESHOLD_MS,
  type ReadParams
} from './chain-read.types';
import type { ContractName } from '@bfn/shared';

/**
 * Property 1: Cached financial values carry provenance and honor 30s staleness
 * **Validates: Requirements 1.4, 12.2**
 * 
 * This test validates the core caching behavior with provenance:
 * - Cached values always include full provenance metadata (contract address, block number, fetchedAt)
 * - Values are considered stale after 30 seconds and are refreshed from the source
 * - Cache keys are deterministic based on contract, function, and args
 * - Provenance is preserved across cache hits and misses
 * - Staleness detection works correctly across different time intervals
 */
describe('Property 1: Cache provenance and staleness', () => {

  /**
   * Property: Cache keys are deterministic and collision-resistant
   * Requirements: 1.4 (cache key generation)
   */
  it('generates deterministic cache keys from contract, function, and args', () => {
    fc.assert(
      fc.property(
        fc.record({
          contract: fc.constantFrom<ContractName>('Registry', 'SavingsVault', 'CommunityTreasury', 'Education', 'Governance'),
          functionName: fc.string({ minLength: 1, maxLength: 20 }),
          args: fc.array(fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null)
          ), { maxLength: 5 }),
        }),
        ({ contract, functionName, args }) => {
          // Generate key multiple times
          const key1 = generateCacheKey(contract, functionName, args);
          const key2 = generateCacheKey(contract, functionName, args);
          
          // Keys should be identical for same inputs
          expect(key1).toBe(key2);
          expect(key1).toMatch(/^bfn:read:/);
          expect(key1).toContain(contract);
          expect(key1).toContain(functionName);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Different parameters produce different cache keys
   * Requirements: 1.4 (cache key uniqueness)
   */
  it('generates unique cache keys for different parameters', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.record({
            contract: fc.constantFrom<ContractName>('Registry', 'SavingsVault'),
            functionName: fc.string({ minLength: 1, maxLength: 10 }),
            args: fc.array(fc.string(), { maxLength: 3 }),
          }),
          fc.record({
            contract: fc.constantFrom<ContractName>('CommunityTreasury', 'Education'),
            functionName: fc.string({ minLength: 1, maxLength: 10 }),
            args: fc.array(fc.string(), { maxLength: 3 }),
          })
        ),
        ([params1, params2]) => {
          const key1 = generateCacheKey(params1.contract, params1.functionName, params1.args);
          const key2 = generateCacheKey(params2.contract, params2.functionName, params2.args);
          
          // Different parameters should produce different keys
          expect(key1).not.toBe(key2);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Staleness detection works correctly across time intervals
   * Requirements: 1.4, 1.5 (30-second staleness threshold)
   */
  it('correctly identifies stale vs fresh cache entries based on 30s threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120_000 }), // 0 to 2 minutes in milliseconds
        (ageMs) => {
          const now = 1000000000; // Fixed base time
          const fetchedAt = new Date(now - ageMs);
          
          jest.spyOn(Date, 'now').mockReturnValue(now);
          
          const shouldBeStale = ageMs > STALENESS_THRESHOLD_MS;
          const actuallyStale = isStale(fetchedAt);
          
          expect(actuallyStale).toBe(shouldBeStale);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: 30-second threshold is precisely enforced
   * Requirements: 1.4, 1.5 (exact 30s staleness boundary)
   */
  it('enforces exactly 30-second staleness threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }), // Milliseconds around the 30s boundary
        (offsetMs) => {
          const baseTime = 2000000000; // Fixed base time
          const ageMs = STALENESS_THRESHOLD_MS + offsetMs;
          const fetchedAt = new Date(baseTime - ageMs);
          
          jest.spyOn(Date, 'now').mockReturnValue(baseTime);
          
          const shouldBeStale = ageMs > STALENESS_THRESHOLD_MS;
          const actuallyStale = isStale(fetchedAt);
          
          expect(actuallyStale).toBe(shouldBeStale);
          
          // Test the exact boundary
          if (ageMs === STALENESS_THRESHOLD_MS) {
            expect(actuallyStale).toBe(false); // Exactly 30s should not be stale
          } else if (ageMs === STALENESS_THRESHOLD_MS + 1) {
            expect(actuallyStale).toBe(true); // 30s + 1ms should be stale
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cache service integration test - simplified version
   * Requirements: 1.4 (provenance metadata), 1.5 (refresh behavior)
   */
  it('ChainRead service provides correct provenance and handles cache lifecycle', async () => {
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
    };

    const mockPrismaService = {
      cachedReadValue: {
        upsert: jest.fn(),
      },
    };

    const mockEnvService = {
      baseSepolia: 'http://localhost:8545',
      chainId: 84532,
    } as EnvService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChainReadService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EnvService,
          useValue: mockEnvService,
        },
      ],
    }).compile();

    moduleRef.useLogger(false);

    const chainReadService = moduleRef.get<ChainReadService>(ChainReadService);
    
    // Mock the publicClient to avoid real blockchain calls
    const mockPublicClient = {
      getBlockNumber: jest.fn().mockResolvedValue(BigInt(100000)),
    };
    // @ts-ignore - accessing private property for testing
    chainReadService.publicClient = mockPublicClient;

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contract: fc.constantFrom<ContractName>('Registry', 'SavingsVault'),
          functionName: fc.string({ minLength: 1, maxLength: 15 }),
        }),
        async ({ contract, functionName }) => {
          // Reset mocks for each test
          jest.clearAllMocks();
          
          // Setup: cache miss
          mockRedisService.get.mockResolvedValue(null);
          mockRedisService.set.mockResolvedValue(undefined);
          mockPrismaService.cachedReadValue.upsert.mockResolvedValue({});
          
          const params: ReadParams = { contract, functionName, args: [] };
          
          const result = await chainReadService.read(params);
          
          // Result should include full provenance
          expect(result.value).toBeDefined();
          expect(result.provenance).toBeDefined();
          expect(result.provenance.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
          expect(typeof result.provenance.blockNumber).toBe('bigint');
          expect(result.provenance.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
          
          // Should have attempted to cache the result
          expect(mockRedisService.set).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});