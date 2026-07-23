import { Test } from '@nestjs/testing';
import { ChainReadService } from './chain-read.service';
import { RedisService } from './redis.service';
import { EnvService } from '../config/env.service';
import { PrismaService } from '../prisma/prisma.service';
import { type ReadParams } from './chain-read.types';

/**
 * End-to-End Tests for Read-Failure Handling in Realistic Scenarios
 * **Validates: Requirements 1.6, 1.7**
 * 
 * Tests complete failure scenarios that might occur in production,
 * ensuring proper behavior across the entire read-through cache system.
 */
describe('ChainRead Read-Failure E2E', () => {
  let service: ChainReadService;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockPrismaService: any;
  let mockEnvService: EnvService;

  beforeEach(async () => {
    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as any;

    mockPrismaService = {
      cachedReadValue: {
        upsert: jest.fn(),
      },
    };

    mockEnvService = {
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
    service = moduleRef.get<ChainReadService>(ChainReadService);
  });

  describe('Production Failure Scenarios', () => {

    /**
     * Scenario: Dashboard load during network outage (Req 11.5, 11.6)
     * When users try to load their dashboard but the blockchain node is down
     */
    it('should handle dashboard load failure gracefully during network outage', async () => {
      // Setup: Multiple dashboard data requests
      const dashboardRequests: ReadParams[] = [
        { contract: 'SavingsVault', functionName: 'portfolioValue', args: ['0xuser1'] },
        { contract: 'Registry', functionName: 'reputationOf', args: ['0xuser1'] },
        { contract: 'CommunityTreasury', functionName: 'ownershipShare', args: [1, '0xuser1'] },
        { contract: 'Education', functionName: 'hasCertificate', args: ['0xuser1', 'course-1'] },
      ];

      // Setup: All cache misses (fresh dashboard load)
      mockRedisService.get.mockResolvedValue(null);

      // Mock complete network outage
      const networkOutageError = new Error('ECONNREFUSED: Connection refused');
      const mockPublicClient = {
        getBlockNumber: jest.fn().mockRejectedValue(networkOutageError),
      };
      // @ts-ignore
      service.publicClient = mockPublicClient;

      // Execute: Attempt to load all dashboard data
      const promises = dashboardRequests.map(req => service.read(req));
      const results = await Promise.allSettled(promises);

      // Verify: All requests failed appropriately
      results.forEach((result, index) => {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.reason.message).toContain('contract unavailable');
          expect(result.reason.message).toContain(dashboardRequests[index]!.contract);
        }
      });

      // Verify: No stale data was served (Req 1.7)
      expect(mockRedisService.set).not.toHaveBeenCalled();
    });

    /**
     * Scenario: Partial network recovery (some reads succeed, others fail)
     * Tests mixed success/failure scenarios common in unstable network conditions
     */
    it('should handle partial network recovery correctly', async () => {
      const params1: ReadParams = { contract: 'Registry', functionName: 'isRegistered', args: ['0xuser1'] };
      const params2: ReadParams = { contract: 'SavingsVault', functionName: 'availableBalance', args: ['0xuser1'] };

      // Setup: Cache misses
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);
      mockPrismaService.cachedReadValue.upsert.mockResolvedValue({});

      // Create separate services with different mock behavior
      const service1 = service;
      const service2 = await Test.createTestingModule({
        providers: [
          ChainReadService,
          { provide: RedisService, useValue: mockRedisService },
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: EnvService, useValue: mockEnvService },
        ],
      }).compile().then(m => { m.useLogger(false); return m.get<ChainReadService>(ChainReadService); });

      // Mock: First service fails, second succeeds
      const mockPublicClient1 = {
        getBlockNumber: jest.fn().mockRejectedValue(new Error('Timeout')),
      };
      const mockPublicClient2 = {
        getBlockNumber: jest.fn().mockResolvedValue(BigInt(100000)),
      };
      
      // @ts-ignore
      service1.publicClient = mockPublicClient1;
      // @ts-ignore
      service2.publicClient = mockPublicClient2;

      // Execute both reads
      const [result1, result2] = await Promise.allSettled([
        service1.read(params1),
        service2.read(params2),
      ]);

      // Verify: First failed, second succeeded
      expect(result1.status).toBe('rejected');
      expect(result2.status).toBe('fulfilled');

      if (result2.status === 'fulfilled') {
        expect(result2.value.value).toBeDefined();
        expect(result2.value.provenance).toBeDefined();
        expect(result2.value.provenance.blockNumber).toBe(BigInt(100000));
      }
    });

    /**
     * Scenario: Cache corruption during read failure (Req 1.4, 1.5)
     * Tests behavior when cached data is corrupted and contract is unavailable
     */
    it('should handle cache corruption and contract unavailability', async () => {
      const params: ReadParams = {
        contract: 'Education',
        functionName: 'hasCertificate',
        args: ['0xuser1', 'course-123'],
      };

      // Setup: Corrupted cache data (invalid JSON)
      mockRedisService.get.mockResolvedValue('{"invalid":json');

      // Mock contract unavailability
      const mockPublicClient = {
        getBlockNumber: jest.fn().mockRejectedValue(new Error('Network error')),
      };
      // @ts-ignore
      service.publicClient = mockPublicClient;

      // Execute - should fail gracefully
      await expect(service.read(params)).rejects.toThrow(/Failed to read Education\.hasCertificate.*contract unavailable/);

      // Should have attempted contract read after cache failure
      expect(mockPublicClient.getBlockNumber).toHaveBeenCalled();
    });

  });

  describe('Error Recovery Patterns', () => {

    /**
     * Test: Service recovery after intermittent failures (Req 1.6)
     * Verifies the system can recover and serve fresh data after failures
     */
    it('should recover and serve fresh data after intermittent failures', async () => {
      const params: ReadParams = {
        contract: 'Registry',
        functionName: 'reputationOf',
        args: ['0xuser1'],
      };

      // Setup: Cache miss
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);
      mockPrismaService.cachedReadValue.upsert.mockResolvedValue({});

      // First attempt: All retries fail
      const mockPublicClientFailing = {
        getBlockNumber: jest.fn().mockRejectedValue(new Error('Network timeout')),
      };
      // @ts-ignore
      service.publicClient = mockPublicClientFailing;

      // First attempt should fail
      await expect(service.read(params)).rejects.toThrow(/Failed to read Registry\.reputationOf.*contract unavailable/);

      // Second attempt: Mock recovery
      const mockPublicClientWorking = {
        getBlockNumber: jest.fn().mockResolvedValue(BigInt(200000)),
      };
      // @ts-ignore
      service.publicClient = mockPublicClientWorking;

      // Second attempt should succeed
      const result = await service.read(params);
      expect(result.value).toBeDefined();
      expect(result.provenance.blockNumber).toBe(BigInt(200000));
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('bfn:read:Registry:reputationOf'),
        expect.stringContaining('"blockNumber":"200000"')
      );
    });

  });

  describe('Performance Under Failure', () => {

    /**
     * Test: Failure response time should be reasonable (Req 1.6, 1.7)
     * Even with retries, total failure time should be bounded
     */
    it('should fail within reasonable time bounds despite retries', async () => {
      const params: ReadParams = {
        contract: 'SavingsVault',
        functionName: 'portfolioValue',
        args: ['0xuser1'],
      };

      // Setup: Cache miss
      mockRedisService.get.mockResolvedValue(null);

      // Mock immediate failures (no timeout delay)
      const mockPublicClient = {
        getBlockNumber: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      };
      // @ts-ignore
      service.publicClient = mockPublicClient;

      const startTime = Date.now();

      await expect(service.read(params)).rejects.toThrow(/Failed to read SavingsVault\.portfolioValue.*contract unavailable/);

      const totalTime = Date.now() - startTime;

      // With exponential backoff: 0 + 100 + 200 + 400 = 700ms + execution overhead
      // Should be well under 5 seconds for immediate failures
      expect(totalTime).toBeLessThan(5000);
      expect(mockPublicClient.getBlockNumber).toHaveBeenCalledTimes(4); // 1 + 3 retries
    });

  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});