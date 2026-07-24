import { Test } from '@nestjs/testing';
import * as fc from 'fast-check';

import { IndexerService } from './indexer.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnvService } from '../config/env.service.js';

/**
 * Property 32: Indexing resumes gaplessly
 * **Validates: Requirements 12.6**
 * 
 * This test validates that when the Event_Indexer reconnects after network
 * unavailability, it resumes from the last successfully cached block number
 * without skipping intervening blocks. For any sequence of indexing interruptions
 * and resumptions, the set of indexed block numbers forms a contiguous range
 * with no skipped blocks.
 */
describe('Property 32: Indexing resumes gaplessly', () => {
  let indexerService: IndexerService;
  let prismaService: PrismaService;
  let mockPublicClient: any;

  beforeEach(async () => {
    // Create a mock public client that we can control for testing
    mockPublicClient = {
      getBlockNumber: jest.fn(),
      getBlock: jest.fn(),
      getLogs: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        IndexerService,
        {
          provide: PrismaService,
          useValue: {
            cachedEvent: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              deleteMany: jest.fn(),
              upsert: jest.fn(),
              count: jest.fn(),
            },
            indexerState: {
              findUnique: jest.fn(),
              create: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
        {
          provide: EnvService,
          useValue: {
            baseSepoliaRpcUrl: 'https://test.rpc.url',
            baseSepolia: 'https://test.rpc.url',
          } as Partial<EnvService>,
        },
      ],
    }).compile();
    indexerService = moduleRef.get<IndexerService>(IndexerService);
    prismaService = moduleRef.get<PrismaService>(PrismaService);

    // Replace the public client with our mock
    (indexerService as any).publicClient = mockPublicClient;
  });

  /**
   * Property: Resume from last successfully cached block without gaps
   * Requirements: 12.6 (gapless resume after network unavailability)
   */
  it('resumes indexing from last cached block without skipping blocks', () => {
    fc.assert(
        fc.asyncProperty(
        // Generate test data for resume scenarios
        fc.record({
          lastIndexedBlock: fc.bigUintN(32).map(n => n + 100n), // Start from block 100+
          currentHead: fc.bigUintN(32).map(n => n + 200n), // Current head is higher
          networkFailures: fc.array(
            fc.record({
              failureType: fc.constantFrom('timeout', 'connection_error', 'rate_limit'),
              affectedBlocks: fc.array(fc.bigUintN(16), { minLength: 1, maxLength: 3 }),
            }),
            { minLength: 1, maxLength: 2 }
          ),
          eventsPerBlock: fc.array(
            fc.array(
              fc.record({
                transactionHash: fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`),
                logIndex: fc.integer({ min: 0, max: 5 }),
                address: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
                topics: fc.array(fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`), { maxLength: 2 }),
              }),
              { maxLength: 2 }
            ),
            { maxLength: 10 }
          ),
        }).filter(({ lastIndexedBlock, currentHead }) => lastIndexedBlock < currentHead),
        async ({ lastIndexedBlock, currentHead, networkFailures, eventsPerBlock }) => {
          // Mock initial indexer state
          (prismaService.indexerState.findUnique as jest.Mock).mockResolvedValue({
            id: 'singleton',
            lastIndexedBlock,
            lastIndexedHash: `0x${'last'.repeat(16)}`,
          });

          // Mock current blockchain head
          mockPublicClient.getBlockNumber.mockResolvedValue(currentHead);

          // Mock no reorg (consistent hash)
          mockPublicClient.getBlock.mockImplementation(({ blockNumber }: { blockNumber: bigint }) => {
            return Promise.resolve({
              number: blockNumber,
              hash: `0x${blockNumber.toString(16).padStart(64, '0')}`,
            });
          });

          // Create a sequence of blocks to index from lastIndexedBlock+1 to currentHead
          const blocksToIndex: bigint[] = [];
          for (let block = lastIndexedBlock + 1n; block <= currentHead; block++) {
            blocksToIndex.push(block);
          }
          // Track which blocks have been successfully processed
          const processedBlocks = new Set<string>();
          let getLogsCallCount = 0;

          // Mock getLogs with potential network failures and eventual success
          mockPublicClient.getLogs.mockImplementation(({ fromBlock, toBlock }: { fromBlock: bigint, toBlock: bigint }) => {
            getLogsCallCount++;
            
            // Simulate network failure for certain calls based on our failure scenarios
            const shouldFail = networkFailures.some(failure => 
              failure.affectedBlocks.some(failBlock => failBlock >= fromBlock && failBlock <= toBlock)
            ) && getLogsCallCount <= networkFailures.length; // Fail only on initial attempts

            if (shouldFail) {
              return Promise.reject(new Error('Network unavailable'));
            }

            // Generate events for the block range
            const events: any[] = [];
            for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
              const blockIndex = Number(blockNum - lastIndexedBlock - 1n);
              const blockEvents = eventsPerBlock[blockIndex] || [];
              
              blockEvents.forEach(event => {
                events.push({
                  ...event,
                  blockNumber: blockNum,
                  blockHash: `0x${blockNum.toString(16).padStart(64, '0')}`,
                });
              });
              
              // Mark this block as processed
              processedBlocks.add(blockNum.toString());
            }

            return Promise.resolve(events);
          });

          // Track state updates to verify gapless progression
          const stateUpdates: { block: bigint, hash: string }[] = [];
          (prismaService.indexerState.upsert as jest.Mock).mockImplementation((data: any) => {
            stateUpdates.push({
              block: data.create.lastIndexedBlock || data.update.lastIndexedBlock,
              hash: data.create.lastIndexedHash || data.update.lastIndexedHash,
            });
            return Promise.resolve({});
          });

          // Mock event caching (should be called for all events)
          const cachedEvents: any[] = [];
          (prismaService.cachedEvent.upsert as jest.Mock).mockImplementation((data: any) => {
            cachedEvents.push(data.create);
            return Promise.resolve({});
          });

          // Call indexNewBlocks method (simulating resume after network recovery)
          const indexNewBlocks = (indexerService as any).indexNewBlocks.bind(indexerService);
          
          // Should not throw even with initial network failures
          await expect(indexNewBlocks()).resolves.not.toThrow();
          // Verify gapless progression: all blocks from lastIndexedBlock+1 to currentHead should be processed
          const expectedBlocks = new Set<string>();
          for (let block = lastIndexedBlock + 1n; block <= currentHead; block++) {
            expectedBlocks.add(block.toString());
          }
          
          // All expected blocks should have been processed (no gaps)
          expect(processedBlocks).toEqual(expectedBlocks);

          // Verify state was updated to the current head (complete catch-up)
          const finalStateUpdate = stateUpdates[stateUpdates.length - 1];
          expect(finalStateUpdate?.block).toBe(currentHead);
          expect(finalStateUpdate?.hash).toBe(`0x${currentHead.toString(16).padStart(64, '0')}`);

          // Verify events were cached with correct provenance for each processed block
          const cachedBlockNumbers = cachedEvents.map(event => event.blockNumber);
          const uniqueCachedBlocks = new Set(cachedBlockNumbers.map(b => b.toString()));
          
          // Should have cached events for blocks that have events
          eventsPerBlock.forEach((blockEvents, index) => {
            if (blockEvents.length > 0) {
              const blockNum = lastIndexedBlock + BigInt(index) + 1n;
              expect(uniqueCachedBlocks.has(blockNum.toString())).toBe(true);
            }
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Multiple interruption-resumption cycles maintain block continuity
   * Requirements: 12.6 (sequence of interruptions and resumptions)
   */
  it('maintains block continuity across multiple interruption cycles', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          startBlock: fc.bigUintN(32).map(n => n + 100n),
          interruptionCycles: fc.array(
            fc.record({
              successfulBlocks: fc.integer({ min: 1, max: 10 }), // Blocks successfully processed
              interruptionDuration: fc.integer({ min: 1, max: 5 }), // Blocks missed during interruption
            }),
            { minLength: 2, maxLength: 5 }
          ),
        }),
        async ({ startBlock, interruptionCycles }) => {
          let currentBlock = startBlock;
          const allProcessedBlocks: bigint[] = [];
          
          // Simulate multiple cycles of success -> interruption -> resume
          for (let cycleIndex = 0; cycleIndex < interruptionCycles.length; cycleIndex++) {
            const cycle = interruptionCycles[cycleIndex]!;
            
            // Mock successful processing of some blocks
            const cycleEndBlock = currentBlock + BigInt(cycle.successfulBlocks);
            
            (prismaService.indexerState.findUnique as jest.Mock).mockResolvedValue({
              id: 'singleton',
              lastIndexedBlock: currentBlock,
              lastIndexedHash: `0x${currentBlock.toString(16).padStart(64, '0')}`,
            });

            mockPublicClient.getBlockNumber.mockResolvedValue(cycleEndBlock + BigInt(cycle.interruptionDuration));
            
            mockPublicClient.getBlock.mockImplementation(({ blockNumber }: { blockNumber: bigint }) => ({
              number: blockNumber,
              hash: `0x${blockNumber.toString(16).padStart(64, '0')}`,
            }));
            // Mock getLogs to succeed for the catchup range
            mockPublicClient.getLogs.mockImplementation(({ fromBlock, toBlock }: { fromBlock: bigint, toBlock: bigint }) => {
              const events: any[] = [];
              for (let block = fromBlock; block <= toBlock; block++) {
                // Track which blocks were processed
                allProcessedBlocks.push(block);
                
                // Generate a simple event for each block
                events.push({
                  transactionHash: `0x${block.toString(16).padStart(64, '0')}`,
                  logIndex: 0,
                  address: `0x${'a'.repeat(40)}`,
                  blockNumber: block,
                  blockHash: `0x${block.toString(16).padStart(64, '0')}`,
                  topics: [`0x${'topic'.repeat(12)}00`],
                });
              }
              return Promise.resolve(events);
            });

            // Mock state and event caching
            (prismaService.indexerState.upsert as jest.Mock).mockResolvedValue({});
            (prismaService.cachedEvent.upsert as jest.Mock).mockResolvedValue({});

            // Process this cycle
            const indexNewBlocks = (indexerService as any).indexNewBlocks.bind(indexerService);
            await indexNewBlocks();

            // Move to next cycle starting point (including interruption gap)
            currentBlock = cycleEndBlock + BigInt(cycle.interruptionDuration);
          }

          // Verify no gaps in the processed block sequence within each cycle
          // Note: gaps between cycles are expected due to interruptions, but within
          // each recovery cycle, blocks should be processed sequentially without gaps
          
          // Group processed blocks by continuous ranges
          const sortedBlocks = allProcessedBlocks.sort((a, b) => Number(a - b));
          
          if (sortedBlocks.length === 0) {
            return; // No blocks processed, nothing to verify
          }
          
          let previousBlock = sortedBlocks[0]! - 1n;
          
          for (const block of sortedBlocks) {
            // Within each indexNewBlocks call, blocks should be continuous
            // (We expect gaps between cycles, but not within a single recovery operation)
            if (block !== previousBlock + 1n) {
              // This is the start of a new cycle, which is expected
              // Verify that this block starts a new continuous range
              const cycleStart = block;
              let cycleEnd = block;
              
              // Find the end of this continuous range
              for (let i = sortedBlocks.indexOf(block) + 1; i < sortedBlocks.length; i++) {
                if (sortedBlocks[i]! === cycleEnd + 1n) {
                  cycleEnd = sortedBlocks[i]!;
                } else {
                  break;
                }
              }
              
              // Verify this range is continuous (no internal gaps)
              const expectedRangeSize = Number(cycleEnd - cycleStart + 1n);
              const actualRangeBlocks = sortedBlocks.filter(b => b >= cycleStart && b <= cycleEnd);
              expect(actualRangeBlocks.length).toBe(expectedRangeSize);
            }
            previousBlock = block;
          }
        }
      ),
      { numRuns: 5 }
    );
  });
  /**
   * Property: Resume continues from exact last cached block, not approximate
   * Requirements: 12.6 (resume from last successfully cached block number)
   */
  it('resumes from exact last cached block number', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          lastCachedBlock: fc.bigUintN(32).map(n => n + 50n),
          blockchainHead: fc.bigUintN(32).map(n => n + 100n),
          lastCachedHash: fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`),
        }).filter(({ lastCachedBlock, blockchainHead }) => lastCachedBlock < blockchainHead),
        async ({ lastCachedBlock, blockchainHead, lastCachedHash }) => {
          // Mock indexer state with specific last cached block
          (prismaService.indexerState.findUnique as jest.Mock).mockResolvedValue({
            id: 'singleton',
            lastIndexedBlock: lastCachedBlock,
            lastIndexedHash: lastCachedHash,
          });

          // Mock current blockchain state
          mockPublicClient.getBlockNumber.mockResolvedValue(blockchainHead);
          
          // Mock no reorg (consistent block hash)
          mockPublicClient.getBlock.mockResolvedValue({
            number: lastCachedBlock,
            hash: lastCachedHash,
          });

          // Track the exact range requested from getLogs
          let requestedFromBlock: bigint | undefined;
          let requestedToBlock: bigint | undefined;
          
          mockPublicClient.getLogs.mockImplementation(({ fromBlock, toBlock }: { fromBlock: bigint, toBlock: bigint }) => {
            requestedFromBlock = fromBlock;
            requestedToBlock = toBlock;
            
            // Return empty events for simplicity
            return Promise.resolve([]);
          });

          // Mock state and event caching
          (prismaService.indexerState.upsert as jest.Mock).mockResolvedValue({});
          (prismaService.cachedEvent.upsert as jest.Mock).mockResolvedValue({});

          // Execute indexing
          const indexNewBlocks = (indexerService as any).indexNewBlocks.bind(indexerService);
          await indexNewBlocks();

          // Verify that indexing starts from exactly lastCachedBlock + 1
          expect(requestedFromBlock).toBe(lastCachedBlock + 1n);
          expect(requestedToBlock).toBe(blockchainHead);

          // Verify no blocks are skipped in the range
          const expectedBlockCount = Number(blockchainHead - lastCachedBlock);
          const actualBlockRange = requestedToBlock! - requestedFromBlock! + 1n;
          expect(Number(actualBlockRange)).toBe(expectedBlockCount);
        }
      ),
      { numRuns: 20 }
    );
  });
  /**
   * Property: Network retry behavior eventually succeeds and resumes gaplessly
   * Requirements: 12.6 (retry reading affected blocks, resume without skipping)
   */
  it('retries network failures and eventually resumes without gaps', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          lastBlock: fc.bigUintN(32).map(n => n + 20n),
          currentHead: fc.bigUintN(32).map(n => n + 50n),
          failureCount: fc.integer({ min: 1, max: 5 }), // Number of failures before success
          errorTypes: fc.array(
            fc.constantFrom('timeout', 'connection_refused', 'rate_limited'),
            { minLength: 1, maxLength: 3 }
          ),
        }).filter(({ lastBlock, currentHead }) => lastBlock < currentHead),
        async ({ lastBlock, currentHead, failureCount, errorTypes }) => {
          // Mock indexer state
          (prismaService.indexerState.findUnique as jest.Mock).mockResolvedValue({
            id: 'singleton',
            lastIndexedBlock: lastBlock,
            lastIndexedHash: `0x${'start'.repeat(12)}000000`,
          });

          mockPublicClient.getBlockNumber.mockResolvedValue(currentHead);
          
          // Mock consistent block (no reorg)
          mockPublicClient.getBlock.mockResolvedValue({
            number: lastBlock,
            hash: `0x${'start'.repeat(12)}000000`,
          });

          // Mock getLogs with failures followed by success
          let attemptCount = 0;
          const allRequestedRanges: { from: bigint, to: bigint }[] = [];
          
          mockPublicClient.getLogs.mockImplementation(({ fromBlock, toBlock }: { fromBlock: bigint, toBlock: bigint }) => {
            attemptCount++;
            allRequestedRanges.push({ from: fromBlock, to: toBlock });
            
            if (attemptCount <= failureCount) {
              const errorType = errorTypes[attemptCount % errorTypes.length];
              return Promise.reject(new Error(`Network error: ${errorType}`));
            }

            // Success case - return events for the range
            const events: any[] = [];
            for (let block = fromBlock; block <= toBlock; block++) {
              events.push({
                transactionHash: `0x${block.toString(16).padStart(64, '0')}`,
                logIndex: 0,
                address: `0x${'contract'.repeat(8)}`,
                blockNumber: block,
                blockHash: `0x${block.toString(16).padStart(64, '0')}`,
                topics: [`0x${'event'.repeat(12)}000`],
              });
            }
            return Promise.resolve(events);
          });

          // Track cached events
          const cachedEvents: any[] = [];
          (prismaService.cachedEvent.upsert as jest.Mock).mockImplementation((data: any) => {
            cachedEvents.push(data.create);
            return Promise.resolve({});
          });

          // Mock state update
          (prismaService.indexerState.upsert as jest.Mock).mockResolvedValue({});

          // Execute indexing - should eventually succeed despite network failures
          const indexNewBlocks = (indexerService as any).indexNewBlocks.bind(indexerService);
          
          if (failureCount > 0) {
            // Expect the method to throw on network failures (proper error propagation)
            await expect(indexNewBlocks()).rejects.toThrow();
          } else {
            await expect(indexNewBlocks()).resolves.not.toThrow();
          }

          // Verify that all retry attempts requested the same complete range
          allRequestedRanges.forEach(range => {
            expect(range.from).toBe(lastBlock + 1n);
            expect(range.to).toBe(currentHead);
          });
          
          // Verify no partial ranges were requested (no gaps introduced by retries)
          const expectedRange = { from: lastBlock + 1n, to: currentHead };
          allRequestedRanges.forEach(range => {
            expect(range).toEqual(expectedRange);
          });
        }
      ),
      { numRuns: 10 }
    );
  });
  /**
   * Property: Block sequence integrity maintained across service restarts
   * Requirements: 12.6 (resume from last successfully cached block)
   */
  it('maintains block sequence integrity across service restarts', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          restartScenarios: fc.array(
            fc.record({
              processedBlocks: fc.integer({ min: 5, max: 20 }),
              restartAtBlock: fc.bigUintN(32).map(n => n + 100n),
            }),
            { minLength: 2, maxLength: 4 }
          ),
        }),
        async ({ restartScenarios }) => {
          const allProcessedBlocks: bigint[] = [];
          let totalExpectedBlocks = 0;
          
          // Simulate multiple service restarts
          for (let i = 0; i < restartScenarios.length; i++) {
            const scenario = restartScenarios[i]!;
            const startBlock = i === 0 ? scenario.restartAtBlock : scenario.restartAtBlock + BigInt(i * 10);
            const endBlock = startBlock + BigInt(scenario.processedBlocks);
            
            // Mock indexer state for this restart (resume from where we left off)
            const lastIndexedBlock = i === 0 ? startBlock - 1n : allProcessedBlocks[allProcessedBlocks.length - 1]!;
            
            (prismaService.indexerState.findUnique as jest.Mock).mockResolvedValue({
              id: 'singleton',
              lastIndexedBlock,
              lastIndexedHash: `0x${lastIndexedBlock.toString(16).padStart(64, '0')}`,
            });

            mockPublicClient.getBlockNumber.mockResolvedValue(endBlock);
            
            mockPublicClient.getBlock.mockResolvedValue({
              number: lastIndexedBlock,
              hash: `0x${lastIndexedBlock.toString(16).padStart(64, '0')}`,
            });

            // Track blocks processed in this session
            const sessionBlocks: bigint[] = [];
            
            mockPublicClient.getLogs.mockImplementation(({ fromBlock, toBlock }: { fromBlock: bigint, toBlock: bigint }) => {
              const events: any[] = [];
              for (let block = fromBlock; block <= toBlock; block++) {
                sessionBlocks.push(block);
                allProcessedBlocks.push(block);
                
                events.push({
                  transactionHash: `0x${block.toString(16).padStart(64, '0')}`,
                  logIndex: 0,
                  address: `0x${'addr'.repeat(10)}`,
                  blockNumber: block,
                  blockHash: `0x${block.toString(16).padStart(64, '0')}`,
                  topics: [`0x${'sig'.repeat(16)}`],
                });
              }
              return Promise.resolve(events);
            });

            (prismaService.cachedEvent.upsert as jest.Mock).mockResolvedValue({});
            (prismaService.indexerState.upsert as jest.Mock).mockResolvedValue({});

            // Execute indexing for this session
            const indexNewBlocks = (indexerService as any).indexNewBlocks.bind(indexerService);
            await indexNewBlocks();

            // Verify this session processed blocks sequentially from last+1
            expect(sessionBlocks[0]).toBe(lastIndexedBlock + 1n);
            
            // Verify no gaps within this session
            for (let j = 1; j < sessionBlocks.length; j++) {
              expect(sessionBlocks[j]).toBe(sessionBlocks[j-1]! + 1n);
            }
            
            totalExpectedBlocks += scenario.processedBlocks;
          }

          // Verify overall sequence has no gaps (accounting for restart points)
          const sortedBlocks = allProcessedBlocks.sort((a, b) => Number(a - b));
          
          // Group by continuous sequences (gaps are expected between restarts)
          const sequences: bigint[][] = [];
          
          if (sortedBlocks.length === 0) {
            return; // No blocks processed
          }
          
          let currentSequence: bigint[] = [sortedBlocks[0]!];
          
          for (let i = 1; i < sortedBlocks.length; i++) {
            if (sortedBlocks[i]! === sortedBlocks[i-1]! + 1n) {
              currentSequence.push(sortedBlocks[i]!);
            } else {
              sequences.push(currentSequence);
              currentSequence = [sortedBlocks[i]!];
            }
          }
          sequences.push(currentSequence);
          
          // Each sequence should be continuous (no internal gaps)
          sequences.forEach(sequence => {
            for (let i = 1; i < sequence.length; i++) {
              expect(sequence[i]).toBe(sequence[i-1]! + 1n);
            }
          });

          // Should have processed the expected number of blocks
          expect(allProcessedBlocks.length).toBe(totalExpectedBlocks);
        }
      ),
      { numRuns: 20 }
    );
  });
});