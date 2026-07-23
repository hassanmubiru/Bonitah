/**
 * Property 2: Stale reads are refreshed from the source contract
 * **Validates: Requirements 1.5**
 * 
 * This test validates that the ChainRead service correctly refreshes stale cached values:
 * - When a cached value is stale (>30 seconds old), it should be refreshed from the contract
 * - Fresh values should be returned from cache without contract calls
 * - The service should update the cache with new values from the contract
 * - Provenance metadata should be updated with fresh block numbers and timestamps
 */

import { Test, type TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';

import { EnvService } from '../config/env.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChainReadService } from './chain-read.service';
import { RedisService } from './redis.service';
import { 
  generateCacheKey, 
  isStale, 
  STALENESS_THRESHOLD_MS,
  type ReadParams,
  type CachedReadEntry 
} from './chain-read.types';
import type { ContractName } from '@bfn/shared';

describe('Property 2: Stale reads are refreshed from the source contract', () => {
  let service: ChainReadService;
  let redis: RedisService;
  let prisma: PrismaService;

  // Mock viem client methods
  const mockGetBlockNumber = jest.fn();
  const mockPublicClient = {
    getBlockNumber: mockGetBlockNumber,
  };

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainReadService,
        {
          provide: EnvService,
          useValue: {
            baseSepolia: 'https://sepolia.base.org',
          } as EnvService,
        },
        {
          provide: PrismaService,
          useValue: {
            cachedReadValue: {
              upsert: jest.fn(),
            },
          } as unknown as PrismaService,
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            isConnected: jest.fn().mockReturnValue(true),
          } as unknown as RedisService,
        },
      ],
    }).compile();

    service = module.get<ChainReadService>(ChainReadService);
    redis = module.get<RedisService>(RedisService);
    prisma = module.get<PrismaService>(PrismaService);

    // Mock the public client
    (service as any).publicClient = mockPublicClient;

    // Reset mocks after setup
    jest.clearAllMocks();
  });

  /**
   * Property: Stale cached values are refreshed from the source contract (Req 1.5)
   */
  it('refreshes stale cached values from the source contract', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test parameters
        fc.record({
          contract: fc.constantFrom<ContractName>(
            'Registry', 
            'SavingsVault', 
            'CommunityTreasury', 
            'Education', 
            'Governance'
          ),
          functionName: fc.constantFrom(
            'availableBalance',
            'portfolioValue', 
            'reputationOf',
            'treasuryBalance',
            'votingPowerOf'
          ),
          args: fc.oneof(
            fc.constant([]), // No args
            fc.array(fc.string(), { minLength: 1, maxLength: 2 }) // 1-2 string args
          ),
          // Test different staleness levels
          ageInSeconds: fc.integer({ min: 31, max: 300 }), // 31 seconds to 5 minutes (stale)
          // Different blockchain state changes
          initialBlockNumber: fc.integer({ min: 1000, max: 9999 }).map(n => BigInt(n)),
          newBlockNumber: fc.integer({ min: 10000, max: 99999 }).map(n => BigInt(n)),
          initialValue: fc.integer({ min: 1000, max: 99999 }).map(n => n.toString()),
          newValue: fc.integer({ min: 1000, max: 99999 }).map(n => n.toString()),
        }),
        async ({ 
          contract, 
          functionName, 
          args, 
          ageInSeconds, 
          initialBlockNumber, 
          newBlockNumber, 
          initialValue, 
          newValue 
        }) => {
          // Clear mocks for this iteration
          jest.clearAllMocks();
          
          // Generate cache key
          const readParams: ReadParams = { contract, functionName, args };
          const cacheKey = generateCacheKey(contract, functionName, args);
          
          // Create a stale cache entry
          const staleTimestamp = new Date(Date.now() - (ageInSeconds * 1000));
          const staleCacheEntry: CachedReadEntry = {
            contractAddress: '0x1234567890123456789012345678901234567890',
            functionName,
            args,
            value: initialValue,
            blockNumber: initialBlockNumber,
            fetchedAt: staleTimestamp,
          };
          
          // Verify the entry is actually stale
          expect(isStale(staleTimestamp)).toBe(true);
          expect(Date.now() - staleTimestamp.getTime()).toBeGreaterThan(STALENESS_THRESHOLD_MS);
          
          // Mock Redis to return the stale cache entry (with BigInt serialized as string)
          const staleCacheEntryJson = JSON.stringify(staleCacheEntry, (_key, value) => 
            typeof value === 'bigint' ? value.toString() : value
          );
          
          // Mock Redis to return the stale cache entry
          (redis.get as jest.Mock).mockResolvedValueOnce(staleCacheEntryJson);
          
          // Mock the contract read to return new data
          mockGetBlockNumber.mockResolvedValueOnce(newBlockNumber);
          
          // Mock Redis set for caching the new value
          (redis.set as jest.Mock).mockResolvedValueOnce(undefined);
          
          // Mock Prisma upsert for database persistence
          (prisma.cachedReadValue.upsert as jest.Mock).mockResolvedValueOnce({
            id: 'test-id',
            cacheKey,
            contractAddress: '0x1234567890123456789012345678901234567890',
            blockNumber: newBlockNumber,
            value: newValue,
            fetchedAt: expect.any(Date),
          });

          // Mock the simulated contract read to return the new value
          // We need to spy on the private simulateContractRead method
          const simulateContractReadSpy = jest.spyOn(service as any, 'simulateContractRead');
          simulateContractReadSpy.mockReturnValueOnce(newValue);

          // Call the service
          const result = await service.read(readParams);

          // Assertions for Property 2: Stale reads are refreshed from the source contract

          // 1. Service should have attempted to read from Redis cache first
          expect(redis.get).toHaveBeenCalledWith(cacheKey);
          
          // 2. Since cache was stale, service should have read from the contract
          expect(mockGetBlockNumber).toHaveBeenCalledTimes(1);
          expect(simulateContractReadSpy).toHaveBeenCalledWith(readParams);
          
          // 3. Service should have cached the new value in Redis
          expect(redis.set).toHaveBeenCalledWith(
            cacheKey,
            expect.stringContaining(`"value":"${newValue}"`)
          );
          
          // 4. Service should have persisted the new value in the database
          expect(prisma.cachedReadValue.upsert).toHaveBeenCalledWith({
            where: { cacheKey },
            update: {
              contractAddress: expect.any(String), // Any valid contract address
              blockNumber: newBlockNumber,
              value: newValue,
              fetchedAt: expect.any(Date),
            },
            create: {
              cacheKey,
              contractAddress: expect.any(String), // Any valid contract address
              blockNumber: newBlockNumber,
              value: newValue,
              fetchedAt: expect.any(Date),
            },
          });
          
          // 5. Returned result should contain the new value and updated provenance
          expect(result).toEqual({
            value: newValue,
            provenance: {
              contractAddress: expect.any(String), // Any valid contract address
              blockNumber: newBlockNumber,
              fetchedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
            },
          });
          
          // 6. The returned value should be the new value (refreshed from contract)
          expect(result.value).toBe(newValue);
          expect(result.provenance.blockNumber).toBe(newBlockNumber);
          
          // 7. The returned value should have updated provenance (different from stale cache)
          expect(result.provenance.blockNumber).not.toBe(initialBlockNumber);
          
          // 7. The fetched timestamp should be recent (within last 5 seconds)
          const fetchedAt = new Date(result.provenance.fetchedAt);
          const timeDiff = Date.now() - fetchedAt.getTime();
          expect(timeDiff).toBeLessThan(5000); // Less than 5 seconds old
          expect(timeDiff).toBeGreaterThanOrEqual(0); // Not in the future

          // Cleanup
          simulateContractReadSpy.mockRestore();
        }
      ),
      { 
        numRuns: 100, // Minimum 100 iterations as specified
        timeout: 30000 // 30 second timeout for async operations
      }
    );
  });

  /**
   * Property: Fresh cached values are returned without contract calls (performance test)
   */
  it('returns fresh cached values without calling the contract', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contract: fc.constantFrom<ContractName>(
            'Registry', 
            'SavingsVault', 
            'CommunityTreasury'
          ),
          functionName: fc.constantFrom('balanceOf', 'reputationOf', 'portfolioValue'),
          args: fc.array(fc.string(), { minLength: 0, maxLength: 2 }),
          // Test fresh values (less than 30 seconds old)
          ageInSeconds: fc.integer({ min: 0, max: 29 }), // 0 to 29 seconds (fresh)
          blockNumber: fc.integer({ min: 1000, max: 99999 }).map(n => BigInt(n)),
          cachedValue: fc.integer({ min: 1000, max: 99999 }).map(n => n.toString()),
        }),
        async ({ contract, functionName, args, ageInSeconds, blockNumber, cachedValue }) => {
          // Clear mocks for this iteration
          jest.clearAllMocks();
          
          const readParams: ReadParams = { contract, functionName, args };
          const cacheKey = generateCacheKey(contract, functionName, args);
          
          // Create a fresh cache entry
          const freshTimestamp = new Date(Date.now() - (ageInSeconds * 1000));
          const freshCacheEntry: CachedReadEntry = {
            contractAddress: '0x1234567890123456789012345678901234567890',
            functionName,
            args,
            value: cachedValue,
            blockNumber,
            fetchedAt: freshTimestamp,
          };
          
          // Verify the entry is NOT stale
          expect(isStale(freshTimestamp)).toBe(false);
          
          // Mock Redis to return the fresh cache entry (with BigInt serialized as string)
          const freshCacheEntryJson = JSON.stringify(freshCacheEntry, (_key, value) => 
            typeof value === 'bigint' ? value.toString() : value
          );
          (redis.get as jest.Mock).mockResolvedValueOnce(freshCacheEntryJson);
          
          // Spy on contract read methods to ensure they're NOT called
          const simulateContractReadSpy = jest.spyOn(service as any, 'simulateContractRead');

          // Call the service
          const result = await service.read(readParams);

          // Assertions for fresh value behavior

          // 1. Service should have read from Redis cache
          expect(redis.get).toHaveBeenCalledWith(cacheKey);
          
          // 2. Service should NOT have called the contract (fresh value optimization)
          expect(mockGetBlockNumber).not.toHaveBeenCalled();
          expect(simulateContractReadSpy).not.toHaveBeenCalled();
          
          // 3. Service should NOT have updated the cache (value is fresh)
          expect(redis.set).not.toHaveBeenCalled();
          expect(prisma.cachedReadValue.upsert).not.toHaveBeenCalled();
          
          // 4. Returned result should contain the cached value and original provenance
          expect(result).toEqual({
            value: cachedValue,
            provenance: {
              contractAddress: '0x1234567890123456789012345678901234567890',
              blockNumber,
              fetchedAt: freshTimestamp.toISOString(),
            },
          });

          // Cleanup
          simulateContractReadSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cache miss triggers contract read and caching
   */
  it('reads from contract and caches result when cache is empty', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contract: fc.constantFrom<ContractName>('Registry', 'SavingsVault'),
          functionName: fc.constantFrom('portfolioValue', 'availableBalance'),
          args: fc.array(fc.string(), { maxLength: 1 }),
          blockNumber: fc.integer({ min: 1000, max: 99999 }).map(n => BigInt(n)),
          contractValue: fc.integer({ min: 1000, max: 99999 }).map(n => n.toString()),
        }),
        async ({ contract, functionName, args, blockNumber, contractValue }) => {
          // Clear mocks for this iteration
          jest.clearAllMocks();
          
          const readParams: ReadParams = { contract, functionName, args };
          const cacheKey = generateCacheKey(contract, functionName, args);
          
          // Mock Redis to return null (cache miss)
          (redis.get as jest.Mock).mockResolvedValueOnce(null);
          
          // Mock contract read
          mockGetBlockNumber.mockResolvedValueOnce(blockNumber);
          
          // Mock Redis and Prisma for caching
          (redis.set as jest.Mock).mockResolvedValueOnce(undefined);
          (prisma.cachedReadValue.upsert as jest.Mock).mockResolvedValueOnce({});
          
          // Mock simulated contract read
          const simulateContractReadSpy = jest.spyOn(service as any, 'simulateContractRead');
          simulateContractReadSpy.mockReturnValueOnce(contractValue);

          // Call the service
          const result = await service.read(readParams);

          // Assertions for cache miss behavior

          // 1. Service should have attempted cache read
          expect(redis.get).toHaveBeenCalledWith(cacheKey);
          
          // 2. Service should have read from contract
          expect(mockGetBlockNumber).toHaveBeenCalledTimes(1);
          expect(simulateContractReadSpy).toHaveBeenCalledWith(readParams);
          
          // 3. Service should have cached the new value
          expect(redis.set).toHaveBeenCalledWith(
            cacheKey,
            expect.stringContaining(`"value":"${contractValue}"`)
          );
          
          // 4. Service should have persisted in database
          expect(prisma.cachedReadValue.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { cacheKey },
              update: expect.objectContaining({
                value: contractValue,
                blockNumber,
              }),
              create: expect.objectContaining({
                cacheKey,
                value: contractValue,
                blockNumber,
              }),
            })
          );
          
          // 5. Result should contain the contract value
          expect(result.value).toBe(contractValue);
          expect(result.provenance.blockNumber).toBe(blockNumber);

          // Cleanup
          simulateContractReadSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Staleness threshold enforcement is precise (boundary testing)
   */
  it('enforces 30-second staleness threshold precisely', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contract: fc.constantFrom<ContractName>('Registry', 'SavingsVault'),
          functionName: fc.constantFrom('balanceOf', 'reputationOf'),
          // Test values right around the 30-second boundary
          ageInMs: fc.integer({ min: STALENESS_THRESHOLD_MS - 1000, max: STALENESS_THRESHOLD_MS + 1000 }),
          cachedValue: fc.integer({ min: 100, max: 999 }).map(n => n.toString()),
          newValue: fc.integer({ min: 1000, max: 9999 }).map(n => n.toString()),
          blockNumber: fc.integer({ min: 1000, max: 9999 }).map(n => BigInt(n)),
          newBlockNumber: fc.integer({ min: 10000, max: 99999 }).map(n => BigInt(n)),
        }),
        async ({ contract, functionName, ageInMs, cachedValue, newValue, blockNumber, newBlockNumber }) => {
          // Clear mocks for this iteration
          jest.clearAllMocks();
          
          const readParams: ReadParams = { contract, functionName };
          const cacheKey = generateCacheKey(contract, functionName);
          
          // Create cache entry with specific age
          const timestamp = new Date(Date.now() - ageInMs);
          const cacheEntry: CachedReadEntry = {
            contractAddress: '0x1234567890123456789012345678901234567890',
            functionName,
            args: [],
            value: cachedValue,
            blockNumber,
            fetchedAt: timestamp,
          };
          
          const shouldBeStale = isStale(timestamp);
          
          // Mock Redis response (with BigInt serialized as string)
          const cacheEntryJson = JSON.stringify(cacheEntry, (_key, value) => 
            typeof value === 'bigint' ? value.toString() : value
          );
          (redis.get as jest.Mock).mockResolvedValueOnce(cacheEntryJson);
          
          // Mock contract read (only needed if stale)
          if (shouldBeStale) {
            mockGetBlockNumber.mockResolvedValueOnce(newBlockNumber);
            (redis.set as jest.Mock).mockResolvedValueOnce(undefined);
            (prisma.cachedReadValue.upsert as jest.Mock).mockResolvedValueOnce({});
            
            const simulateContractReadSpy = jest.spyOn(service as any, 'simulateContractRead');
            simulateContractReadSpy.mockReturnValueOnce(newValue);
          }

          // Call the service
          const result = await service.read(readParams);

          // Verify staleness behavior based on threshold
          if (shouldBeStale) {
            // Should have refreshed from contract
            expect(mockGetBlockNumber).toHaveBeenCalled();
            expect(result.value).toBe(newValue);
            expect(result.provenance.blockNumber).toBe(newBlockNumber);
          } else {
            // Should have returned cached value
            expect(mockGetBlockNumber).not.toHaveBeenCalled();
            expect(result.value).toBe(cachedValue);
            expect(result.provenance.blockNumber).toBe(blockNumber);
          }
          
          // Verify cache was accessed with correct key
          expect(redis.get).toHaveBeenCalledWith(cacheKey);
          
          // Verify staleness determination matches our expectation
          expect(ageInMs > STALENESS_THRESHOLD_MS).toBe(shouldBeStale);
        }
      ),
      { numRuns: 100 }
    );
  });
});