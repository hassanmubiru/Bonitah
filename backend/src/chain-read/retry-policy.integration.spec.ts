import { Test } from '@nestjs/testing';
import { ChainReadService } from './chain-read.service';
import { RedisService } from './redis.service';
import { EnvService } from '../config/env.service';
import { PrismaService } from '../prisma/prisma.service';
import { type ReadParams } from './chain-read.types';

/**
 * Integration Tests for Retry Policy Implementation
 * **Validates: Requirements 1.6, 1.7**
 * 
 * Tests actual retry timing, timeout behavior, and network failure escalation
 * using controlled timeout scenarios and timing measurements.
 */
describe('ChainRead Retry Policy Integration', () => {
  let service: ChainReadService;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockPrismaService: any;
  let mockEnvService: EnvService;
  let mockPublicClient: any;

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

    mockPublicClient = {
      getBlockNumber: jest.fn(),
    };

    // Replace the private publicClient property for testing
    // @ts-ignore - accessing private property for testing
    service.publicClient = mockPublicClient;
  });

  describe('Timeout Behavior', () => {

    /**
     * Test: Each attempt should timeout after 10 seconds (Req 1.6)
     */
    it('should timeout individual attempts after 10 seconds', async () => {
      const params: ReadParams = {
        contract: 'Registry',
        functionName: 'isRegistered',
        args: ['0x1234567890123456789012345678901234567890'],
      };

      // Setup: Cache miss
      mockRedisService.get.mockResolvedValue(null);

      // Mock a promise that hangs for longer than 10s
      mockPublicClient.getBlockNumber.mockImplementation(() => {
        return new Promise((resolve) => {
          // Never resolve - will be timed out
          setTimeout(resolve, 15000); // 15 seconds - longer than 10s timeout
        });
      });

      const startTime = Date.now();

      // Execute - should fail after attempting retries
      await expect(service.read(params)).rejects.toThrow(/Failed to read Registry\.isRegistered.*contract unavailable/);

      const totalTime = Date.now() - startTime;

      // Should have failed after multiple 10s attempts (4 attempts × 10s ≈ 40s plus backoff)
      // But accounting for test overhead, we'll check for a reasonable range
      expect(totalTime).toBeGreaterThan(10000); // At least one 10s timeout
      expect(totalTime).toBeLessThan(50000); // But not excessively long

      // Should have made multiple attempts
      expect(mockPublicClient.getBlockNumber).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    }, 60000); // 60s test timeout to allow for retries

    /**
     * Test: Fast failures should be retried without full timeout (Req 1.6)
     */
    it('should retry fast failures immediately without waiting for timeout', async () => {
      const params: ReadParams = {
        contract: 'SavingsVault',
        functionName: 'portfolioValue',
        args: ['0x1234567890123456789012345678901234567890'],
      };

      // Setup: Cache miss
      mockRedisService.get.mockResolvedValue(null);

      // Mock fast network error (immediate rejection)
      const networkError = new Error('ECONNREFUSED');
      mockPublicClient.getBlockNumber.mockRejectedValue(networkError);

      const startTime = Date.now();

      // Execute - should fail quickly after retries
      await expect(service.read(params)).rejects.toThrow(/Failed to read SavingsVault\.portfolioValue.*contract unavailable/);

      const totalTime = Date.now() - startTime;

      // Should fail relatively quickly since errors are immediate (plus exponential backoff)
      // 100ms + 200ms + 400ms backoff ≈ 700ms plus execution time
      expect(totalTime).toBeLessThan(5000); // Should be much faster than timeout case
      expect(mockPublicClient.getBlockNumber).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

  });

  describe('Retry Count Validation', () => {

    /**
     * Test: Should make exactly 4 attempts (1 initial + 3 retries) per Req 1.6
     */
    it('should make exactly 4 attempts before giving up', async () => {
      const params: ReadParams = {
        contract: 'CommunityTreasury',
        functionName: 'ownershipShare',
        args: [1, '0x1234567890123456789012345678901234567890'],
      };

      // Setup: Cache miss
      mockRedisService.get.mockResolvedValue(null);

      // Track attempt count
      let attemptCount = 0;
      mockPublicClient.getBlockNumber.mockImplementation(() => {
        attemptCount++;
        return Promise.reject(new Error(`Attempt ${attemptCount} failed`));
      });

      // Execute - should fail after exactly 4 attempts
      await expect(service.read(params)).rejects.toThrow(/Failed to read CommunityTreasury\.ownershipShare.*contract unavailable/);

      // Verify exact attempt count
      expect(attemptCount).toBe(4);
      expect(mockPublicClient.getBlockNumber).toHaveBeenCalledTimes(4);
    });

    /**
     * Test: Should succeed on partial retry (e.g., succeed on attempt 3)
     */
    it('should succeed when retry eventually works', async () => {
      const params: ReadParams = {
        contract: 'Education',
        functionName: 'hasCertificate',
        args: ['0x1234567890123456789012345678901234567890', 'course-123'],
      };

      // Setup: Cache miss and eventual success
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);
      mockPrismaService.cachedReadValue.upsert.mockResolvedValue({});

      // Mock failure for first 2 attempts, then success
      let attemptCount = 0;
      mockPublicClient.getBlockNumber.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new Error(`Temporary failure ${attemptCount}`));
        }
        return Promise.resolve(BigInt(500000));
      });

      // Execute - should succeed on attempt 3
      const result = await service.read(params);

      expect(result).toBeDefined();
      expect(result.value).toBeDefined();
      expect(result.provenance.blockNumber).toBe(BigInt(500000));
      
      // Should have made exactly 3 attempts before succeeding
      expect(attemptCount).toBe(3);
      expect(mockPublicClient.getBlockNumber).toHaveBeenCalledTimes(3);
    });

  });

  describe('Exponential Backoff', () => {

    /**
     * Test: Should use exponential backoff between retry attempts
     */
    it('should implement exponential backoff between retries', async () => {
      const params: ReadParams = {
        contract: 'Governance',
        functionName: 'votingPowerOf',
        args: ['0x1234567890123456789012345678901234567890'],
      };

      // Setup: Cache miss
      mockRedisService.get.mockResolvedValue(null);

      // Track timing between attempts
      const attemptTimes: number[] = [];
      mockPublicClient.getBlockNumber.mockImplementation(() => {
        attemptTimes.push(Date.now());
        return Promise.reject(new Error('Network error'));
      });

      // Execute - should fail with backoff delays
      await expect(service.read(params)).rejects.toThrow(/Failed to read Governance\.votingPowerOf.*contract unavailable/);

      // Verify we had multiple attempts
      expect(attemptTimes.length).toBe(4);

      // Check that there were delays between attempts (exponential backoff)
      // First attempt: immediate
      // Second attempt: after ~100ms backoff
      // Third attempt: after ~200ms backoff  
      // Fourth attempt: after ~400ms backoff
      if (attemptTimes.length >= 2) {
        const firstDelay = attemptTimes[1]! - attemptTimes[0]!;
        expect(firstDelay).toBeGreaterThan(50); // Should have some backoff delay

        if (attemptTimes.length >= 3) {
          const secondDelay = attemptTimes[2]! - attemptTimes[1]!; 
          expect(secondDelay).toBeGreaterThan(firstDelay); // Should be longer than first delay
        }
      }
    }, 10000); // 10s test timeout

  });

  describe('Mixed Failure Scenarios', () => {

    /**
     * Test: Should handle mixed timeout and network failures appropriately
     */
    it('should handle mixed failure types across retries', async () => {
      const params: ReadParams = {
        contract: 'Registry',
        functionName: 'getProfile', 
        args: ['0x1234567890123456789012345678901234567890'],
      };

      // Setup: Cache miss
      mockRedisService.get.mockResolvedValue(null);

      // Mock different failure types for each attempt
      let attemptCount = 0;
      mockPublicClient.getBlockNumber.mockImplementation(() => {
        attemptCount++;
        
        switch (attemptCount) {
          case 1:
            // First attempt: immediate network error
            return Promise.reject(new Error('ECONNREFUSED'));
          case 2:
            // Second attempt: timeout (simulate with delay + rejection)
            return new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Request timeout')), 11000);
            });
          case 3:
            // Third attempt: contract revert
            return Promise.reject(new Error('Execution reverted'));
          case 4:
            // Fourth attempt: another network error
            return Promise.reject(new Error('Network unreachable'));
          default:
            return Promise.reject(new Error('Unexpected attempt'));
        }
      });

      // Execute - should fail after trying all different failure types
      await expect(service.read(params)).rejects.toThrow(/Failed to read Registry\.getProfile.*contract unavailable/);

      // Should have attempted all 4 tries despite different error types
      expect(attemptCount).toBe(4);
    }, 60000); // 60s timeout to allow for the simulated timeout

  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});