/**
 * Property-based tests for ChainRead service (Req 1.4, 1.5).
 * 
 * **Property 1: Cached financial values carry provenance and honor 30s staleness**
 * **Validates: Requirements 1.4, 1.5**
 */

import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { ChainReadService } from './chain-read.service';
import { RedisService } from './redis.service';
import { EnvService } from '../config/env.service';
import { PrismaService } from '../prisma/prisma.service';
import { generateCacheKey, isStale, STALENESS_THRESHOLD_MS } from './chain-read.types';
import type { ContractName } from '@bfn/shared';
import type { ReadParams, ReadResult } from './chain-read.types';

// Mock viem to avoid actual network calls
jest.mock('viem', () => ({
  createPublicClient: jest.fn(() => ({
    getBlockNumber: jest.fn().mockResolvedValue(BigInt(123456)),
  })),
  http: jest.fn(),
  baseSepolia: {},
}));

describe('ChainReadService', () => {
  let service: ChainReadService;

  const mockEnvService = {
    baseSepolia: 'http://localhost:8545',
    redisUrl: 'redis://localhost:6379',
  };

  const mockPrismaService = {
    cachedReadValue: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainReadService,
        { provide: EnvService, useValue: mockEnvService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<ChainReadService>(ChainReadService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Property 1: Cached financial values carry provenance and honor 30s staleness', () => {
    // Arbitraries for generating test data
    const contractArb = fc.constantFrom<ContractName>(
      'Registry', 'SavingsVault', 'CommunityTreasury', 'Education', 'Governance'
    );

    const functionNameArb = fc.oneof(
      fc.constant('balanceOf'),
      fc.constant('getProfile'),
      fc.constant('portfolioValue'),
      fc.constant('ownershipShare'),
      fc.constant('votingPowerOf')
    );

    const argsArb = fc.option(
      fc.array(fc.oneof(
        fc.string(),
        fc.integer(),
        fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`)
      ), { maxLength: 3 }),
      { nil: undefined }
    );

    const readParamsArb = fc.record({
      contract: contractArb,
      functionName: functionNameArb,
      args: argsArb,
    }) as fc.Arbitrary<ReadParams>;

    // Property 1.1: Fresh cache reads return cached values with correct provenance
    it('should return cached values with provenance when cache is fresh', async () => {
      await fc.assert(
        fc.asyncProperty(readParamsArb, async (params) => {
          // Arrange: Mock a fresh cached entry
          const cacheKey = generateCacheKey(params.contract, params.functionName, params.args);
          const now = new Date();
          const cachedEntry = {
            contractAddress: '0x1234567890123456789012345678901234567890',
            functionName: params.functionName,
            args: params.args ?? [],
            value: '1337',
            blockNumber: '12345',
            fetchedAt: now.toISOString(),
          };

          mockRedisService.get.mockResolvedValue(JSON.stringify(cachedEntry));

          // Act
          const result: ReadResult = await service.read(params);

          // Assert: Result has correct structure and provenance
          expect(result).toHaveProperty('value');
          expect(result).toHaveProperty('provenance');
          expect(result.provenance).toHaveProperty('contractAddress');
          expect(result.provenance).toHaveProperty('blockNumber');
          expect(result.provenance).toHaveProperty('fetchedAt');

          // Verify provenance data matches cache
          expect(result.provenance.contractAddress).toBe(cachedEntry.contractAddress);
          expect(result.provenance.blockNumber).toBe(BigInt(cachedEntry.blockNumber));
          expect(result.value).toBe(cachedEntry.value);

          // Verify Redis was called with correct cache key
          expect(mockRedisService.get).toHaveBeenCalledWith(cacheKey);
        }),
        { numRuns: 50 } // Reduced runs for faster test execution
      );
    }, 30000);

    // Property 1.2: Stale cache entries trigger contract reads and update cache
    it('should refresh stale cache entries and return new values with provenance', async () => {
      await fc.assert(
        fc.asyncProperty(readParamsArb, async (params) => {
          // Arrange: Mock a stale cached entry (older than 30 seconds)
          const cacheKey = generateCacheKey(params.contract, params.functionName, params.args);
          const staleTime = new Date(Date.now() - STALENESS_THRESHOLD_MS - 1000); // 1 second past threshold
          const staleCachedEntry = {
            contractAddress: '0x1234567890123456789012345678901234567890',
            functionName: params.functionName,
            args: params.args ?? [],
            value: 'stale_value',
            blockNumber: '12345',
            fetchedAt: staleTime.toISOString(),
          };

          mockRedisService.get.mockResolvedValue(JSON.stringify(staleCachedEntry));
          mockRedisService.set.mockResolvedValue(undefined);

          // Act
          const result: ReadResult = await service.read(params);

          // Assert: Should have triggered a contract read (not returned stale value)
          expect(result.value).not.toBe('stale_value'); // Should be a new simulated value
          expect(result).toHaveProperty('provenance');
          
          // Verify provenance has current timestamp (within last few seconds)
          const fetchedAt = new Date(result.provenance.fetchedAt);
          const timeDiff = Date.now() - fetchedAt.getTime();
          expect(timeDiff).toBeLessThan(5000); // Within 5 seconds (generous for test execution)

          // Verify new value was cached in Redis
          expect(mockRedisService.set).toHaveBeenCalledWith(
            cacheKey,
            expect.stringContaining(params.functionName)
          );
        }),
        { numRuns: 50 } // Reduced runs for faster test execution
      );
    }, 30000);

    // Property 1.3: Cache miss triggers contract read and stores result with provenance
    it('should handle cache miss by reading contract and storing result with provenance', async () => {
      await fc.assert(
        fc.asyncProperty(readParamsArb, async (params) => {
          // Arrange: Mock cache miss
          const cacheKey = generateCacheKey(params.contract, params.functionName, params.args);
          mockRedisService.get.mockResolvedValue(null);
          mockRedisService.set.mockResolvedValue(undefined);

          // Act
          const result: ReadResult = await service.read(params);

          // Assert: Should return fresh value with provenance
          expect(result).toHaveProperty('value');
          expect(result).toHaveProperty('provenance');
          expect(result.provenance.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
          expect(typeof result.provenance.blockNumber).toBe('bigint');
          expect(result.provenance.blockNumber).toBeGreaterThan(0n);

          // Verify Redis cache was populated
          expect(mockRedisService.get).toHaveBeenCalledWith(cacheKey);
          expect(mockRedisService.set).toHaveBeenCalledWith(
            cacheKey,
            expect.stringContaining(params.functionName)
          );
        }),
        { numRuns: 50 } // Reduced runs for faster test execution
      );
    }, 30000);

    // Property 1.4: Staleness function correctly identifies stale entries
    it('should correctly identify stale vs fresh timestamps', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: STALENESS_THRESHOLD_MS * 2 }),
          (ageMs) => {
            // Arrange: Create a timestamp with the specified age
            const fetchedAt = new Date(Date.now() - ageMs);

            // Act
            const result = isStale(fetchedAt);

            // Assert: Staleness should match threshold
            const expectedStale = ageMs > STALENESS_THRESHOLD_MS;
            expect(result).toBe(expectedStale);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 1.5: Cache key generation is deterministic and unique
    it('should generate deterministic and unique cache keys', async () => {
      await fc.assert(
        fc.property(
          readParamsArb,
          readParamsArb,
          (params1, params2) => {
            // Act
            const key1 = generateCacheKey(params1.contract, params1.functionName, params1.args);
            const key2 = generateCacheKey(params2.contract, params2.functionName, params2.args);
            
            // Assert: Keys should be equal iff parameters are equal
            const paramsEqual = (
              params1.contract === params2.contract &&
              params1.functionName === params2.functionName &&
              JSON.stringify(params1.args) === JSON.stringify(params2.args)
            );

            if (paramsEqual) {
              expect(key1).toBe(key2);
            } else {
              expect(key1).not.toBe(key2);
            }

            // Assert: All keys should have the expected prefix format
            expect(key1).toMatch(/^bfn:read:[^:]+:[^:]+:/);
            expect(key2).toMatch(/^bfn:read:[^:]+:[^:]+:/);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 1.6: Redis connection failure doesn't break service (graceful degradation)
    it('should handle Redis failures gracefully and still return contract reads', async () => {
      await fc.assert(
        fc.asyncProperty(readParamsArb, async (params) => {
          // Arrange: Mock Redis failure
          mockRedisService.get.mockRejectedValue(new Error('Redis connection failed'));
          mockRedisService.set.mockRejectedValue(new Error('Redis connection failed'));

          // Act & Assert: Should not throw, should still return a value
          const result = await service.read(params);
          
          expect(result).toHaveProperty('value');
          expect(result).toHaveProperty('provenance');
          expect(result.provenance.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
        }),
        { numRuns: 50 } // Reduced runs for faster test execution
      );
    }, 30000);
  });

  describe('Cache key utility functions', () => {
    // Unit tests for cache key generation edge cases
    it('should handle empty args correctly', () => {
      const key1 = generateCacheKey('Registry', 'isRegistered', []);
      const key2 = generateCacheKey('Registry', 'isRegistered', undefined);
      const key3 = generateCacheKey('Registry', 'isRegistered');

      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
      expect(key1).toMatch(/^bfn:read:Registry:isRegistered:$/);
    });

    it('should handle complex args correctly', () => {
      const args = ['0x742d35Cc6663C462B319Aacd185bd1F6D25084CF', 123, true];
      const key = generateCacheKey('SavingsVault', 'balanceOf', args);
      
      expect(key).toContain('SavingsVault');
      expect(key).toContain('balanceOf');
      expect(key).toContain(JSON.stringify(args));
    });
  });
});