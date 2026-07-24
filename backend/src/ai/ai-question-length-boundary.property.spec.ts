import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fc from 'fast-check';

import { AiService } from './ai.service';
import { EnvService } from '../config/env.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChainReadService } from '../chain-read/chain-read.service';
import type { Conversation } from '@prisma/client';

/**
 * Property 29: AI question length boundary
 * **Validates: Requirements 10.7**
 *
 * This test validates that the AI assistant enforces strict question length limits:
 * - Questions ≤ 2000 characters are accepted for processing
 * - Questions > 2000 characters are rejected with BadRequestException
 * - The boundary enforcement is consistent regardless of question content
 * - Service availability errors are distinct from validation errors
 */
describe('Property 29: AI question length boundary', () => {
  let aiService: AiService;

  const mockUser = {
    id: 'test-user-id',
    address: '0x742d35Cc6634C0532925a3b8D8Bc4e11B9E4a8ff',
  };

  const mockConversation: Conversation = {
    id: 'test-conversation-id',
    userId: mockUser.id,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    // Create mock implementations
    const mockPrismaService = {
      conversation: {
        findFirst: jest.fn().mockResolvedValue(mockConversation),
        create: jest.fn().mockResolvedValue(mockConversation),
      },
      message: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation((queries) => Promise.all(queries)),
    };

    const mockChainReadService = {
      read: jest.fn().mockResolvedValue({
        value: '1000',
        provenance: {
          contractAddress: '0x1234...',
          blockNumber: 12345,
          fetchedAt: new Date(),
        },
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: EnvService,
          useValue: {
            openaiApiKey: 'test-openai-key', // Enable OpenAI for testing
          } as EnvService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ChainReadService,
          useValue: mockChainReadService,
        },
      ],
    }).compile();

    aiService = moduleRef.get<AiService>(AiService);

    // Mock OpenAI responses to avoid actual API calls
    const mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'This is a mock AI response for testing purposes.',
                },
              },
            ],
          }),
        },
      },
    };

    // Replace the OpenAI instance
    (aiService as any).openai = mockOpenAI;
  });

  /**
   * Property: Questions at or under 2000 characters are accepted
   * Requirements: 10.7 (question length validation - acceptance boundary)
   */
  it('accepts questions at or under 2000 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate questions from 1 to 2000 characters (inclusive boundary test)
        fc.record({
          questionLength: fc.integer({ min: 1, max: 2000 }),
          baseContent: fc.string().filter(s => s.length > 0), // Non-empty base
        }),
        async ({ questionLength, baseContent }) => {
          // Create a question of exactly the specified length
          const question = baseContent.repeat(Math.ceil(questionLength / baseContent.length)).slice(0, questionLength);
          
          // Ensure exact length
          expect(question.length).toBe(questionLength);
          expect(question.length).toBeLessThanOrEqual(2000);

          // Question should be accepted without validation error
          const result = await aiService.chat(mockUser.id, mockUser.address, question);
          
          // Verify successful response structure
          expect(result).toBeDefined();
          expect(result.answer).toBeDefined();
          expect(result.conversationId).toBeDefined();
          expect(typeof result.answer).toBe('string');
          expect(typeof result.conversationId).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Questions over 2000 characters are rejected with BadRequestException
   * Requirements: 10.7 (question length validation - rejection boundary)
   */
  it('rejects questions over 2000 characters with BadRequestException', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate questions from 2001 to 10000 characters (rejection boundary test)
        fc.record({
          excessLength: fc.integer({ min: 2001, max: 10000 }),
          baseContent: fc.string().filter(s => s.length > 0), // Non-empty base
        }),
        async ({ excessLength, baseContent }) => {
          // Create a question of exactly the specified excess length
          const question = baseContent.repeat(Math.ceil(excessLength / baseContent.length)).slice(0, excessLength);
          
          // Ensure exact length and that it exceeds boundary
          expect(question.length).toBe(excessLength);
          expect(question.length).toBeGreaterThan(2000);

          // Question should be rejected with BadRequestException
          await expect(
            aiService.chat(mockUser.id, mockUser.address, question)
          ).rejects.toThrow(BadRequestException);

          // Verify the specific error message includes length information
          try {
            await aiService.chat(mockUser.id, mockUser.address, question);
            fail('Expected BadRequestException to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            const badRequestError = error as BadRequestException;
            expect(badRequestError.message).toContain('Question exceeds maximum allowed length of 2000 characters');
            expect(badRequestError.message).toContain(`current: ${excessLength}`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Boundary enforcement is consistent across different content types
   * Requirements: 10.7 (consistent validation regardless of content)
   */
  it('enforces boundary consistently across different question content types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          contentType: fc.constantFrom(
            'alphabetic',
            'numeric', 
            'unicode',
            'mixed',
            'whitespace',
            'special-chars'
          ),
          isUnderBoundary: fc.boolean(),
        }),
        async ({ contentType, isUnderBoundary }) => {
          // Generate different types of content
          let question: string;
          const targetLength = isUnderBoundary ? 
            fc.sample(fc.integer({ min: 1, max: 2000 }), 1)[0]! : 
            fc.sample(fc.integer({ min: 2001, max: 5000 }), 1)[0]!;

          switch (contentType) {
            case 'alphabetic':
              question = 'a'.repeat(targetLength);
              break;
            case 'numeric':
              question = '1'.repeat(targetLength);
              break;
            case 'unicode':
              question = '🚀'.repeat(Math.ceil(targetLength / 2)).slice(0, targetLength);
              break;
            case 'mixed':
              question = 'A1!'.repeat(Math.ceil(targetLength / 3)).slice(0, targetLength);
              break;
            case 'whitespace':
              question = ' \t\n'.repeat(Math.ceil(targetLength / 3)).slice(0, targetLength);
              break;
            case 'special-chars':
              question = '!@#$%'.repeat(Math.ceil(targetLength / 5)).slice(0, targetLength);
              break;
            default:
              question = 'x'.repeat(targetLength);
          }

          // Ensure exact target length
          expect(question.length).toBe(targetLength);

          if (isUnderBoundary) {
            // Should be accepted
            expect(question.length).toBeLessThanOrEqual(2000);
            const result = await aiService.chat(mockUser.id, mockUser.address, question);
            expect(result).toBeDefined();
            expect(result.answer).toBeDefined();
          } else {
            // Should be rejected
            expect(question.length).toBeGreaterThan(2000);
            await expect(
              aiService.chat(mockUser.id, mockUser.address, question)
            ).rejects.toThrow(BadRequestException);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Validation errors are distinct from service unavailability errors
   * Requirements: 10.7 (validation error type), 10.8 (service availability error type)
   */
  it('distinguishes validation errors from service availability errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          questionLength: fc.integer({ min: 2001, max: 5000 }), // Over limit
          simulateServiceFailure: fc.boolean(),
        }),
        async ({ questionLength, simulateServiceFailure }) => {
          const question = 'x'.repeat(questionLength);
          expect(question.length).toBeGreaterThan(2000);

          if (simulateServiceFailure) {
            // Temporarily remove OpenAI to simulate service unavailability
            const originalOpenAI = (aiService as any).openai;
            (aiService as any).openai = null;

            try {
              await aiService.chat(mockUser.id, mockUser.address, question);
              fail('Expected an exception to be thrown');
            } catch (error) {
              // Should still get BadRequestException for length, not ServiceUnavailableException
              // Validation happens before service availability check
              expect(error).toBeInstanceOf(BadRequestException);
              const badRequestError = error as BadRequestException;
              expect(badRequestError.message).toContain('Question exceeds maximum allowed length');
            }

            // Restore OpenAI
            (aiService as any).openai = originalOpenAI;
          } else {
            // Normal case - should get BadRequestException for length
            await expect(
              aiService.chat(mockUser.id, mockUser.address, question)
            ).rejects.toThrow(BadRequestException);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Exact boundary behavior at 2000 characters
   * Requirements: 10.7 (exact boundary specification)
   */
  it('handles exact 2000-character boundary correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(s => s.length > 0), // Base content
        async (baseContent) => {
          // Test exactly 2000 characters (should be accepted)
          const exactly2000 = baseContent.repeat(Math.ceil(2000 / baseContent.length)).slice(0, 2000);
          expect(exactly2000.length).toBe(2000);

          const result2000 = await aiService.chat(mockUser.id, mockUser.address, exactly2000);
          expect(result2000).toBeDefined();
          expect(result2000.answer).toBeDefined();

          // Test exactly 2001 characters (should be rejected)
          const exactly2001 = exactly2000 + 'x';
          expect(exactly2001.length).toBe(2001);

          await expect(
            aiService.chat(mockUser.id, mockUser.address, exactly2001)
          ).rejects.toThrow(BadRequestException);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Empty and minimal questions are handled appropriately
   * Requirements: 10.7 (minimum question validation)
   */
  it('handles empty and minimal questions appropriately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5 }), // Very small lengths including 0
        async (minimalLength) => {
          if (minimalLength === 0) {
            // Empty question should be handled by Zod schema validation (separate from length check)
            // This test focuses on the 2000-char limit, not empty string validation
            return;
          }

          const minimalQuestion = 'x'.repeat(minimalLength);
          expect(minimalQuestion.length).toBe(minimalLength);
          expect(minimalQuestion.length).toBeLessThanOrEqual(2000);

          // Minimal non-empty questions should be accepted
          const result = await aiService.chat(mockUser.id, mockUser.address, minimalQuestion);
          expect(result).toBeDefined();
          expect(result.answer).toBeDefined();
        }
      ),
      { numRuns: 20 }
    );
  });
});